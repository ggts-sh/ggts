import {
  disambiguatedLabels,
  encodeKey,
  type AxisEditModel,
  type PositionTransformName,
} from "./index.js";
import type { TemporalScaleKind } from "@ggsvelte/spec";

import type {
  BoundsAction,
  BoundsAxis,
  BoundsCategoryValue,
  BoundsEditorInput,
  BoundsScale,
} from "./bounds-editor.js";
import type { SemanticIntervalAxis } from "./interaction-types.js";

export interface BoundsEditorInputForScaleOptions {
  readonly axis: BoundsAxis;
  readonly action: BoundsAction;
  readonly scale: AxisEditModel;
  readonly bounds?: readonly [number, number] | readonly [BoundsCategoryValue, BoundsCategoryValue];
  readonly reversed?: boolean;
  /** From the axis guide plan; monthDay drafts format/parse as MM-DD. */
  readonly temporalKind?: TemporalScaleKind | null;
}

export function boundsEditorInputForScale(
  options: BoundsEditorInputForScaleOptions,
): BoundsEditorInput | null {
  const { scale } = options;
  if (scale.kind === "band") {
    // Typed categories can share a presentation label (1 and "1"); qualify
    // collisions so the two <select> options stay distinguishable.
    const labels = disambiguatedLabels(scale.rawDomain);
    const categories = scale.rawDomain.map((value, index) => ({
      value,
      label: labels[index] ?? String(value),
    }));
    const requested = options.bounds;
    const categoryValue = (bound: BoundsCategoryValue): BoundsCategoryValue | undefined => {
      if (typeof bound === "string") {
        const typed = categories.find((category) => encodeKey(category.value) === bound);
        if (typed !== undefined) return typed.value;
      }
      return categories.find((category) => Object.is(category.value, bound))?.value;
    };
    let bounds: readonly [BoundsCategoryValue, BoundsCategoryValue];
    if (requested === undefined) {
      bounds = [categories[0]?.value ?? "", categories.at(-1)?.value ?? ""] as const;
    } else {
      const lower = categoryValue(requested[0]);
      const upper = categoryValue(requested[1]);
      // A stored interval endpoint that no longer exists in the current band
      // catalog must not silently map to the first category — precise
      // editing is unavailable until the interval is reconciled.
      if (lower === undefined || upper === undefined) return null;
      bounds = [lower, upper] as const;
    }
    return {
      axis: options.axis,
      action: options.action,
      scale: "band",
      bounds,
      categories,
      reversed: options.reversed ?? scale.reversed,
    };
  }
  const requested = (options.bounds as readonly [number, number] | undefined) ?? scale.domain;
  const bounds =
    requested[0] <= requested[1]
      ? ([requested[0], requested[1]] as const)
      : ([requested[1], requested[0]] as const);
  if (scale.type === "time") {
    return {
      axis: options.axis,
      action: options.action,
      scale: "time",
      bounds,
      reversed: options.reversed ?? scale.reversed,
      ...(options.temporalKind !== undefined && { temporalKind: options.temporalKind }),
    };
  }
  return {
    axis: options.axis,
    action: options.action,
    scale: "linear",
    transform: scale.transform,
    bounds,
    reversed: options.reversed ?? scale.reversed,
  };
}

export function semanticAxisFromBounds(
  scale: BoundsScale,
  transform: PositionTransformName,
  bounds: readonly [number, number] | readonly [BoundsCategoryValue, BoundsCategoryValue],
): SemanticIntervalAxis {
  if (scale === "band") {
    return Object.freeze({
      kind: "band",
      values: Object.freeze(bounds.map((bound) => encodeKey(bound))),
    });
  }
  const first = bounds[0] as number;
  const second = bounds[1] as number;
  const domain: readonly [number, number] = Object.freeze(
    first <= second ? [first, second] : [second, first],
  );
  return Object.freeze({
    kind: scale,
    transform,
    domain,
  });
}
