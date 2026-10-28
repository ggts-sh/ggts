/**
 * Highway fuel economy by vehicle class, grouped by drive train, for a
 * facet_grid(space = "free_x") demo.
 *
 * Re-exported from the bundled mpg table so the example, the package data
 * export, and the docs JSON asset stay one table. Import the source module
 * (not `@ggts-sh/core/data`) so `check:scripts` typechecks before
 * packages/svelte dist is built.
 *
 * Source: EPA fuel-economy tables via ggplot2's `mpg`. See NOTICE and
 * MPG_CITATION in @ggts-sh/core/data.
 */
import { mpg } from "../../../packages/core/src/data/mpg.js";

export { mpg };

/** Mean highway miles per gallon over all 234 cars (the dashed reference line). */
export const meanHwy = mpg.reduce((sum, row) => sum + row.hwy, 0) / mpg.length;
