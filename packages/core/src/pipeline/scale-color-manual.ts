/** Manual color/fill scale family (explicit domain ↔ range). */
import type { ColorScaleSpec } from "@ggts-sh/spec";

import { disambiguatedLabels } from "../domain-labels.js";
import { normalizeColor } from "../scales/color.js";
import type { ManualColorScale } from "../scales/non-position-color.js";
import { encodeKey } from "../scales/state.js";
import type { CellValue } from "../table.js";

import { fallbackColors, warnUnknownColors } from "./scale-color-family-helpers.js";
import type { ColorResolution } from "./scale-color-types.js";
import { PipelineError, type PipelineWarning } from "./types.js";

function uniqueValues(values: readonly CellValue[]): CellValue[] {
  const seen = new Set<string>();
  const output: CellValue[] = [];
  for (const value of values) {
    if (value === null) continue;
    const key = encodeKey(value);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

export function resolveManualColorScale(input: {
  name: "color" | "fill";
  values: readonly CellValue[];
  observedValues: readonly CellValue[];
  config: ColorScaleSpec;
  legendTitle: string;
  warnings: PipelineWarning[];
}): ColorResolution {
  const { name, values, observedValues, config, legendTitle, warnings } = input;
  const domain = (config.domain ?? uniqueValues(values)).filter(
    (value): value is CellValue => value !== null,
  );
  const colors = (config.range ?? []).map((color) => normalizeColor(color));
  if (domain.length !== colors.length) {
    throw new PipelineError(
      "color-manual-domain-range",
      `/scales/${name}`,
      `The manual ${name} scale needs one range color per domain value (${String(domain.length)} values, ${String(colors.length)} colors).`,
    );
  }
  const indexByKey = new Map(domain.map((value, index) => [encodeKey(value), index] as const));
  const { naValue, unknownValue } = fallbackColors(config);
  const scale: ManualColorScale = Object.freeze({
    type: "manual" as const,
    domain: Object.freeze([...domain]),
    colors: Object.freeze([...colors]),
    naValue,
    unknownValue,
    indexOf(value: unknown): number | undefined {
      try {
        return indexByKey.get(encodeKey(value));
      } catch {
        return undefined;
      }
    },
    colorOf(value: unknown): string | undefined {
      if (value === null || value === undefined) return naValue;
      const index = this.indexOf(value);
      return index === undefined ? unknownValue : colors[index];
    },
  });
  const labels = disambiguatedLabels(domain);
  const entries = domain.map((value, index) =>
    Object.freeze({ value, label: labels[index]!, color: colors[index]! }),
  );
  warnUnknownColors(
    name,
    observedValues.filter((value) => value !== null && scale.indexOf(value) === undefined).length,
    warnings,
  );
  const showGuide = entries.length > 0;
  return {
    resolved: { kind: "manual", scale },
    legendInput: showGuide
      ? {
          kind: "discrete",
          scale: name,
          title: legendTitle,
          domain,
          firstSeen: values,
          colorOf: (value: unknown) => scale.colorOf(value),
        }
      : null,
    guidePlan: showGuide
      ? Object.freeze({
          type: "discrete" as const,
          id: `guide:${name}`,
          aesthetic: name,
          scaleType: "manual" as const,
          title: legendTitle,
          domain: Object.freeze([...domain]),
          entries: Object.freeze(entries),
          naValue,
          unknownValue,
        })
      : null,
    state: null,
  };
}
