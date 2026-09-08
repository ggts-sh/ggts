/**
 * Assemble a non-temporal AxisGuidePlan from measured ticks (continuous or band).
 */
import type { PositionScaleSpec } from "@ggts-sh/spec";

import type { PositionScale } from "../scales/train.js";
import type { CellValue } from "../table.js";
import type { AxisGuidePlan } from "./guide-plan-types.js";
import type { Tick } from "./layout-types.js";

export function planBasicAxis(input: {
  aesthetic: "x" | "y";
  panelIndex: number;
  scale: PositionScale;
  ticks: readonly Tick[];
  config: PositionScaleSpec | undefined;
}): AxisGuidePlan {
  const values = input.ticks.map((tick, index) =>
    input.scale.type === "band"
      ? tick.domainIndex === undefined
        ? (input.scale.rawDomain[index] as CellValue)
        : (input.scale.rawDomain[tick.domainIndex] as CellValue)
      : (tick.value as number),
  );
  const ticks = input.ticks.map((tick, index) => ({
    value: values[index]!,
    label: tick.labeled ? tick.label : "",
    fullLabel: tick.fullLabel ?? tick.label,
    kind: tick.kind ?? ("major" as const),
  }));
  const source = input.config?.breaks === undefined ? "automatic" : "explicit";
  return Object.freeze({
    type: "axis" as const,
    id: `axis:${input.aesthetic}:panel:${String(input.panelIndex)}`,
    aesthetic: input.aesthetic,
    panelIndex: input.panelIndex,
    scaleType: input.scale.type,
    transform: input.scale.type === "band" ? "identity" : input.scale.transform,
    temporalKind: null,
    domain:
      input.scale.type === "band"
        ? Object.isFrozen(input.scale.rawDomain)
          ? (input.scale.rawDomain as readonly CellValue[])
          : Object.freeze(input.scale.rawDomain.map((value) => value as CellValue))
        : Object.freeze([input.scale.domain[0], input.scale.domain[1]] as const),
    direction: input.config?.reverse === true ? ("descending" as const) : ("ascending" as const),
    source,
    interval: null,
    locale: null,
    timezone: null,
    ticks: Object.freeze(ticks.map((tick) => Object.freeze(tick))),
    ...(input.config?.breaks !== undefined && {
      sourceBreaks: Object.freeze([...input.config.breaks] as CellValue[]),
    }),
    overlap: false,
    marginOverflow: false,
    degraded: Object.freeze([]),
  });
}
