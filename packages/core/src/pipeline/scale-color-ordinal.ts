/**
 * Ordinal (value-stable categorical) color/fill scale training and discrete legend.
 */
import type { ColorScaleSpec } from "@ggts-sh/spec";

import type { EditionDefaults } from "../editions.js";
import { resolveOrdinalPipelineRange } from "../scales/engine.js";
import type { ScaleState } from "../scales/state.js";
import type { CellValue } from "../table.js";

import { ordinalColorResolution } from "./scale-color-ordinal-result.js";
import { trainOrdinalColorScale } from "./scale-color-ordinal-train.js";
import type { ColorResolution } from "./scale-color-types.js";
import type { Advisory, PipelineWarning } from "./types.js";

export function resolveOrdinalColorScale(input: {
  name: "color" | "fill";
  values: readonly CellValue[];
  config: ColorScaleSpec | undefined;
  prevState: ScaleState | null;
  legendTitle: string;
  warnings: PipelineWarning[];
  advisories: Advisory[];
  editionDefaults: EditionDefaults;
}): ColorResolution {
  const { name, values, config, prevState, legendTitle, warnings, advisories, editionDefaults } =
    input;

  const range = resolveOrdinalPipelineRange(config, editionDefaults.categoricalPalette);
  const scale = trainOrdinalColorScale({ name, values, config, prevState, range });
  return ordinalColorResolution({
    name,
    values,
    config,
    legendTitle,
    scale,
    warnings,
    advisories,
  });
}
