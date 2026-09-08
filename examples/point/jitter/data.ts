/**
 * Fast-food entrée calories for a position-jitter demo (paired with
 * jitter/basic, which uses the dedicated jitter geom).
 *
 * Re-exported from the bundled fastfoodMenu table so the example, the package
 * data export, and the docs JSON asset stay one table. Import the source
 * module (not `@ggts-sh/core/data`) so `check:scripts` typechecks before
 * packages/svelte dist is built.
 *
 * Source: fastfoodnutrition.org via TidyTuesday 2018-09-04 (CC0 curation).
 * See NOTICE and FASTFOOD_MENU_CITATION in @ggts-sh/core/data.
 */
export { fastfoodMenu } from "../../../packages/core/src/data/fastfood-menu.js";
