import {
  buildInteractionMasks,
  buildPrimitiveInteractionMasks,
  type BatchInteractionMask,
  type CandidateFacts,
  type RenderModel,
} from "@ggts-sh/core";

import type { PlotInteractionInterval } from "../interaction/interaction.js";
import type { IntervalConsumptionCandidate } from "../interval/consumption.js";
import {
  anchorsFromCandidateKeys,
  applyEmphasisRingDensityGate,
  collectCandidates,
  mergePresentationFocusKeys,
  type PresentationAnchor,
  type PresentationInspectionFocus,
} from "../selection/selection.js";

type SemanticCandidate = IntervalConsumptionCandidate<PropertyKey> & {
  readonly x: number;
  readonly y: number;
  readonly batchIndex: number;
  readonly primitiveIndex: number;
  readonly kind: string;
};

/** Stable empty masks — avoid fresh `[]` identity churn on tooltip-only hover. */
const EMPTY_INTERACTION_MASKS = Object.freeze([]) as readonly (BatchInteractionMask | null)[];

/** OR two mask projections per batch (focused if either side is focused). */
function unionInteractionMasks(
  left: readonly (BatchInteractionMask | null)[],
  right: readonly (BatchInteractionMask | null)[],
): readonly (BatchInteractionMask | null)[] {
  const length = Math.max(left.length, right.length);
  const out: Array<BatchInteractionMask | null> = [];
  for (let i = 0; i < length; i++) {
    const a = left[i] ?? null;
    const b = right[i] ?? null;
    if (a === null) {
      out.push(b);
      continue;
    }
    if (b === null) {
      out.push(a);
      continue;
    }
    const count = Math.max(a.primitiveCount, b.primitiveCount);
    const values = new Uint8Array(count);
    let focusedCount = 0;
    for (let p = 0; p < count; p++) {
      const focused =
        (p < a.primitiveCount && a.isFocused(p)) || (p < b.primitiveCount && b.isFocused(p));
      if (focused) {
        values[p] = 1;
        focusedCount++;
      }
    }
    out.push(
      Object.freeze({
        primitiveCount: count,
        focusedCount,
        isFocused(primitiveIndex: number): boolean {
          return values[primitiveIndex] === 1;
        },
      }),
    );
  }
  return Object.freeze(out);
}

export type SemanticCandidateProjectionDeps = {
  model: () => RenderModel | null;
  candidateSemanticKeys: (candidate: CandidateFacts) => readonly PropertyKey[];
  selectedKeys: () => readonly PropertyKey[];
  intervalKeys: () => readonly PropertyKey[];
  intervals: () => readonly PlotInteractionInterval<PropertyKey>[];
  emphasisKeys: () => readonly PropertyKey[];
  /**
   * When true, rect inspection builds sibling-mute masks (#386 opt-in).
   * Default off — tooltip-only hover (#633).
   */
  muteSiblingsOnInspect?: () => boolean;
  inspectionFocus: () => PresentationInspectionFocus | null;
};

export type SemanticCandidateProjection = {
  readonly selectedAnchors: PresentationAnchor[];
  readonly emphasizedAnchors: PresentationAnchor[];
  readonly interactionMasks: readonly (BatchInteractionMask | null)[];
  readonly intervalConsumptionCandidates: readonly IntervalConsumptionCandidate<PropertyKey>[];
};

/**
 * Own the one semantic walk over CandidateStore and all presentation shapes
 * derived from it. Counts gate the walk so key-only changes reuse projection.
 */
