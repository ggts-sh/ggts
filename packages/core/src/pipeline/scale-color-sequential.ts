/**
 * Sequential color/fill scale training and ramp legend input.
 */
import type { ColorScaleSpec } from "@ggts-sh/spec";

import type { EditionDefaults } from "../editions.js";
import type { CellValue } from "../table.js";

import { resolveSequentialLegendFormat } from "./scale-color-sequential-format.js";
import { sequentialColorResolution } from "./scale-color-sequential-result.js";
import { trainSequentialColorScale } from "./scale-color-sequential-train.js";
import type { ColorResolution } from "./scale-color-types.js";
import type { Advisory, PipelineWarning } from "./types.js";

export function resolveSequentialColorScale(input: {
  name: "color" | "fill";
  values: readonly CellValue[];
  anyDiscreteField: boolean;
  config: ColorScaleSpec | undefined;
  legendTitle: string;
  warnings: PipelineWarning[];
  advisories: Advisory[];
  editionDefaults: EditionDefaults;
}): ColorResolution {
  const { name, legendTitle, config, warnings } = input;
  const scale = trainSequentialColorScale(input);
  const format = resolveSequentialLegendFormat(scale, config, name, warnings);
  return sequentialColorResolution(name, legendTitle, scale, format);
}
