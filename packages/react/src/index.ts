// @ggts-sh/react — React DOM adapter. Registers the basic grammar on import,
// then re-exports the lean entry (./lean.ts holds the export list).
// @lifecycle-default experimental

import "./host-init.js";

export * from "./lean.js";
