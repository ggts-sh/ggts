import { registerBasic } from "@ggts-sh/core";

import "./host-runtime.js";

// Default-entry registration contract (#1420): basic geoms, stats, color and
// style scale kinds, so identity charts work with no setup. The lean entry
// (`@ggts-sh/react/lean`) skips this; apps register only what they use.
registerBasic();
