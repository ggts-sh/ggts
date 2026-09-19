import { installCandidates, registerBasic } from "@ggts-sh/core";

import { ensureReactPlotChrome } from "./plot-chrome.js";

registerBasic();
installCandidates();
ensureReactPlotChrome();
