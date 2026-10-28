import { installCandidates } from "@ggts-sh/core";

import { ensureReactPlotChrome } from "./plot-chrome.js";

// Every GGPlot needs these, on both the default and the lean entry:
// interaction candidates (#1421) and the plot chrome stylesheet.
installCandidates();
ensureReactPlotChrome();
