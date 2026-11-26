/**
 * Selected SVG comparisons drawn with the headless renderer.
 * The generator reads a committed measurement snapshot; bars sort by
 * measured time, fastest first.
 */
import { registerAll, renderToSVGString } from "@ggts-sh/core";

// Headless full-grammar rendering (#1420): explicit opt-in.
registerAll();

import type { PortableSpec, ThemeSpec } from "@ggts-sh/spec";
import { validate } from "@ggts-sh/spec";

/** Docs site accent (app.css --accent, light site) — the ggsvelte bar. */
export const BENCH_GGSVELTE_FILL = "#4269d0";
/** Dark-shell accent (app.css --accent under data-theme="dark"). */
export const BENCH_GGSVELTE_FILL_DARK = "#7ea1f0";
/** Neutral grey for peer bars — only the subject is shaded. */
export const BENCH_PEER_FILL = "#c9cfda";

/** Clean card look: no grid, no panel border, transparent strips (bun-style). */
const BENCH_THEME: ThemeSpec = {
  name: "light",
  grid: "transparent",
  panelBorder: "transparent",
  stripFill: "transparent",
};

/**
 * Fallbacks baked into the dark-site SVG (`bench-*-dark-site.svg`). These
 * mirror MARKS_ONLY_DARK_SITE_ROLES + the dark-shell accent: transparent
 * paper (host card bg shows through), light ink/axis/ticks. Peer grey and
 * band/measure positions are unchanged; only chrome recolors.
 */
const DARK_SITE_FALLBACKS: Record<string, string> = {
  "var(--gg-paper, #ffffff)": "var(--gg-paper, transparent)",
  "var(--gg-panel, #ffffff)": "var(--gg-panel, transparent)",
  "var(--gg-ink, #333333)": "var(--gg-ink, #e9edf4)",
  "var(--gg-stripText, #333333)": "var(--gg-stripText, #e9edf4)",
  "var(--gg-axisText, #4d4d4d)": "var(--gg-axisText, #aab4c4)",
  "var(--gg-tickColor, #b3b3b3)": "var(--gg-tickColor, #e9edf4)",
  // Subject bar accent: dark-shell blue.
  [BENCH_GGSVELTE_FILL]: BENCH_GGSVELTE_FILL_DARK,
};

/**
 * Produce the dark-site variant of a rendered light SVG by rebaking the
 * var(--gg-*) fallback literals. External <img>-loaded SVGs cannot inherit
 * host CSS custom properties, so the dark portrait is a separate file whose
 * fallbacks are already dark — same convention as theme-*-dark-site.svg.
 */
export function benchmarkChartDarkSiteSvg(lightSvg: string): string {
  let out = lightSvg;
  for (const [from, to] of Object.entries(DARK_SITE_FALLBACKS)) {
    out = out.split(from).join(to);
  }
  return out;
}

export interface BenchmarkBar {
  /** Display name on the band axis, e.g. "ggsvelte". */
  readonly lib: string;
  readonly value: number;
  readonly kind: "ggsvelte" | "peer";
  /** Rendered value label at the bar end, e.g. "75.5 ms". */
  readonly label: string;
}

export interface BenchmarkChartInput {
  readonly id: string;
  /** Bars in any order — the band domain is derived from `value`. */
  readonly bars: readonly BenchmarkBar[];
  /** Plot title drawn above the panel (self-describes README <img> embeds). */
  readonly title: string;
  /** Plot subtitle under the title (e.g. "Cold-mount milliseconds · lower is better"). */
  readonly subtitle: string;
  /** Accessible summary baked into the SVG aria-label and <title>. */
  readonly ariaLabel: string;
}

export const BENCHMARK_GRID = {
  filename: "bench-core-svg-grid.svg",
  width: 720,
  height: 370,
};

/** Library names in ascending mount time. Ties break on the library name. */
function libsByAscendingValue(bars: readonly BenchmarkBar[]): readonly string[] {
  return bars
    .toSorted((a, b) => a.value - b.value || a.lib.localeCompare(b.lib))
    .map((bar) => bar.lib);
}

