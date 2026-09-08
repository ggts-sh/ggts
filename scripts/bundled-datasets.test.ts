/**
 * Gate G2 — the bundled teaching datasets under `@ggts-sh/core/data` are
 * real, intact, and cover the guide shapes: time series (kyotoSakura),
 * categorical comparison (mpg, beerProduction, fastfoodMenu), continuous
 * distribution + groups (palmerPenguins, coffeeRatings), and dense scatter /
 * heatmaps (chocolateBars). Each assertion pins the docs static JSON asset to
 * the package export so headless agents and human imports cannot drift.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "bun:test";
import * as coreData from "@ggts-sh/core/data";
import * as svelteData from "../packages/svelte/src/lib/data/index.ts";

import {
  BEER_PRODUCTION_CITATION,
  CHOCOLATE_BARS_CITATION,
  COFFEE_RATINGS_CITATION,
  FASTFOOD_MENU_CITATION,
  KYOTO_SAKURA_CITATION,
  MPG_CITATION,
  PALMER_PENGUINS_CITATION,
  beerProduction,
  chocolateBars,
  coffeeRatings,
  fastfoodMenu,
  kyotoSakura,
  mpg,
  palmerPenguins,
  type BeerProductionRow,
  type ChocolateBarRow,
  type CoffeeRatingRow,
  type FastfoodMenuRow,
  type KyotoSakuraRow,
  type MpgRow,
  type PalmerPenguinRow,
} from "../packages/core/src/data/index.ts";

const STATIC = new URL("../apps/docs/static/", import.meta.url).pathname;
const NOTICE = readFileSync(new URL("../NOTICE", import.meta.url).pathname, "utf8");

it("the Svelte data compatibility entry forwards the same framework-neutral bindings", () => {
  expect(Object.keys(svelteData)).toEqual(Object.keys(coreData));
  for (const name of Object.keys(coreData) as (keyof typeof coreData)[]) {
    expect(svelteData[name]).toBe(coreData[name]);
  }
});

/** Median day-of-year over an inclusive year range. */
function medianDoy(from: number, to: number): number {
  const values = kyotoSakura
    .filter((row) => row.year >= from && row.year <= to)
    .map((row) => row.bloomDoy)
    .toSorted((a, b) => a - b);
  expect(values.length).toBeGreaterThan(20);
  return values[Math.floor(values.length / 2)]!;
}

