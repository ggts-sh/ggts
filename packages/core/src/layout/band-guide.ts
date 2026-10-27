/**
 * Measured categorical (band) axis label planner — the discrete analogue of
 * `planTemporalAxis`. Horizontal escalation ladder:
 *
 *   single-line → wrapped (≤2 lines, top-aligned plane overlap; balanced
 *     breaks when greedy exceeds the line cap)
 *     → wrap-then−45° (balanced ≤2 lines rotated; mode still "rotated"+lines)
 *     → rotated full-string (−45° then −90°; parallel-baseline text-text)
 *     → truncate + margin-overflow warning
 *     → thin (labelEvery)
 *     → overlap warning
 *
 * Vertical axes stay single-line: density-thin only at high cardinality,
 * width-thin only when that shrinks the widest shown label, truncate any
 * remaining left-margin overflow, and otherwise report overlap.
 *
 * Author pins via `scales.*.guide` (`mode` / `angle` / `wrap`) skip auto
 * escalation and report honest overlap/overflow when the pin cannot fit.
 *
 * Types live in `band-guide-types.ts`; wrap/cap helpers in `band-label-layout.ts`;
 * the rotated/thinned planning leg lives in `band-guide-rotated.ts`.
 * Wrap overlap assumes the same top-aligned tspan stack as Axis.svelte /
 * render-svg-scene (plane 0 = first line). Multi-line rotated uses the same
 * end-anchored `rotate()` + per-line `tspan` dy stack in both renderers.
 */

import { neighbourOverlap, neighbourOverlapByPlane } from "./axis-overlap.js";
import type { BandAxisPlan, BandAxisPlanInput, BandAxisPlanTick } from "./band-guide-types.js";
import {
  BAND_THIN_MIN_CATEGORIES,
  MAX_AUTHOR_WRAP_LINES,
  MAX_WRAP_LINES,
  MIN_BAND_LABEL_GAP_PX,
  MODE_RANK,
  capEndOverhang,
  quantizeUp,
  wrapLabel,
  type BandLayoutEntry,
} from "./band-label-layout.js";
import { createRotatedBandPlanner } from "./band-guide-rotated.js";
import type { GuideDegradedCode } from "./guide-degraded-codes.js";
import { truncateToFit } from "./truncate.js";

export type {
  BandAxisPlan,
  BandAxisPlanInput,
  BandGuideConfig,
  BandLabelMode,
} from "./band-guide-types.js";

function resolveMaxWrapLines(wrap: number | undefined): number {
  if (wrap === undefined || !Number.isFinite(wrap)) return MAX_WRAP_LINES;
  return Math.max(1, Math.min(MAX_AUTHOR_WRAP_LINES, Math.floor(wrap)));
}

/**
 * Planner geometry assumes labels hang down-left with text-anchor="end".
 * Normalize author angles into the supported −90..0 range (flip positive
 * angles, then clamp).
 */
function resolvePinnedAngle(angle: number | undefined): number | undefined {
  if (angle === undefined || !Number.isFinite(angle)) return undefined;
  const signed = angle > 0 ? -angle : angle;
  return Math.min(0, Math.max(-90, signed));
}

