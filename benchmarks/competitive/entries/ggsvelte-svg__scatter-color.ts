import { registerBasicPoints, registerDefaultOrdinalColor } from "@ggts-sh/core/headless/register";

import { bundleScatterSvg } from "../adapters/ggsvelte-svg";

registerBasicPoints();
registerDefaultOrdinalColor();
import { makeScatter } from "../scenarios";

export const out = bundleScatterSvg(makeScatter(1000));
