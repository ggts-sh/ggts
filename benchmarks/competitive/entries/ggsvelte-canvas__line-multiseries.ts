import { registerBasicLines, registerDefaultOrdinalColor } from "@ggts-sh/core/headless/register";

import { bundleLineCanvas } from "../adapters/ggsvelte-canvas";

registerBasicLines();
registerDefaultOrdinalColor();
import { makeMultiSeries } from "../scenarios";

export const out = bundleLineCanvas(makeMultiSeries(3, 1000));
