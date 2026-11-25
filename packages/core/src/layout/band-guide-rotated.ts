/**
 * Rotated band-label planning — the rotated/truncated/thinned leg of the
 * `band-guide` escalation ladder, extracted from `planBandAxis`.
 *
 * Owns: rotated geometry extents (asymmetric along-axis footprint), the
 * parallel-baseline text-text collision check, automatic −45/−90 angle
 * selection, the full-string `rotatedPlan` (per-label side/bottom budgets,
 * truncation, thinning, degradation flags), and the wrap-then−45° hybrid
 * planner with its readability comparison against full-string rotation.
 *
 * Geometry closes over `lineHeight`, so the extents helpers are defined inside
 * the factory rather than at module scope. The context is an explicit snapshot
 * of the planner state the rotated path reads; nothing here mutates it.
 */

import { uniformAngleBaselinesCollide } from "./axis-overlap.js";
import {
  BAND_THIN_MIN_CATEGORIES,
  RAD,
  balanceLabelLines,
  quantizeUp,
  type BandLayoutEntry,
} from "./band-label-layout.js";
import type { BandAxisPlan, BandAxisPlanTick } from "./band-guide-types.js";
import type { GuideDegradedCode } from "./guide-degraded-codes.js";
import type { TextMeasurer } from "./measure.js";
import { truncateToFit } from "./truncate.js";

/**
 * Shared tick builder from `planBandAxis` (same signature as single/wrap).
 */
export type RotatedBandPlannerContext = {
  readonly entries: readonly BandLayoutEntry[];
  readonly measurer: TextMeasurer;
  readonly fontSize: number;
  readonly extentPx: number;
  /** Band width = extentPx / categoryCount (pre-thinning). */
  readonly bandWidth: number;
  /** Cap for along-axis overhang past the end ticks. */
  readonly marginCapPx: number;
  /** Budgeted orthogonal label band cap (already floored to the quantum). */
  readonly orthoCap: number;
  readonly gap: number;
  readonly lineHeight: number;
  readonly quantum: number;
  readonly ellipsis: string;
  readonly maxWrapLines: number;
  readonly buildTicks: (
    every: number,
    build: (
      entry: BandLayoutEntry,
      index: number,
    ) => Pick<BandAxisPlanTick, "label" | "lines" | "angle">,
  ) => BandAxisPlanTick[];
};

type RotatedLineSource = {
  /** Per-entry display lines (length 1 = full string). */
  linesList: readonly (readonly string[])[];
  /** Max glyph width per entry (after any truncation callers apply). */
  widths: readonly number[];
};