function median(values: readonly number[]): number {
  const sorted = [...values].toSorted((a, b) => a - b);
  expect(sorted.length).toBeGreaterThan(0);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function mean(values: readonly number[]): number {
  expect(values.length).toBeGreaterThan(0);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

describe("kyotoSakura dataset", () => {
  it("spans the full record in year order with unique years", () => {
    expect(kyotoSakura).toHaveLength(838);
    expect(kyotoSakura[0]!.year).toBe(812);
    expect(kyotoSakura.at(-1)!.year).toBe(2026);
    expect(new Set(kyotoSakura.map((row) => row.year)).size).toBe(kyotoSakura.length);
    for (let i = 1; i < kyotoSakura.length; i += 1) {
      expect(kyotoSakura[i]!.year).toBeGreaterThan(kyotoSakura[i - 1]!.year);
    }
  });

  it("keeps every row internally consistent", () => {
    for (const row of kyotoSakura) {
      expect(row.bloomDate.startsWith(String(row.year).padStart(4, "0"))).toBe(true);
      expect(row.bloomDoy).toBeGreaterThanOrEqual(60);
      expect(row.bloomDoy).toBeLessThanOrEqual(160);
      // No reference-year projection: the month-day scale collapses the year,
      // so the dataset carries only what was observed. The column that used to
      // live here disagreed with `bloomDate` on every leap year.
      expect(row).not.toHaveProperty("bloomRefDate");
    }
  });

  it("carries the finding the lesson is built on", () => {
    // Stable near mid-April for a millennium...
    expect(medianDoy(812, 1200)).toBe(104);
    expect(medianDoy(1200, 1600)).toBe(105);
    expect(medianDoy(1600, 1850)).toBe(106);
    // ...then roughly a week earlier once industrial warming arrives.
    expect(medianDoy(1950, 2026)).toBe(98);
    expect(medianDoy(1600, 1850) - medianDoy(1950, 2026)).toBeGreaterThanOrEqual(7);
  });

  it("holds the three records the lesson annotates", () => {
    const byDoy = [...kyotoSakura].toSorted((a, b) => a.bloomDoy - b.bloomDoy);
    const earliest = byDoy[0]!;
    const latest = byDoy.at(-1)!;
    expect(earliest).toMatchObject({ year: 2023, bloomDate: "2023-03-25", bloomDoy: 84 });
    expect(latest).toMatchObject({ year: 1323, bloomDate: "1323-05-04", bloomDoy: 124 });
    // 1409 held the earliest-bloom record for six centuries: nothing observed
    // before 2021 blooms earlier, and both years that beat it are this century.
    const record1409 = kyotoSakura.find((row) => row.year === 1409);
    expect(record1409).toMatchObject({ bloomDate: "1409-03-27", bloomDoy: 86 });
    const beat1409 = kyotoSakura.filter(
      (row) => row.bloomDoy < 86 || (row.bloomDoy === 86 && row.year < 1409),
    );
    expect(beat1409.map((row) => row.year)).toEqual([2021, 2023]);
  });

  it("carries the modern years Aono's own file never reached", () => {
    // KyotoFullFlower7.xls stops at 2015. Everything after it comes from the
    // Arashiyama newspaper observations, published since 2025 by Genki Katata
    // (CIGS) rather than Aono, so those years need their own pin: our first
    // copy took 2026 from a mirror that predated Katata's table and was a day
    // late. Cross-checked against Katata and Our World in Data.
    expect(kyotoSakura.find((row) => row.year === 2015)).toMatchObject({
      bloomDate: "2015-04-03",
      bloomDoy: 93,
    });
    expect(kyotoSakura.find((row) => row.year === 2021)).toMatchObject({
      bloomDate: "2021-03-26",
      bloomDoy: 85,
    });
    expect(kyotoSakura.at(-1)).toMatchObject({
      year: 2026,
      bloomDate: "2026-03-29",
      bloomDoy: 88,
    });
  });

  it("names its source", () => {
    expect(KYOTO_SAKURA_CITATION).toContain("Aono");
    expect(KYOTO_SAKURA_CITATION).toContain("812");
    expect(KYOTO_SAKURA_CITATION).toContain("2026");
    expect(NOTICE).toContain("Yasuyuki Aono");
    // Aono's own site closed on 2025-03-31, so the notice has to point
    // somewhere a reader can actually reach: NOAA holds the archived file and
    // Katata publishes the continuing series.
    expect(NOTICE).toContain("ncei.noaa.gov");
    expect(NOTICE).toContain("Katata");
  });

  it("keeps the docs static asset identical to the package export", () => {
    const asset = JSON.parse(
      readFileSync(`${STATIC}kyoto-sakura.json`, "utf8"),
    ) as KyotoSakuraRow[];
    expect(asset).toEqual(kyotoSakura as KyotoSakuraRow[]);
  });
});

describe("palmerPenguins dataset", () => {
  it("is the complete-cases Palmer table in source order", () => {
    expect(palmerPenguins).toHaveLength(333);
    expect(palmerPenguins[0]).toMatchObject({
      id: "adelie-001",
      species: "Adelie",
      island: "Torgersen",
      billLengthMm: 39.1,
      bodyMassG: 3750,
    });
    expect(palmerPenguins.at(-1)).toMatchObject({
      id: "chinstrap-068",
      species: "Chinstrap",
      island: "Dream",
    });
    const species = new Map<string, number>();
    for (const row of palmerPenguins) {
      species.set(row.species, (species.get(row.species) ?? 0) + 1);
    }
    expect(Object.fromEntries(species)).toEqual({
      Adelie: 146,
      Gentoo: 119,
      Chinstrap: 68,
    });
  });

  it("keeps every row internally consistent", () => {
    const ids = new Set<string>();
    for (const row of palmerPenguins) {
      expect(ids.has(row.id)).toBe(false);
      ids.add(row.id);
      expect(["Adelie", "Chinstrap", "Gentoo"]).toContain(row.species);
      expect(["Biscoe", "Dream", "Torgersen"]).toContain(row.island);
      expect(["male", "female"]).toContain(row.sex);
      expect([2007, 2008, 2009]).toContain(row.year);
      expect(row.billLengthMm).toBeGreaterThan(30);
      expect(row.billLengthMm).toBeLessThan(60);
      expect(row.billDepthMm).toBeGreaterThan(12);
      expect(row.billDepthMm).toBeLessThan(22);
      expect(row.flipperLengthMm).toBeGreaterThan(160);
      expect(row.flipperLengthMm).toBeLessThan(240);
      expect(row.bodyMassG).toBeGreaterThan(2500);
      expect(row.bodyMassG).toBeLessThan(6500);
    }
    expect(ids.size).toBe(333);
  });

  it("carries the species body-mass separation the guide uses", () => {
    // Gentoo is the heavy species; Adelie and Chinstrap overlap much more.
    const adelie = palmerPenguins
      .filter((row) => row.species === "Adelie")
      .map((row) => row.bodyMassG);
    const gentoo = palmerPenguins
      .filter((row) => row.species === "Gentoo")
      .map((row) => row.bodyMassG);
    expect(median(adelie)).toBe(3700);
    expect(median(gentoo)).toBe(5050);
    expect(median(gentoo) - median(adelie)).toBeGreaterThanOrEqual(1000);
  });

  it("names its source", () => {
    expect(PALMER_PENGUINS_CITATION).toContain("Horst");
    expect(PALMER_PENGUINS_CITATION).toContain("CC0");
    expect(PALMER_PENGUINS_CITATION).toContain("Gorman");
    expect(NOTICE).toContain("palmerpenguins");
    expect(NOTICE).toContain("palmer-penguins.ts");
    expect(NOTICE).toContain("CC0");
  });

  it("keeps the docs static asset identical to the package export", () => {
    const asset = JSON.parse(
      readFileSync(`${STATIC}palmer-penguins.json`, "utf8"),
    ) as PalmerPenguinRow[];
    expect(asset).toEqual(palmerPenguins as PalmerPenguinRow[]);
  });
});

describe("mpg dataset", () => {
  it("is the 234-row popular-model EPA subset", () => {
    expect(mpg).toHaveLength(234);
    expect(mpg[0]).toMatchObject({
      manufacturer: "audi",
      model: "a4",
      displ: 1.8,
      year: 1999,
      class: "compact",
    });
    expect(mpg.at(-1)).toMatchObject({
      manufacturer: "volkswagen",
      model: "passat",
      year: 2008,
      class: "midsize",
    });
    expect(mpg.filter((row) => row.year === 1999)).toHaveLength(117);
    expect(mpg.filter((row) => row.year === 2008)).toHaveLength(117);
  });

  it("keeps every row internally consistent", () => {
    const classes = new Set([
      "2seater",
      "compact",
      "midsize",
      "minivan",
      "pickup",
      "subcompact",
      "suv",
    ]);
    for (const row of mpg) {
      expect(row.manufacturer.length).toBeGreaterThan(0);
      expect(row.model.length).toBeGreaterThan(0);
      expect(row.displ).toBeGreaterThan(0);
      expect(row.displ).toBeLessThan(8);
      expect([1999, 2008]).toContain(row.year);
      expect([4, 5, 6, 8]).toContain(row.cyl);
      expect(["f", "r", "4"]).toContain(row.drv);
      expect(row.cty).toBeGreaterThan(0);
      expect(row.hwy).toBeGreaterThanOrEqual(row.cty);
      expect(classes.has(row.class)).toBe(true);
      expect(row.fl.length).toBe(1);
    }
  });

  it("carries the class fuel-economy contrast the guide uses", () => {
    // Compacts beat SUVs on highway mpg — the classic categorical comparison.
    const compactHwy = mpg.filter((row) => row.class === "compact").map((row) => row.hwy);
    const suvHwy = mpg.filter((row) => row.class === "suv").map((row) => row.hwy);
    expect(compactHwy).toHaveLength(47);
    expect(suvHwy).toHaveLength(62);
    expect(mean(compactHwy)).toBeGreaterThan(28);
    expect(mean(suvHwy)).toBeLessThan(19);
    expect(mean(compactHwy) - mean(suvHwy)).toBeGreaterThan(8);
  });

  it("names its source", () => {
    expect(MPG_CITATION).toContain("EPA");
    expect(MPG_CITATION).toContain("fueleconomy.gov");
    expect(MPG_CITATION).toContain("ggplot2");
    expect(NOTICE).toContain("fueleconomy.gov");
    expect(NOTICE).toContain("mpg.ts");
  });

  it("keeps the docs static asset identical to the package export", () => {
    const asset = JSON.parse(readFileSync(`${STATIC}mpg.json`, "utf8")) as MpgRow[];
    expect(asset).toEqual(mpg as MpgRow[]);
  });
});

describe("chocolateBars dataset", () => {
  it("is the 2,530-row Flavors of Cacao table", () => {
    expect(chocolateBars).toHaveLength(2530);
    expect(chocolateBars[0]).toMatchObject({
      id: "bar-0001",
      companyLocation: "U.S.A.",
      cocoaPercent: 76,
      rating: 3.25,
    });
    expect(chocolateBars.at(-1)?.id).toMatch(/^bar-/);
  });

  it("keeps every row internally consistent", () => {
    const ids = new Set<string>();
    for (const row of chocolateBars) {
      expect(ids.has(row.id)).toBe(false);
      ids.add(row.id);
      expect(row.company.length).toBeGreaterThan(0);
      expect(row.companyLocation.length).toBeGreaterThan(0);
      expect(row.beanOrigin.length).toBeGreaterThan(0);
      expect(row.cocoaPercent).toBeGreaterThan(0);
      expect(row.cocoaPercent).toBeLessThanOrEqual(100);
      expect(row.rating).toBeGreaterThanOrEqual(1);
      expect(row.rating).toBeLessThanOrEqual(4);
    }
    expect(ids.size).toBe(2530);
  });

  it("names its source", () => {
    expect(CHOCOLATE_BARS_CITATION).toContain("Flavors of Cacao");
    expect(CHOCOLATE_BARS_CITATION).toContain("TidyTuesday");
    expect(NOTICE).toContain("chocolate-bars.ts");
    expect(NOTICE).toContain("flavorsofcacao.com");
  });

  it("keeps the docs static asset identical to the package export", () => {
    const asset = JSON.parse(
      readFileSync(`${STATIC}chocolate-bars.json`, "utf8"),
    ) as ChocolateBarRow[];
    expect(asset).toEqual(chocolateBars as ChocolateBarRow[]);
  });
});

describe("coffeeRatings dataset", () => {
  it("is the cleaned Coffee Quality Institute cupping table", () => {
    expect(coffeeRatings).toHaveLength(1338);
    expect(coffeeRatings[0]).toMatchObject({
      id: "lot-0001",
      species: "Arabica",
    });
    expect(coffeeRatings[0]!.totalCupPoints).toBeGreaterThan(80);
  });

  it("keeps every row internally consistent", () => {
    const ids = new Set<string>();
    for (const row of coffeeRatings) {
      expect(ids.has(row.id)).toBe(false);
      ids.add(row.id);
      expect(row.country.length).toBeGreaterThan(0);
      expect(row.totalCupPoints).toBeGreaterThan(0);
      expect(row.totalCupPoints).toBeLessThanOrEqual(100);
      expect(row.aroma).toBeGreaterThan(0);
      expect(row.flavor).toBeGreaterThan(0);
      if (row.altitudeM !== null) {
        expect(row.altitudeM).toBeGreaterThanOrEqual(200);
        expect(row.altitudeM).toBeLessThanOrEqual(3000);
      }
    }
    expect(ids.size).toBe(1338);
  });

  it("names its source", () => {
    expect(COFFEE_RATINGS_CITATION).toContain("Coffee Quality Institute");
    expect(COFFEE_RATINGS_CITATION).toContain("LeDoux");
    expect(NOTICE).toContain("coffee-ratings.ts");
    expect(NOTICE).toContain("coffee-quality-database");
  });

  it("keeps the docs static asset identical to the package export", () => {
    const asset = JSON.parse(
      readFileSync(`${STATIC}coffee-ratings.json`, "utf8"),
    ) as CoffeeRatingRow[];
    expect(asset).toEqual(coffeeRatings as CoffeeRatingRow[]);
  });
});

describe("beerProduction dataset", () => {
  it("is 36 national package-type totals for 2008–2019", () => {
    expect(beerProduction).toHaveLength(36);
    expect(beerProduction[0]).toMatchObject({
      year: "2008",
      package: "Bottles and cans",
    });
    expect(new Set(beerProduction.map((r) => r.year)).size).toBe(12);
    expect(new Set(beerProduction.map((r) => r.package))).toEqual(
      new Set(["Bottles and cans", "Kegs and barrels", "On premises"]),
    );
  });

  it("keeps every row internally consistent", () => {
    for (const row of beerProduction) {
      expect(Number(row.year)).toBeGreaterThanOrEqual(2008);
      expect(Number(row.year)).toBeLessThanOrEqual(2019);
      expect(row.barrelsMillions).toBeGreaterThan(0);
    }
  });

  it("names its source", () => {
    expect(BEER_PRODUCTION_CITATION).toContain("TTB");
    expect(BEER_PRODUCTION_CITATION).toContain("TidyTuesday");
    expect(NOTICE).toContain("beer-production.ts");
    expect(NOTICE).toContain("Tax and Trade Bureau");
  });

  it("keeps the docs static asset identical to the package export", () => {
    const asset = JSON.parse(
      readFileSync(`${STATIC}beer-production.json`, "utf8"),
    ) as BeerProductionRow[];
    expect(asset).toEqual(beerProduction as BeerProductionRow[]);
  });
});

describe("fastfoodMenu dataset", () => {
  it("is 515 entrée rows across eight chains", () => {
    expect(fastfoodMenu).toHaveLength(515);
    const chains = new Set(fastfoodMenu.map((r) => r.restaurant));
    expect(chains.size).toBe(8);
    expect(chains.has("McDonald's")).toBe(true);
  });

  it("keeps every row internally consistent", () => {
    const ids = new Set<string>();
    for (const row of fastfoodMenu) {
      expect(ids.has(row.id)).toBe(false);
      ids.add(row.id);
      expect(row.item.length).toBeGreaterThan(0);
      expect(row.calories).toBeGreaterThanOrEqual(0);
      expect(row.totalFat).toBeGreaterThanOrEqual(0);
      expect(row.protein).toBeGreaterThanOrEqual(0);
      expect(row.sodium).toBeGreaterThanOrEqual(0);
    }
    expect(ids.size).toBe(515);
  });

  it("names its source", () => {
    expect(FASTFOOD_MENU_CITATION).toContain("fastfoodnutrition.org");
    expect(FASTFOOD_MENU_CITATION).toContain("TidyTuesday");
    expect(NOTICE).toContain("fastfood-menu.ts");
    expect(NOTICE).toContain("fastfoodnutrition.org");
  });

  it("keeps the docs static asset identical to the package export", () => {
    const asset = JSON.parse(
      readFileSync(`${STATIC}fastfood-menu.json`, "utf8"),
    ) as FastfoodMenuRow[];
    expect(asset).toEqual(fastfoodMenu as FastfoodMenuRow[]);
  });
});
