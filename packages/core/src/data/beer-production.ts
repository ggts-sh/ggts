/**
 * Bundled teaching dataset: US beer production by package type.
 *
 * 36 rows: annual production (2008–2019) for the three package classes the TTB
 * reports at national total — bottles and cans, kegs and barrels, and on-premises
 * pours. Values are millions of barrels so dodged bars stay on a readable scale.
 * Covers dodged multi-series bars and simple time comparison.
 *
 * Sourced via TidyTuesday 2020-03-31 from Alcohol and Tobacco Tax and Trade
 * Bureau (TTB) materials. The TidyTuesday project releases its curated tables
 * under CC0 1.0; US government works are not subject to copyright in the United
 * States. See NOTICE and BEER_PRODUCTION_CITATION.
 */

/**
 * One national package-type total for a calendar year.
 *
 * Declared as a type alias, not an interface, so the rows carry an implicit
 * index signature and can be passed to `<GGPlot data={...}>` in a consumer app.
 */
export type BeerProductionRow = {
  year: string;
  package: string;
  barrelsMillions: number;
};

/**
 * 36 observations. Also served by the docs site as
 * `/beer-production.json` for headless consumers.
 */
export const beerProduction: readonly BeerProductionRow[] = [
  { year: "2008", package: "Bottles and cans", barrelsMillions: 166.93 },
  { year: "2008", package: "Kegs and barrels", barrelsMillions: 17.29 },
  { year: "2008", package: "On premises", barrelsMillions: 0.47 },
  { year: "2009", package: "Bottles and cans", barrelsMillions: 165.43 },
  { year: "2009", package: "Kegs and barrels", barrelsMillions: 17.46 },
  { year: "2009", package: "On premises", barrelsMillions: 0.47 },
  { year: "2010", package: "Bottles and cans", barrelsMillions: 162.97 },
  { year: "2010", package: "Kegs and barrels", barrelsMillions: 17.73 },
  { year: "2010", package: "On premises", barrelsMillions: 0.51 },
  { year: "2011", package: "Bottles and cans", barrelsMillions: 159.71 },
  { year: "2011", package: "Kegs and barrels", barrelsMillions: 17.82 },
  { year: "2011", package: "On premises", barrelsMillions: 0.55 },
  { year: "2012", package: "Bottles and cans", barrelsMillions: 161.69 },
  { year: "2012", package: "Kegs and barrels", barrelsMillions: 18.16 },
  { year: "2012", package: "On premises", barrelsMillions: 0.55 },
  { year: "2013", package: "Bottles and cans", barrelsMillions: 159.41 },
  { year: "2013", package: "Kegs and barrels", barrelsMillions: 18.1 },
  { year: "2013", package: "On premises", barrelsMillions: 0.57 },
  { year: "2014", package: "Bottles and cans", barrelsMillions: 158.54 },
  { year: "2014", package: "Kegs and barrels", barrelsMillions: 18.18 },
  { year: "2014", package: "On premises", barrelsMillions: 0.67 },
  { year: "2015", package: "Bottles and cans", barrelsMillions: 157.01 },
  { year: "2015", package: "Kegs and barrels", barrelsMillions: 17.75 },
  { year: "2015", package: "On premises", barrelsMillions: 1.28 },
  { year: "2016", package: "Bottles and cans", barrelsMillions: 155.42 },
  { year: "2016", package: "Kegs and barrels", barrelsMillions: 17.0 },
  { year: "2016", package: "On premises", barrelsMillions: 2.01 },
  { year: "2017", package: "Bottles and cans", barrelsMillions: 151.51 },
  { year: "2017", package: "Kegs and barrels", barrelsMillions: 16.51 },
  { year: "2017", package: "On premises", barrelsMillions: 2.66 },
  { year: "2018", package: "Bottles and cans", barrelsMillions: 148.1 },
  { year: "2018", package: "Kegs and barrels", barrelsMillions: 15.66 },
  { year: "2018", package: "On premises", barrelsMillions: 3.13 },
  { year: "2019", package: "Bottles and cans", barrelsMillions: 148.59 },
  { year: "2019", package: "Kegs and barrels", barrelsMillions: 14.88 },
  { year: "2019", package: "On premises", barrelsMillions: 3.61 },
];

/** Short citation for chart captions and README-style attribution. */
export const BEER_PRODUCTION_CITATION =
  "US beer production by package type, 2008–2019 (national totals, millions of barrels). " +
  "Source measurements: US Alcohol and Tobacco Tax and Trade Bureau (TTB), " +
  "via TidyTuesday 2020-03-31 (https://github.com/rfordatascience/tidytuesday).";
