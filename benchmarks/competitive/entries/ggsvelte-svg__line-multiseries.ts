import { registerBasicLines, registerDefaultOrdinalColor } from "@ggts-sh/core/headless/register";

import { bundleLineSvg } from "../adapters/ggsvelte-svg";

registerBasicLines();
registerDefaultOrdinalColor();
import { makeMultiSeries } from "../scenarios";

export const out = bundleLineSvg(makeMultiSeries(3, 1000));
