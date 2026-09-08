/**
 * Cupping scores for a data-driven rug: one vertical rule per coffee lot.
 *
 * Re-exported from the bundled coffeeRatings table so the example, the package
 * data export, and the docs JSON asset stay one table. Import the source
 * module (not `@ggts-sh/core/data`) so `check:scripts` typechecks before
 * packages/svelte dist is built.
 *
 * Source: Coffee Quality Institute scores compiled by James LeDoux, via
 * TidyTuesday 2020-07-07 (CC0 curation). See NOTICE and COFFEE_RATINGS_CITATION.
 */
export { coffeeRatings } from "../../../packages/core/src/data/coffee-ratings.js";
