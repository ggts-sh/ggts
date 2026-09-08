/**
 * Fixed core/React/Svelte benchmark charts drawn with the headless renderer.
 * The generator reads a committed measurement snapshot. Every result is
 * retained regardless of winner; bars sort by measured time, fastest first.
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

/** Clean card look: no grid, no panel border (bun-style). */
const BENCH_THEME: ThemeSpec = {
  name: "light",
  grid: "transparent",
  panelBorder: "transparent",
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

/** Library names in ascending mount time. Ties break on the library name. */
function libsByAscendingValue(bars: readonly BenchmarkBar[]): readonly string[] {
  return bars
    .toSorted((a, b) => a.value - b.value || a.lib.localeCompare(b.lib))
    .map((bar) => bar.lib);
}

/**
 * Horizontal bar chart spec (coord flip): lower-is-better time benchmarks.
 * The quantitative axis is hidden (guides y none) — bar-end labels carry the
 * values, like bun's bundler chart. Title + subtitle live in the SVG so bare
 * README embeds stay self-describing (GitHub renders the image alone).
 */
export function benchmarkChartSpec(input: BenchmarkChartInput): PortableSpec {
  const spec = {
    data: { values: input.bars },
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
        params: { anchor: "start", dx: 0, dy: -6, size: 12 },
      },
    ],
    scales: {
      // Domain is ascending mount time. Coord flip paints the first band at
      // the bottom, so reverse puts the fastest bar on top.
      x: { type: "band", domain: libsByAscendingValue(input.bars), reverse: true },
      // Headroom past the longest bar so bar-end value labels never clip.
      y: { expand: { mult: 0.35, add: 0 } },
      fill: {
        type: "manual",
        domain: ["ggsvelte", "peer"],
        range: [BENCH_GGSVELTE_FILL, BENCH_PEER_FILL],
      },
    },
    coord: { type: "flip" },
    guides: { fill: { type: "none" }, y: { type: "none" } },
    labs: { title: input.title, subtitle: input.subtitle, x: "" },
    theme: BENCH_THEME,
  };
  return spec as unknown as PortableSpec;
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
  const spec = benchmarkChartSpec(input);
  const result = validate(spec);
  if (!result.ok) {
    const first = result.errors[0];
    throw new Error(
      `benchmark chart "${input.id}" failed validation: ${first?.code} at ${first?.path}: ${first?.message}`,
    );
  }
  const label = escapeXml(input.ariaLabel);
  return renderToSVGString(spec, options)
    .replace(/aria-label="[^"]*"/, `aria-label="${label}"`)
    .replace(/<title>[^<]*<\/title>/, `<title>${label}</title>`);
}
