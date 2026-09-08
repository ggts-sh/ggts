// @lifecycle-default experimental
/**
 * Bundled teaching datasets — real, cited data for docs, examples and tests.
 *
 * Imported as `@ggsvelte/core/data` so a copy-pasted quickstart file builds
 * in a bare app with nothing but the published packages installed.
 */
export {
  BEER_PRODUCTION_CITATION,
  beerProduction,
  type BeerProductionRow,
} from "./beer-production.js";
export { CHOCOLATE_BARS_CITATION, chocolateBars, type ChocolateBarRow } from "./chocolate-bars.js";
export { COFFEE_RATINGS_CITATION, coffeeRatings, type CoffeeRatingRow } from "./coffee-ratings.js";
export { FASTFOOD_MENU_CITATION, fastfoodMenu, type FastfoodMenuRow } from "./fastfood-menu.js";
export { KYOTO_SAKURA_CITATION, kyotoSakura, type KyotoSakuraRow } from "./kyoto-sakura.js";
export { MPG_CITATION, mpg, type MpgRow } from "./mpg.js";
export {
  PALMER_PENGUINS_CITATION,
  palmerPenguins,
  type PalmerPenguinRow,
} from "./palmer-penguins.js";