export function createRotatedBandPlanner(context: RotatedBandPlannerContext): {
  chooseAutoAngle(): number;
  rotatedPlan(
    angle: number,
    hybrid?: { linesList: readonly (readonly string[])[]; widths: readonly number[] },
  ): BandAxisPlan;
  tryHybridRotatePlan(): BandAxisPlan | null;
} {
  const {
    entries,
    measurer,
    fontSize,
    extentPx,
    bandWidth,
    marginCapPx,
    orthoCap,
    gap,
    lineHeight,
    quantum,
    ellipsis,
    maxWrapLines,
    buildTicks,
  } = context;

  // The SVG renderer hangs rotated labels with text-anchor="end", so the along-
  // axis footprint is ASYMMETRIC about the tick: it extends mostly to the LEFT
  // (the text runs up-left from the tick), with only a half-line-height to the
  // right. Multi-line rotated stacks additional lines with local +y dy (first
  // line end-anchored at the tick); at −45° that grows the RIGHT extent.
  const leftExtOf = (width: number, angle: number) => {
    const a = Math.abs(angle) * RAD;
    return width * Math.cos(a) + (lineHeight / 2) * Math.sin(a);
  };
  const rightExtOf = (angle: number, lineCount = 1) => {
    const lines = Math.max(1, lineCount);
    return (lines - 0.5) * lineHeight * Math.sin(Math.abs(angle) * RAD);
  };
  const orthoOf = (width: number, angle: number, lineCount = 1) => {
    const a = Math.abs(angle) * RAD;
    const lines = Math.max(1, lineCount);
    return width * Math.sin(a) + lines * lineHeight * Math.cos(a);
  };
  /** Widest label among the currently-labeled (every k-th) entries. */
  const labeledMaxWidth = (every: number) => {
    let max = 0;
    for (let i = 0; i < entries.length; i += every) max = Math.max(max, entries[i]!.width);
    return max;
  };
  // Overlap of adjacent rotated labels at a shared angle. Uniform-angle labels
  // sit on parallel baselines — collide only when perpendicular band separation
  // is below lineHeight+gap (width-independent). AABB asym extents still drive
  // overhang / side-cap truncation below; do not use them to pick −90.
  const rotatedTextCollides = (every: number, angle: number) => {
    // Labeled ticks are every `every`-th entry in display order; centers are
    // spaced by `every * bandWidth` along the axis.
    return uniformAngleBaselinesCollide(angle, bandWidth * every, lineHeight, gap);
  };

  const chooseAutoAngle = (): number => {
    return rotatedTextCollides(1, -45) ? -90 : -45;
  };

  const rotatedPlan = (angle: number, hybrid?: RotatedLineSource): BandAxisPlan => {
    const degraded: GuideDegradedCode[] = [];
    let labelEvery = 1;
    let overlap = false;
    let marginOverflow = false;
    const isHybrid = hybrid !== undefined;
    const lineCountOf = (i: number) => hybrid?.linesList[i]?.length ?? 1;

    // Along-axis: parallel-baseline text-text only (same as full-string −45°).
    // Multi-line dy stack grows the right AABB at −45°, but that is column-box
    // geometry — not glyph collision. Asym extents still drive overhang below.
    if (rotatedTextCollides(1, angle)) {
      if (entries.length >= BAND_THIN_MIN_CATEGORIES) {
        // High cardinality: thin (never for a handful of named bars).
        while (rotatedTextCollides(labelEvery, angle) && labelEvery * 2 < entries.length) {
          labelEvery *= 2;
        }
        if (rotatedTextCollides(labelEvery, angle)) {
          overlap = true;
          degraded.push("band-label-overlap");
        }
      } else {
        overlap = true;
        degraded.push("band-label-overlap");
      }
    }

    // Orthogonal: recompute the footprint from the labels that survive thinning, so
    // a hidden wide label neither truncates visible text nor emits a false overflow.
    let shownWidth = 0;
    let shownLines = 1;
    for (let i = 0; i < entries.length; i += labelEvery) {
      const w = isHybrid ? hybrid.widths[i]! : entries[i]!.width;
      shownWidth = Math.max(shownWidth, w);
      shownLines = Math.max(shownLines, lineCountOf(i));
    }
    const orthoNeeded = orthoOf(shownWidth, angle, shownLines);
    const a = Math.abs(angle) * RAD;
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);
    // Uniform width budget from the bottom cap (∞ when the whole band already fits).
    // Degenerate angles (≈0) have sin≈0; avoid divide-by-zero and fall back to no
    // width cap from the orthogonal budget (side-cap truncation still applies).
    const orthoWidthBudget =
      orthoNeeded > orthoCap && sinA > 1e-9
        ? Math.max(1, (orthoCap - shownLines * lineHeight * cosA) / sinA)
        : Number.POSITIVE_INFINITY;

    // Truncate each label to the TIGHTER of the bottom-cap budget and its own LEFT
    // side cap. An end-anchored rotated label extends left by leftExtOf(w), which
    // must fit `center + marginCapPx` or it draws past the viewport into chrome.
    // (For −90 the left extent is width-independent, so truncation can't help; that
    // degenerate case is flagged in the overhang pass below.)
    // Hybrid: truncate only the widest line of each tick so display lines stay
    // multi-line; full-string path truncates the single label as before.
    const ticks = buildTicks(labelEvery, (e, i) => {
      let widthBudget = orthoWidthBudget;
      if (cosA > 1e-9) {
        const sideBudget = (e.center + marginCapPx - (lineHeight / 2) * sinA) / cosA;
        widthBudget = Math.min(widthBudget, sideBudget);
      }
      if (isHybrid) {
        const lines = [...hybrid.linesList[i]!];
        if (widthBudget !== Number.POSITIVE_INFINITY) {
          let maxW = 0;
          let maxIdx = 0;
          for (let li = 0; li < lines.length; li++) {
            const w = measurer.measureWidth(lines[li]!, fontSize);
            if (w > maxW) {
              maxW = w;
              maxIdx = li;
            }
          }
          if (maxW > widthBudget) {
            lines[maxIdx] = truncateToFit(
              lines[maxIdx]!,
              Math.max(1, widthBudget),
              measurer,
              fontSize,
              ellipsis,
            );
            marginOverflow = true;
          }
        }
        return { label: lines.join(" "), lines, angle };
      }
      const label =
        widthBudget === Number.POSITIVE_INFINITY
          ? e.label
          : truncateToFit(e.label, Math.max(1, widthBudget), measurer, fontSize, ellipsis);
      if (label !== e.label) marginOverflow = true;
      return { label, angle };
    });

    // One measureWidth per labeled tick: drives both band height (max width) and
    // end-anchored overhang (left/right extent). Avoids a second full scan.
    let shownMaxWidth = 0;
    let shownMaxLines = 1;
    let rotLeft = 0;
    let rotRight = 0;
    for (let i = 0; i < ticks.length; i++) {
      if (!ticks[i]!.labeled) continue;
      const center = entries[i]!.center;
      const lines = ticks[i]!.lines;
      const lineCount = lines !== undefined && lines.length > 0 ? lines.length : 1;
      let width: number;
      if (lines !== undefined && lines.length > 1) {
        width = Math.max(...lines.map((l) => measurer.measureWidth(l, fontSize)));
      } else {
        width = measurer.measureWidth(ticks[i]!.label, fontSize);
      }
      shownMaxWidth = Math.max(shownMaxWidth, width);
      shownMaxLines = Math.max(shownMaxLines, lineCount);
      const leftExt = leftExtOf(width, angle);
      const rightExt = rightExtOf(angle, lineCount);
      // Width-independent residual (chiefly −90): if the footprint still exceeds the
      // side cap after truncation we cannot shrink it further — flag honestly.
      if (
        leftExt > center + marginCapPx + 1e-6 ||
        rightExt > extentPx - center + marginCapPx + 1e-6
      ) {
        marginOverflow = true;
      }
      rotLeft = Math.max(rotLeft, leftExt - center);
      rotRight = Math.max(rotRight, rightExt - (extentPx - center));
    }
    const labelBandHeight = quantizeUp(
      Math.min(orthoOf(shownMaxWidth, angle, shownMaxLines), orthoCap),
      quantum,
    );
    if (marginOverflow) degraded.push("band-label-margin-overflow");
    const alongOverhang = Math.max(0, Math.min(marginCapPx, rotRight));
    const leftOverhang = Math.max(0, Math.min(marginCapPx, rotLeft));

    return {
      mode: "rotated",
      angle,
      ticks,
      labelEvery,
      labelBandHeight,
      alongOverhang,
      leftOverhang,
      overlap,
      marginOverflow,
      degraded,
    };
  };

  /**
   * Wrap-then−45°: balance multi-word labels onto ≤maxWrapLines, rotate at −45°.
   * Accepted only when it beats full-string rotation on readability (no
   * text-text collision, no margin overflow, and strictly less ortho band than
   * full-string −45° — or full-string would overflow the bottom cap).
   * Single-token-only axes return null.
   */
  const tryHybridRotatePlan = (): BandAxisPlan | null => {
    // Parallel −45 must clear; otherwise full-string may escalate to −90.
    if (rotatedTextCollides(1, -45)) return null;

    const linesList = entries.map((e) =>
      balanceLabelLines(e.label, maxWrapLines, measurer, fontSize),
    );
    if (!linesList.some((lines) => lines.length > 1)) return null;

    const widths = linesList.map((lines) =>
      Math.max(...lines.map((l) => measurer.measureWidth(l, fontSize))),
    );

    const hybrid = rotatedPlan(-45, { linesList, widths });
    // Reject hybrid when it still collides or overflows — fall through to the
    // full-string path which may thin / use −90 / truncate more honestly.
    if (hybrid.overlap || hybrid.marginOverflow) return null;

    // Compare against full-string −45° ortho without building a second plan
    // (avoids doubling measureWidth on the common hybrid path).
    const fullMaxW = labeledMaxWidth(1);
    const fullOrtho = orthoOf(fullMaxW, -45, 1);
    const fullWouldOverflow = fullOrtho > orthoCap + 1e-6;
    if (!fullWouldOverflow && hybrid.labelBandHeight >= fullOrtho - 1e-6) {
      return null;
    }
    return hybrid;
  };

  return { chooseAutoAngle, rotatedPlan, tryHybridRotatePlan };
}