export function planBandAxis(input: BandAxisPlanInput): BandAxisPlan {
  const {
    categoryCount,
    entries: inputEntries,
    extentPx,
    reverse,
    measurer,
    fontSize,
    orthogonalMarginCapPx,
    marginCapPx,
    previousMode,
    config,
  } = input;
  const quantum = input.quantum ?? 0;
  const ellipsis = input.ellipsis ?? "…";
  const gap = MIN_BAND_LABEL_GAP_PX;
  const lineHeight = measurer.measureHeight(fontSize);
  const n = Math.max(1, categoryCount);
  const guideMode = config?.mode ?? "auto";
  const authorPinned = guideMode !== "auto";
  const maxWrapLines = resolveMaxWrapLines(config?.wrap);
  const pinnedAngle = resolvePinnedAngle(config?.angle);

  const bandWidth = extentPx / n;
  const centerOf = (domainIndex: number) => {
    const fraction = (domainIndex + 0.5) / n;
    return (reverse ? 1 - fraction : fraction) * extentPx;
  };
  const entries: BandLayoutEntry[] = inputEntries.map((entry) => ({
    value: entry.value,
    label: entry.label,
    domainIndex: entry.domainIndex,
    center: centerOf(entry.domainIndex),
    width: measurer.measureWidth(entry.label, fontSize),
  }));

  const buildTicks = (
    every: number,
    build: (
      entry: BandLayoutEntry,
      index: number,
    ) => Pick<BandAxisPlanTick, "label" | "lines" | "angle">,
  ): BandAxisPlanTick[] =>
    entries.map((entry, i) => {
      const enriched = build(entry, i);
      return {
        value: entry.value,
        label: enriched.label,
        fullLabel: entry.label,
        labeled: i % every === 0,
        domainIndex: entry.domainIndex,
        ...(enriched.lines !== undefined && { lines: enriched.lines }),
        ...(enriched.angle !== undefined && { angle: enriched.angle }),
      };
    });

  const withPin = (plan: BandAxisPlan): BandAxisPlan =>
    authorPinned ? { ...plan, authorPinned: true } : plan;

  const singlePlan = (opts?: { reportOverlap?: boolean }): BandAxisPlan => {
    const ticks = buildTicks(1, (e) => ({ label: e.label }));
    const { alongOverhang, leftOverhang, marginOverflow } = capEndOverhang(
      ticks,
      entries,
      extentPx,
      marginCapPx,
      measurer,
      fontSize,
      ellipsis,
      true,
    );
    const degraded: GuideDegradedCode[] = [];
    if (marginOverflow) degraded.push("band-label-margin-overflow");
    let overlap = false;
    if (opts?.reportOverlap === true && entries.length > 0) {
      // Remeasure after end-cap truncation so shortened display labels are what
      // the overlap check sees (not the pre-truncation entry widths).
      overlap = neighbourOverlap(
        ticks.map((tick, i) => ({
          pos: entries[i]!.center,
          half: measurer.measureWidth(tick.label, fontSize) / 2,
        })),
        gap,
      );
      if (overlap) degraded.push("band-label-overlap");
    }
    return {
      mode: "single-line",
      angle: 0,
      ticks,
      labelEvery: 1,
      labelBandHeight: lineHeight,
      alongOverhang,
      leftOverhang,
      overlap,
      marginOverflow,
      degraded,
    };
  };

  const offPlan = (): BandAxisPlan => ({
    mode: "single-line",
    angle: 0,
    ticks: buildTicks(1, (e) => ({ label: e.label })).map((tick) => ({
      ...tick,
      labeled: false,
    })),
    labelEvery: 1,
    labelBandHeight: 0,
    alongOverhang: 0,
    leftOverhang: 0,
    overlap: false,
    marginOverflow: false,
    degraded: [],
    authorPinned: true,
  });

  const budget = (px: number) => (quantum > 0 ? Math.floor(px / quantum) * quantum : px);

  const verticalPlan = (): BandAxisPlan => {
    const widthCap = Math.max(1, budget(orthogonalMarginCapPx));
    const byCenter = entries
      .map((entry, index) => ({ index, center: entry.center }))
      .toSorted((a, b) => a.center - b.center);
    const overlaps = (every: number): boolean => {
      let previous: number | undefined;
      for (const entry of byCenter) {
        if (entry.index % every !== 0) continue;
        if (previous !== undefined && previous + lineHeight + gap > entry.center) return true;
        previous = entry.center;
      }
      return false;
    };
    const maxShownWidth = (every: number): number => {
      let max = 0;
      for (let i = 0; i < entries.length; i += every) max = Math.max(max, entries[i]!.width);
      return max;
    };

    let labelEvery = 1;
    const crowded = overlaps(1);
    let overlap = crowded;
    if (guideMode === "auto" && crowded && entries.length >= BAND_THIN_MIN_CATEGORIES) {
      while (overlaps(labelEvery) && labelEvery * 2 < entries.length) labelEvery *= 2;
      overlap = overlaps(labelEvery);
    }
    const densityEvery = labelEvery;

    let shownWidth = maxShownWidth(labelEvery);
    if (guideMode === "auto") {
      while (shownWidth > widthCap) {
        let probe = labelEvery * 2;
        let improvedEvery = 0;
        let improvedWidth = shownWidth;
        while (probe < entries.length) {
          const width = maxShownWidth(probe);
          if (width < shownWidth) {
            improvedEvery = probe;
            improvedWidth = width;
            break;
          }
          if (probe * 2 >= entries.length) break;
          probe *= 2;
        }
        if (improvedEvery === 0) break;
        labelEvery = improvedEvery;
        shownWidth = improvedWidth;
        overlap = overlaps(labelEvery);
      }
    }

    let startOverhang = 0;
    let endOverhang = 0;
    let marginOverflow = false;
    for (let i = 0; i < entries.length; i += labelEvery) {
      const center = entries[i]!.center;
      startOverhang = Math.max(startOverhang, lineHeight / 2 - center);
      endOverhang = Math.max(endOverhang, lineHeight / 2 - (extentPx - center));
    }

    const ticks = buildTicks(labelEvery, (entry, index) => {
      if (index % labelEvery !== 0 || entry.width <= widthCap) return { label: entry.label };
      const label = truncateToFit(entry.label, widthCap, measurer, fontSize, ellipsis);
      if (label !== entry.label) marginOverflow = true;
      return { label };
    });
    const degraded: GuideDegradedCode[] = crowded ? ["band-label-overlap"] : [];
    if (marginOverflow || labelEvery > densityEvery) degraded.push("band-label-margin-overflow");

    return withPin({
      mode: "single-line",
      angle: 0,
      ticks,
      labelEvery,
      labelBandHeight: quantizeUp(Math.min(shownWidth, widthCap), quantum),
      alongOverhang: Math.max(0, Math.min(marginCapPx, endOverhang)),
      leftOverhang: Math.max(0, Math.min(marginCapPx, startOverhang)),
      overlap,
      marginOverflow,
      degraded,
    });
  };

  // mode:off applies to every orientation (including vertical / coord_flip).
  if (guideMode === "off") return offPlan();

  if (input.orient === "vertical") return verticalPlan();
  if (entries.length === 0) return withPin(singlePlan());

  const bandBudget = budget(bandWidth);
  const orthoCap = budget(orthogonalMarginCapPx);

  /** Try a wrap layout. When `force`, keep mode even if tokens can't wrap / overlap. */
  const tryWrapPlan = (force: boolean): BandAxisPlan | null => {
    const wrapped = entries.map((e) =>
      wrapLabel(e.label, bandBudget, measurer, fontSize, maxWrapLines, { force }),
    );
    if (!force && !wrapped.every((w): w is string[] => w !== null)) return null;
    const linesList = wrapped as string[][];
    // Per-line widths; overlap uses top-aligned planes (matches renderer tspan stack),
    // not max(lineWidths) as a centered block — a longer line2 must not reject when
    // neighbours only occupy plane 0.
    const perLineWidths = linesList.map((lines) =>
      lines.map((l) => measurer.measureWidth(l, fontSize)),
    );
    const lineWidths = perLineWidths.map((widths) => Math.max(...widths));
    const maxLines = Math.max(...linesList.map((w) => w.length));
    const blockHeight = maxLines * lineHeight;
    const wrapOverlap = neighbourOverlapByPlane(
      entries.map((e, i) => ({
        pos: e.center,
        halfByPlane: perLineWidths[i]!.map((w) => w / 2),
      })),
      gap,
    );
    if (!force && (wrapOverlap || blockHeight > orthoCap)) return null;
    let wrapLeft = 0;
    let wrapRight = 0;
    for (let i = 0; i < entries.length; i++) {
      const half = lineWidths[i]! / 2;
      wrapLeft = Math.max(wrapLeft, half - entries[i]!.center);
      wrapRight = Math.max(wrapRight, half - (extentPx - entries[i]!.center));
    }
    // Oversize wrap lines (B3 alternate breaks) can overhang the panel; non-force
    // must not accept a layout that draws into chrome without a side budget.
    if (!force && (wrapLeft > marginCapPx + 1e-6 || wrapRight > marginCapPx + 1e-6)) {
      return null;
    }
    const degraded: GuideDegradedCode[] = [];
    let marginOverflow = false;
    if (force) {
      if (wrapOverlap) degraded.push("band-label-overlap");
      if (blockHeight > orthoCap) marginOverflow = true;
      if (wrapLeft > marginCapPx + 1e-6 || wrapRight > marginCapPx + 1e-6) {
        marginOverflow = true;
      }
      if (marginOverflow) degraded.push("band-label-margin-overflow");
    }
    return {
      mode: "wrapped",
      angle: 0,
      ticks: buildTicks(1, (_e, i) => {
        const lines = linesList[i]!;
        return { label: lines.join(" "), lines };
      }),
      labelEvery: 1,
      // Always reserve within the orthogonal cap; forced over-tall pins flag overflow.
      labelBandHeight: quantizeUp(Math.min(blockHeight, orthoCap), quantum),
      alongOverhang: Math.min(marginCapPx, Math.max(0, wrapRight)),
      leftOverhang: Math.min(marginCapPx, Math.max(0, wrapLeft)),
      overlap: force ? wrapOverlap : false,
      marginOverflow,
      degraded,
    };
  };

  const rotated = createRotatedBandPlanner({
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
  });
  const selectPlan = (): BandAxisPlan => {
    // Author pins never auto-escalate away from the chosen presentation.
    if (guideMode === "single") return withPin(singlePlan({ reportOverlap: true }));
    if (guideMode === "wrap") {
      return withPin(tryWrapPlan(true) ?? singlePlan({ reportOverlap: true }));
    }
    if (guideMode === "rotate") {
      return withPin(rotated.rotatedPlan(pinnedAngle ?? rotated.chooseAutoAngle()));
    }

    const floor = MODE_RANK[previousMode ?? "single-line"];
    if (floor <= MODE_RANK["single-line"]) {
      const singleOverlap = neighbourOverlap(
        entries.map((e) => ({ pos: e.center, half: e.width / 2 })),
        gap,
      );
      if (!singleOverlap) return singlePlan();
    }
    if (floor <= MODE_RANK.wrapped) {
      const wrapped = tryWrapPlan(false);
      if (wrapped !== null) return wrapped;
    }
    if (floor <= MODE_RANK.rotated) {
      const hybrid = rotated.tryHybridRotatePlan();
      if (hybrid !== null) return hybrid;
    }
    return rotated.rotatedPlan(pinnedAngle ?? rotated.chooseAutoAngle());
  };
  return selectPlan();
}
