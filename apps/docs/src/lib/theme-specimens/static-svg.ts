/**
 * Static SVG shells for /themes multi-plot pages.
 *
 * Live <GGPlot> trees are expensive to hydrate (full interaction controllers).
 * SSR + first client paint use these strings so the page is readable and
 * full-width immediately; user intent (hover/focus) upgrades to interactive.
 */
import { registerAll, renderToSVGString } from "@ggts-sh/core";

// Headless full-grammar rendering (#1420): explicit opt-in.
registerAll();
import {
  aes,
  gg,
  scaleFillContinuous,
  scaleXDate,
  scaleXLog10,
  type AuthoringRows,
  type ThemeName,
  type ThemeSpec,
} from "@ggts-sh/spec";

import { MONTH_BREAKS, type SchemeName, type ThemeSpecimenKind } from "./catalog.js";
import {
  attendees,
  cities,
  countries,
  generation,
  grid,
  longRunSeries,
  penguins,
  revenue,
  ridership,
  sohoNeighbourhoodDeaths,
  sohoPumpNeighbourhoods,
  temperaturesKeyed,
} from "./data.js";
import { paletteSpecimenChart } from "./palette-bars.js";
import { TEMPERATURES_CHART } from "./temperatures-chart.js";

/** Matches packages/svelte DEFAULT_PLOT_WIDTH_PX and docs .plot-panel max. */
export const DOCS_STATIC_PLOT_WIDTH_PX = 832;

const cache = new Map<string, string>();

/**
 * Headless SVG uses fixed ids (`gg-clip-0`, `gg-ramp-fill`). Multiple shells on
 * one page collide (url(#id) is document-scoped). Namespace each shell so
 * clip/ramp references stay local to that SVG.
 */
