/**
 * US beer production by package type for a dodged-bar demo.
 *
 * Re-exported from the bundled beerProduction table so the example, the
 * package data export, and the docs JSON asset stay one table. Import the
 * source module (not `@ggts-sh/core/data`) so `check:scripts` typechecks
 * before packages/svelte dist is built.
 *
 * Source: US TTB national totals via TidyTuesday 2020-03-31. See NOTICE and
 * BEER_PRODUCTION_CITATION in @ggts-sh/core/data.
 */
export { beerProduction } from "../../../packages/core/src/data/beer-production.js";
