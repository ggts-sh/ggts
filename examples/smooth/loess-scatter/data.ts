/**
 * Chocolate bar reviews for a loess demo: cocoa percent against expert rating.
 *
 * A ~400-row deterministic subsample of chocolateBars keeps loess interactive
 * on the gallery page while still looking dense. The full 2,530-row table
 * stays on `@ggsvelte/core/data` for consumers who want every review.
 *
 * Source: Flavors of Cacao via TidyTuesday 2022-01-18 (CC0 curation). See
 * NOTICE and CHOCOLATE_BARS_CITATION in @ggsvelte/core/data.
 */
import { chocolateBars } from "../../../packages/core/src/data/chocolate-bars.js";

/** Every Nth row from the bundled table (stable order, no RNG). */
const STRIDE = 6;

export const chocolateBarsSample = chocolateBars.filter((_, i) => i % STRIDE === 0);