function namespaceSvgIds(svg: string, key: string): string {
  const prefix = `s${key.replaceAll(/[^a-zA-Z0-9_-]/g, "_")}`;
  return svg
    .replaceAll(/id="(gg-[^"]+)"/g, `id="${prefix}-$1"`)
    .replaceAll(/url\(#(gg-[^)]+)\)/g, `url(#${prefix}-$1)`);
}

export type ThemeStaticSvgInput = {
  readonly name: ThemeName;
  readonly kind: ThemeSpecimenKind;
  readonly scheme: SchemeName;
  readonly width?: number;
  readonly height?: number;
  /**
   * Role overrides merged onto the named theme (e.g. dark-site ink for
   * marks-only void/map/solid portraits).
   */
  readonly themeRoles?: Readonly<
    Partial<Pick<ThemeSpec, "ink" | "axisText" | "axisLine" | "tickColor">>
  >;
};

function colorScale(scheme: SchemeName) {
  return { type: "ordinal" as const, scheme };
}

/** Named theme, or ThemeSpec object when role overrides are present. */
function themeArg(input: ThemeStaticSvgInput): ThemeName | ThemeSpec {
  const roles = input.themeRoles;
  if (roles === undefined || Object.keys(roles).length === 0) return input.name;
  return { name: input.name, ...roles };
}

function buildThemeSpec(input: ThemeStaticSvgInput) {
  const { kind, scheme } = input;
  const color = colorScale(scheme);
  const theme = themeArg(input);

  switch (kind) {
    case "temps-line": {
      const chart = TEMPERATURES_CHART;
      return gg(temperaturesKeyed, aes(chart.aes))
        .geomLine({ linewidth: chart.geomLine.linewidth })
        .geomPoint({ size: chart.geomPoint.size })
        .scales({
          x: { breaks: [...chart.monthBreaks] },
          color,
        })
        .theme(theme)
        .labs({ ...chart.labs })
        .spec();
    }
    case "ridership-line":
      return gg(ridership, aes({ x: "month", y: "riders", color: "mode" }))
        .geomLine({ linewidth: 2 })
        .geomPoint({ size: 2.8 })
        .scales({ color })
        .theme(theme)
        .labs({
          title: "Wheat price and a mechanic's weekly wage",
          subtitle: "One quarter of wheat (~8 bushels) vs a week's pay — both in shillings",
          x: "Year",
          y: "Shillings",
          color: "Series",
        })
        .spec();
    case "attendees-dodge":
      return gg(attendees, aes({ x: "track", fill: "level", weight: "deaths" }))
        .geomBar({ position: "dodge" })
        .scales({ fill: color })
        .theme(theme)
        .labs({
          title: "Edgeworth county deaths, 1876–82",
          x: "Year",
          y: "Deaths per million",
          fill: "County",
        })
        .spec();
    case "generation-area":
      // ISO month dates + scaleXDate: same contract as examples/area/stacked.
      // Do not re-encode months as year+month/12 linear numbers — that paints
      // axes/tooltips as decimals (1855.9) and silently mislabels the unit.
      return gg(generation, aes({ x: "year", y: "twh", fill: "source" }))
        .geomArea({ alpha: 0.9 })
        .scales({ ...scaleXDate({ labels: "%b %Y" }), fill: color })
        .theme(theme)
        .labs({
          title: "Crimean deaths by cause, 1854–56",
          x: "Month",
          y: "Deaths per 1,000 per year",
          fill: "Cause",
        })
        .spec();
    case "long-run-line":
      return gg(longRunSeries, aes({ x: "year", y: "value" }))
        .geomLine({ linewidth: 1.5 })
        .theme(theme)
        .labs({
          title: "British exports, 1855–1899",
          x: "Year",
          y: "£ millions",
        })
        .spec();
    case "penguins-scatter":
      return gg(penguins, aes({ x: "flipper", y: "mass", color: "species" }))
        .geomPoint({ size: 3.5, alpha: 0.9 })
        .scales({ color })
        .theme(theme)
        .labs({
          title: "Penguin flipper length and body mass",
          x: "Flipper length (mm)",
          y: "Body mass (g)",
          color: "Species",
        })
        .spec();
    case "countries-scatter":
      return gg(countries, aes({ x: "gdp", y: "lifeExp", color: "region" }))
        .geomPoint({ size: 3.5 })
        .geomSmooth({ method: "lm", se: false })
        .scales({ ...scaleXLog10({ labels: "~s" }), color })
        .theme(theme)
        .labs({
          title: "Cholera death rate vs density, 1849",
          x: "People per acre (log scale)",
          y: "Death rate per 10,000",
          color: "Water supply",
        })
        .spec();
    case "revenue-cols":
      return gg(revenue, aes({ x: "quarter", y: "amount" }))
        .geomCol({ width: 0.7 })
        .geomText({ aes: { label: "label" }, dy: -8, size: 11 })
        .theme(theme)
        .labs({
          title: "Salk trial paralytic polio rates",
          x: "Group",
          y: "Cases per 100,000",
        })
        .spec();
    case "cities-labels":
      return gg(cities, aes({ x: "rent", y: "livability" }))
        .geomPoint({ size: 3 })
        .geomText({ aes: { label: "city" }, dy: -9, size: 10 })
        .scales({ x: { labels: ".1f" } })
        .theme(theme)
        .labs({
          title: "Van Langren longitude estimates, 1644",
          x: "Toledo–Rome longitude (°)",
          y: "Estimate rank",
        })
        .spec();
    case "soho-choropleth":
      // Marks-only map theme needs a map-shaped mark: geom_map choropleth, not a scatter.
      return gg(sohoNeighbourhoodDeaths, aes({ map_id: "pump", fill: "deaths" }))
        .geomMap({
          map: { values: sohoPumpNeighbourhoods },
          mapId: "pump",
          linewidth: 1.2,
          alpha: 0.95,
        })
        .scales(scaleFillContinuous({ scheme: "viridis" }))
        .coordFixed()
        .theme(theme)
        .labs({
          title: "1854 Soho cholera deaths by pump neighbourhood",
          fill: "Deaths",
        })
        .spec();
    default: {
      const exhaustive: never = kind;
      throw new Error(`unhandled theme specimen kind: ${String(exhaustive)}`);
    }
  }
}

export function themeSpecimenStaticSvg(input: ThemeStaticSvgInput): string {
  const width = input.width ?? DOCS_STATIC_PLOT_WIDTH_PX;
  const height = input.height ?? 380;
  const rolesKey = input.themeRoles === undefined ? "" : `:${JSON.stringify(input.themeRoles)}`;
  const key = `${input.name}:${input.kind}:${input.scheme}:${String(width)}x${String(height)}${rolesKey}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const svg = namespaceSvgIds(renderToSVGString(buildThemeSpec(input), { width, height }), key);
  cache.set(key, svg);
  return svg;
}

export function temperaturesStaticSvg(input: {
  readonly theme: ThemeName;
  readonly scheme: SchemeName;
  readonly height?: number;
  readonly width?: number;
}): string {
  return themeSpecimenStaticSvg({
    name: input.theme,
    kind: "temps-line",
    scheme: input.scheme,
    height: input.height ?? 400,
    ...(input.width === undefined ? {} : { width: input.width }),
  });
}

export function paletteSpecimenStaticSvg(input: {
  readonly scheme: SchemeName;
  readonly capacity: number;
  readonly reverse: boolean;
  readonly paperTheme: ThemeName;
  readonly width?: number;
  readonly height?: number;
}): string {
  const chart = paletteSpecimenChart(input.capacity);
  const width = input.width ?? DOCS_STATIC_PLOT_WIDTH_PX;
  const height = input.height ?? chart.height;
  const key = `palette:${input.scheme}:${String(input.capacity)}:${String(input.reverse)}:${input.paperTheme}:${String(width)}x${String(height)}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let builder = gg(chart.rows, aes({ x: "category", y: "value", fill: "category" }))
    .geomCol({ width: 0.75 })
    .scales({
      fill: { type: "ordinal", scheme: input.scheme, reverse: input.reverse },
    })
    .guides({ fill: { type: "none" } })
    .theme(input.paperTheme)
    .labs({
      title: chart.title,
      x: chart.x,
      y: chart.y,
    });
  if (chart.flip) {
    builder = builder.coord("flip");
  }
  const spec = builder.spec();
  const svg = namespaceSvgIds(renderToSVGString(spec, { width, height }), key);
  cache.set(key, svg);
  return svg;
}

// Keep MONTH_BREAKS referenced so static temps stay aligned with live chart.
void MONTH_BREAKS;

/** Sequential Macdonell raster — static shell before SequentialColorLabLive hydrates. */
export function sequentialRasterStaticSvg(input: {
  readonly label: string;
  readonly scale: import("@ggts-sh/spec").ColorScaleSpec;
  readonly width?: number;
  readonly height?: number;
}): string {
  const width = input.width ?? DOCS_STATIC_PLOT_WIDTH_PX;
  const height = input.height ?? 360;
  const key = `seq:${input.label}:${JSON.stringify(input.scale)}:${String(width)}x${String(height)}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const spec = gg(grid, aes({ x: "x", y: "y", fill: "z" }))
    .geomRaster()
    .scales({ fill: input.scale })
    .theme("light")
    .labs({
      title: `${input.label} Macdonell counts`,
      x: "Finger index",
      y: "Height index",
      fill: "Men",
    })
    .spec();
  const svg = namespaceSvgIds(renderToSVGString(spec, { width, height }), key);
  cache.set(key, svg);
  return svg;
}

/**
 * Homepage grammar-demo shell: full palmerPenguins scatter + loess (color +
 * smooth). Static only — no inspect/legendFocus. Matches GrammarDemoPlot
 * mark layers; live plot adds Inspect + GuideLegend focus on upgrade.
 */
export function homeGrammarStaticSvgFromData(
  rows: readonly Record<string, unknown>[],
  input?: {
    readonly theme?: ThemeName;
    readonly width?: number;
    readonly height?: number;
  },
): string {
  const theme = input?.theme ?? "default";
  const width = input?.width ?? DOCS_STATIC_PLOT_WIDTH_PX;
  const height = input?.height ?? 400;
  const key = `home-grammar:${theme}:${String(width)}x${String(height)}:${String(rows.length)}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const spec = gg(
    rows as AuthoringRows,
    aes({ x: "flipperLengthMm", y: "bodyMassG", color: "species" }),
  )
    .geomJitter({ alpha: 0.88 })
    .geomSmooth({ method: "loess", span: 0.75, degree: 1, se: false })
    .theme(theme)
    .labs({
      x: "Flipper length mm",
      y: "Body mass g",
      color: "species",
    })
    .spec();
  const svg = namespaceSvgIds(renderToSVGString(spec, { width, height }), key);
  cache.set(key, svg);
  return svg;
}
