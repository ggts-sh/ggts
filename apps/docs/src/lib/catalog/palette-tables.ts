/**
 * Pure palette / ramp tables for docs chrome (pickers, swatches).
 *
 * Do not re-export these through `@ggts-sh/core`: the docs vite config puts
 * the whole core package into one shared chunk, so a barrel import of hex
 * tables would modulepreload the full chart stack on /themes and /palettes.
 * These deep source paths match the higher-priority `ggsvelte-palette-tables`
 * codeSplitting group instead.
 */
export { CATEGORICAL_SCHEMES } from "../../../../../packages/core/src/scales/categorical-palettes.js";
export { VIRIDIS_RAMP_10 } from "../../../../../packages/core/src/scales/viridis-ramp.js";