export function createSemanticCandidateProjection(
  deps: SemanticCandidateProjectionDeps,
): SemanticCandidateProjection {
  const muteSiblingsOnInspect = $derived(deps.muteSiblingsOnInspect?.() === true);
  const presentationFocusKeys = $derived(
    mergePresentationFocusKeys(deps.emphasisKeys(), deps.inspectionFocus(), {
      muteSiblings: muteSiblingsOnInspect,
    }),
  );
  const selectedKeyCount = $derived(deps.selectedKeys().length);
  const emphasisKeyCount = $derived(deps.emphasisKeys().length);
  const presentationFocusKeyCount = $derived(presentationFocusKeys.length);
  const needIntervalConsumptionWalk = $derived(
    deps.intervals().length > 0 && deps.intervals()[0]?.preset !== "union",
  );
  // Non-union interval keys consume this projection, so do not read them until
  // the non-union gate has been handled.
  const intervalKeyCount = $derived(deps.intervalKeys().length);

  const sharedCandidateProjection = $derived.by((): SemanticCandidate[] => {
    if (
      !needIntervalConsumptionWalk &&
      selectedKeyCount + intervalKeyCount + emphasisKeyCount + presentationFocusKeyCount === 0
    ) {
      return [];
    }
    const model = deps.model();
    if (model === null) return [];
    return collectCandidates(model.candidates, (candidate) => {
      const batch = model.scene.batches[candidate.batchIndex];
      const width =
        batch?.kind === "glyphs" ? batch.boxWidths?.[candidate.primitiveIndex] : undefined;
      const height =
        batch?.kind === "glyphs" ? batch.boxHeights?.[candidate.primitiveIndex] : undefined;
      const textAnchor = batch?.kind === "glyphs" ? batch.anchor : undefined;
      return {
        x: candidate.x,
        y: candidate.y,
        kind: candidate.kind,
        batchIndex: candidate.batchIndex,
        primitiveIndex: candidate.primitiveIndex,
        panelId: candidate.panelId,
        keys: deps.candidateSemanticKeys(candidate),
        ...(candidate.xValue !== undefined && { xValue: candidate.xValue }),
        ...(candidate.yValue !== undefined && { yValue: candidate.yValue }),
        ...(width !== undefined &&
          height !== undefined && {
            width,
            height,
            ...(textAnchor !== undefined && { textAnchor }),
          }),
      };
    });
  });

  const intervalConsumptionCandidates = $derived.by(
    (): readonly IntervalConsumptionCandidate<PropertyKey>[] =>
      needIntervalConsumptionWalk ? sharedCandidateProjection : [],
  );
  // Selection: point rings stay on even for large sets (D2).
  const selectedAnchors = $derived(
    anchorsFromCandidateKeys(sharedCandidateProjection, [
      ...new Set([...deps.selectedKeys(), ...deps.intervalKeys()]),
    ]),
  );
  // Legend/controller emphasis: density-gate rings so dense point series mute
  // without a dashed-ring field; paths/rects already use chrome "none".
  const emphasizedAnchors = $derived(
    applyEmphasisRingDensityGate(
      anchorsFromCandidateKeys(sharedCandidateProjection, deps.emphasisKeys()),
    ),
  );
  const interactionMasks = $derived.by((): readonly (BatchInteractionMask | null)[] => {
    const model = deps.model();
    if (model === null) return EMPTY_INTERACTION_MASKS;
    const focus = deps.inspectionFocus();
    // Rect inspection primitives: muteSiblings opt-in, or layer under active
    // legend/controller emphasis so the seed bar stays focused (#386 / #633).
    const applyRectInspectionMask = muteSiblingsOnInspect || emphasisKeyCount > 0;
    const rectPrimitives =
      applyRectInspectionMask &&
      focus?.kind === "rects" &&
      focus.primitives !== undefined &&
      focus.primitives.length > 0
        ? focus.primitives
        : null;

    let keyMasks: readonly (BatchInteractionMask | null)[] | null = null;
    if (presentationFocusKeys.length > 0) {
      keyMasks = buildInteractionMasks(
        model.scene.batches,
        presentationFocusKeys,
        sharedCandidateProjection,
      );
    }
    // Keyless rect inspection: layer seed primitives so legend/controller
    // emphasis keys do not suppress the hovered bar's de-emphasis (#386).
    if (rectPrimitives === null) return keyMasks ?? EMPTY_INTERACTION_MASKS;
    const primitiveMasks = buildPrimitiveInteractionMasks(model.scene.batches, rectPrimitives);
    if (keyMasks === null) return primitiveMasks;
    return unionInteractionMasks(keyMasks, primitiveMasks);
  });

  return {
    get selectedAnchors() {
      return selectedAnchors;
    },
    get emphasizedAnchors() {
      return emphasizedAnchors;
    },
    get interactionMasks() {
      return interactionMasks;
    },
    get intervalConsumptionCandidates() {
      return intervalConsumptionCandidates;
    },
  };
}
