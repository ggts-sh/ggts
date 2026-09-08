import { registerBasicPoints, registerDefaultOrdinalColor } from "@ggts-sh/core/headless/register";

import { bundleScatterCanvas } from "../adapters/ggsvelte-canvas";

registerBasicPoints();
registerDefaultOrdinalColor();
import { makeScatter } from "../scenarios";

export const out = bundleScatterCanvas(makeScatter(1000));