/**
 * Horizontal bar chart spec (coord flip): lower-is-better time benchmarks.
 * The quantitative axis is hidden (guides y none) — bar-end labels carry the
 * values, like bun's bundler chart. The title and subtitle identify the
 * workload on the homepage tab.
 */
export function benchmarkChartSpec(input: BenchmarkChartInput): PortableSpec {
  return {
    ...benchmarkBarsSpec(libsByAscendingValue(input.bars)),
    data: { values: input.bars.map((bar) => ({ ...bar })) },
    labs: { title: input.title, subtitle: input.subtitle, x: "" },
  };
}

function benchmarkBarsSpec(libs: readonly string[], labelSize = 12): PortableSpec {
  return {
    aes: { x: { field: "lib" }, y: { field: "value" } },
    layers: [
      {
        geom: "col",
        aes: { fill: { field: "kind" } },
        params: { width: 0.62 },
      },
      {
        geom: "text",
        aes: { label: { field: "label" } },
        // Under coord flip, pre-flip dy pushes the label past the bar end.
        params: { anchor: "start", dx: 0, dy: -6, size: labelSize },
      },
    ],
    scales: {
      // Coord flip paints the first band at the bottom.
      x: { type: "band", domain: [...libs], reverse: true },
      // Start bars next to the library labels and leave room for end labels.
      y: { type: "linear", zero: true, expand: { mult: [0, 0.49] } },
      fill: {
        type: "manual",
        domain: ["ggsvelte", "peer"],
        range: [BENCH_GGSVELTE_FILL, BENCH_PEER_FILL],
      },
    },
    coord: { type: "flip" },
    guides: { fill: { type: "none" }, y: { type: "none" } },
    theme: BENCH_THEME,
  };
}

export function benchmarkGridSpec(
  panels: readonly { chart: BenchmarkChartInput; facetLabel: string }[],
  libs: readonly string[],
): PortableSpec {
  const bars = benchmarkBarsSpec(libs, 14);
  return {
    ...bars,
    data: {
      values: panels.flatMap(({ chart, facetLabel }) =>
        chart.bars.map((bar) => ({ ...bar, workload: facetLabel })),
      ),
    },
    facet: {
      wrap: { field: "workload", levels: panels.map((panel) => panel.facetLabel) },
      ncol: 2,
      // Free scales let each workload train its own time axis and draw the
      // library labels in both columns. The pinned library domain keeps the order.
      scales: "free",
    },
    labs: {
      title: "SVG chart benchmarks",
      subtitle: "Median time including paint · Lower is better",
      x: "",
    },
    theme: { ...BENCH_THEME, axisTextSize: 14, stripSize: 14, stripWeight: 650, ticksY: false },
  };
}

export function benchmarkGridLabel(
  panels: readonly { chart: BenchmarkChartInput; facetLabel: string }[],
): string {
  return `SVG chart benchmarks. Median time including paint. Lower is better. ${panels
    .map(
      ({ chart, facetLabel }) =>
        `${facetLabel}. ${chart.bars.map((bar) => `${bar.lib} ${bar.label}`).join(", ")}.`,
    )
    .join(" ")}`;
}

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Validate (the agent contract, dogfooded) and render to a standalone SVG
 * with a descriptive accessible name. Throws on any validation error so a
 * broken chart can never reach the homepage.
 */
export function benchmarkChartSvg(
  input: BenchmarkChartInput,
  options: { readonly width: number; readonly height: number },
): string {
  return renderBenchmarkSvg(benchmarkChartSpec(input), input.id, input.ariaLabel, options);
}

export function renderBenchmarkSvg(
  spec: PortableSpec,
  id: string,
  ariaLabel: string,
  options: { readonly width: number; readonly height: number },
): string {
  const result = validate(spec);
  if (!result.ok) {
    const first = result.errors[0];
    throw new Error(
      `benchmark chart "${id}" failed validation: ${first?.code} at ${first?.path}: ${first?.message}`,
    );
  }
  const label = escapeXml(ariaLabel);
  return renderToSVGString(spec, options)
    .replace(/aria-label="[^"]*"/, `aria-label="${label}"`)
    .replace(/<title>[^<]*<\/title>/, `<title>${label}</title>`);
}
