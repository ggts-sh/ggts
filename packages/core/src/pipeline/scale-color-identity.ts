/** Identity color/fill scale family (pass-through source colors). */
import type { ColorScaleSpec } from "@ggts-sh/spec";

import { disambiguatedLabels } from "../domain-labels.js";
import { normalizeColor } from "../scales/color.js";
import type { IdentityColorScale } from "../scales/non-position-color.js";
import { encodeKey } from "../scales/state.js";
import type { CellValue } from "../table.js";

import { fallbackColors, warnUnknownColors } from "./scale-color-family-helpers.js";
import type { ColorResolution } from "./scale-color-types.js";
import type { PipelineWarning } from "./types.js";

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

export function resolveIdentityColorScale(input: {
  name: "color" | "fill";
  values: readonly CellValue[];
  config: ColorScaleSpec;
  legendTitle: string;
  warnings: PipelineWarning[];
}): ColorResolution {
  const { name, values, config, legendTitle, warnings } = input;
  const { naValue, unknownValue } = fallbackColors(config);
  const scale: IdentityColorScale = Object.freeze({
    type: "identity" as const,
    naValue,
    unknownValue,
    colorOf(value: unknown): string | undefined {
      if (value === null || value === undefined) return naValue;
      if (typeof value !== "string") return unknownValue;
      try {
        return normalizeColor(value);
      } catch {
        return unknownValue;
      }
    },
  });
  warnUnknownColors(
    name,
    values.filter(
      (value) =>
        value !== null &&
        (typeof value !== "string" || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)),
    ).length,
    warnings,
  );
  const forceGuide = config.guide?.type === "legend" && config.guide.force === true;
  const domain = forceGuide
    ? uniqueValues(
        values.filter((value): value is string => {
          if (typeof value !== "string") return false;
          try {
            normalizeColor(value);
            return true;
          } catch {
            return false;
          }
        }),
      )
    : [];
  const labels = disambiguatedLabels(domain);
  const entries = domain.map((value, index) =>
    Object.freeze({ value, label: labels[index]!, color: scale.colorOf(value) ?? unknownValue }),
  );
  return {
    resolved: { kind: "identity", scale },
    legendInput:
      domain.length === 0
        ? null
        : {
            kind: "discrete",
            scale: name,
            title: legendTitle,
            domain,
            firstSeen: values,
            colorOf: (value: unknown) => scale.colorOf(value),
          },
    guidePlan:
      domain.length === 0
        ? null
        : Object.freeze({
            type: "discrete" as const,
            id: `guide:${name}`,
            aesthetic: name,
            scaleType: "identity" as const,
            title: legendTitle,
            domain: Object.freeze([...domain]),
            entries: Object.freeze(entries),
            naValue,
            unknownValue,
          }),
    state: null,
  };
}
