import type { ColorScaleSpec } from "@ggts-sh/spec";

import { CATEGORICAL_PALETTE_10 } from "../scales/categorical-palette-default.js";
import type { ScaleState } from "../scales/state.js";
import { PaletteExhaustedError } from "../scales/state.js";
import type { ColorScale } from "../scales/train-types.js";
import { trainDefaultColor } from "../scales/train-color-default.js";
import type { CellValue } from "../table.js";
import type { EditionDefaults } from "../editions.js";

import { ordinalColorResolution } from "./scale-color-ordinal-result.js";
import type { ColorResolution } from "./scale-color-types.js";
import { PipelineError, type Advisory, type PipelineWarning } from "./types.js";

/** Resolve ordinal color for default/explicit ranges without named palette catalogs. */
export function resolveDefaultOrdinalColorScale(input: {
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
  if (config?.scheme !== undefined && config.scheme !== "observable10") {
    throw new PipelineError(
      "unsupported-param",
      `/scales/${name}/scheme`,
      `Named color scheme ${JSON.stringify(config.scheme)} is not registered in this build. Call registerOrdinalColor() from @ggts-sh/core/headless/register once at startup.`,
    );
  }
  const editionRange =
    editionDefaults.categoricalPalette === CATEGORICAL_PALETTE_10
      ? undefined
      : editionDefaults.categoricalPalette;
  const range = config?.range ?? editionRange;
  let scale: ColorScale;
  try {
    scale = trainDefaultColor(values, prevState, {
      ...(config?.domain !== undefined && { domain: config.domain }),
      ...(config?.domainMode !== undefined && { domainMode: config.domainMode }),
      ...(range !== undefined && { range }),
      ...(config?.reverse !== undefined && { reverse: config.reverse }),
      ...(config?.onExhaust !== undefined && { onExhaust: config.onExhaust }),
    });
  } catch (error) {
    if (error instanceof PaletteExhaustedError) {
      throw new PipelineError("palette-exhausted", `/scales/${name}`, error.message);
    }
    throw error;
  }
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
