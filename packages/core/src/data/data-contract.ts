/**
 * Compile-time contract for bundled datasets.
 *
 * A dataset is only useful if it can be handed straight to `<GGPlot data={…}>`
 * in a consumer's own type-checked app. That requires an implicit index
 * signature, which TypeScript grants type aliases and withholds from
 * interfaces — so declaring a row type as an `interface` compiles fine here
 * and then fails in the consumer, which is exactly what happened once.
 *
 * These assignments are the guard. They are types only: nothing is emitted,
 * and svelte-check fails the package build if a bundled dataset stops
 * satisfying the plot's data input.
 */
import type { DataInput } from "@ggsvelte/spec";

import { beerProduction } from "./beer-production.js";
import { chocolateBars } from "./chocolate-bars.js";
import { coffeeRatings } from "./coffee-ratings.js";
import { fastfoodMenu } from "./fastfood-menu.js";
import { kyotoSakura } from "./kyoto-sakura.js";
import { mpg } from "./mpg.js";
import { palmerPenguins } from "./palmer-penguins.js";

/** Every bundled dataset must be assignable to the plot `data` prop. */
type BundledDataset = DataInput;

const beerProductionIsPlottable: BundledDataset = beerProduction;
const chocolateBarsIsPlottable: BundledDataset = chocolateBars;
const coffeeRatingsIsPlottable: BundledDataset = coffeeRatings;
const fastfoodMenuIsPlottable: BundledDataset = fastfoodMenu;
const kyotoSakuraIsPlottable: BundledDataset = kyotoSakura;
const mpgIsPlottable: BundledDataset = mpg;
const palmerPenguinsIsPlottable: BundledDataset = palmerPenguins;
void beerProductionIsPlottable;
void chocolateBarsIsPlottable;
void coffeeRatingsIsPlottable;
void fastfoodMenuIsPlottable;
void kyotoSakuraIsPlottable;
void mpgIsPlottable;
void palmerPenguinsIsPlottable;
