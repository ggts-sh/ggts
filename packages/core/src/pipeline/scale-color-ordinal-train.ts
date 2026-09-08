/**
 * Train ordinal color scale with palette-exhaust handling.
 */
import type { ColorScaleSpec } from "@ggts-sh/spec";

import type { ScaleState } from "../scales/state.js";
import { PaletteExhaustedError } from "../scales/state.js";
import type { ColorScale } from "../scales/train.js";
import { trainColor } from "../scales/train.js";
import type { CellValue } from "../table.js";

import { PipelineError } from "./types.js";

export function trainOrdinalColorScale(input: {
  name: "color" | "fill";
  values: readonly CellValue[];
  config: ColorScaleSpec | undefined;
  prevState: ScaleState | null;
  range: readonly string[] | undefined;
}): ColorScale {
  const { name, values, config, prevState, range } = input;
  const scheme = config?.scheme;
  try {
    return trainColor(values, prevState, {
      ...(config?.domain !== undefined && { domain: config.domain }),
      ...(config?.domainMode !== undefined && { domainMode: config.domainMode }),
      ...(range !== undefined && { range }),
      ...(scheme !== undefined && { scheme }),
      ...(config?.reverse !== undefined && { reverse: config.reverse }),
      ...(config?.onExhaust !== undefined && { onExhaust: config.onExhaust }),
    });
  } catch (error) {
    if (error instanceof PaletteExhaustedError) {
      throw new PipelineError("palette-exhausted", `/scales/${name}`, error.message);
    }
    throw error;
  }
}
