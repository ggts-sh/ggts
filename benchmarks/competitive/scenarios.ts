/**
 * Competitive bench scenario catalog.
 *
 * Goal: avoid over-fitting optimisations to a single colored-scatter path.
 * Shapes mirror common external suites (uPlot multi-series time line; LightningChart
 * line/scatter/area load tests) while staying within geoms ggsvelte ships today.
 *
 * Data is deterministic (mulberry32) so runs compare across machines and commits.
 */

export const COLORS = [
  "#4e79a7",
  "#f28e2b",
  "#e15759",
  "#76b7b2",
  "#59a14f",
  "#edc948",
  "#b07aa1",
] as const;

export type ScenarioId = "scatter-color" | "line-multiseries" | "area-multiseries" | "bars-stacked";

/** Point budget / series shape for a concrete case. */
export type ScenarioCase = {
  readonly id: string;
  readonly scenario: ScenarioId;
  /** Total mark / sample budget used in labels and scaling. */
  readonly n: number;
  readonly series?: number;
  readonly pointsPerSeries?: number;
  readonly categories?: number;
  readonly stacks?: number;
  /** Include in the default browser run (full matrix is COMPETITIVE_FULL=1). */
  readonly defaultBrowser: boolean;
  /** Include in default bundle matrix. */
  readonly defaultBundle: boolean;
  readonly note: string;
};

export type ScatterColumns = {
  readonly x: number[];
  readonly y: number[];
  readonly cls: string[];
};

export type SeriesColumns = {
  readonly x: number[];
  readonly y: number[];
  readonly series: string[];
};

export type BarsColumns = {
  readonly category: string[];
  readonly value: number[];
  readonly stack: string[];
};

export type UpdateColumns = ScatterColumns | SeriesColumns | BarsColumns;

/** Rotate a trailing numeric label while preserving the label set. */
function rotateLabel(label: string, shift: number, count: number): string {
  const match = /^(.*?)(\d+)$/.exec(label);
  if (match === null || count <= 0) return label;
  const index = (Number.parseInt(match[2]!, 10) + shift) % count;
  return `${match[1]}${index}`;
}

/**
 * Deterministic update data with the same shape and a visibly different
 * normalized profile. The index-dependent wave matters: an affine-only
 * transform disappears when a chart retrains a linear scale.
 */
export function perturbForUpdate(data: UpdateColumns, variant: 1 | 2): UpdateColumns {
  const bump = variant * 5;
  const perturbY = (value: number, index: number): number =>
    value * 0.9 + bump + Math.sin((index + 1) * (variant === 1 ? 0.17 : 0.23)) * 3;
  if ("cls" in data) {
    const classes = new Set(data.cls).size;
    return {
      x: data.x,
      y: data.y.map(perturbY),
      cls: data.cls.map((label) => rotateLabel(label, variant, classes)),
    };
  }
  if ("series" in data) {
    return {
      x: data.x,
      y: data.y.map(perturbY),
      series: data.series,
    };
  }
  const stacks = new Set(data.stack).size;
  return {
    category: data.category,
    value: data.value.map(perturbY),
    stack: data.stack.map((label) => rotateLabel(label, variant, stacks)),
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeScatter(n: number): ScatterColumns {
  const rnd = mulberry32(0xbadc0de ^ n);
  const x = Array.from<number>({ length: n });
  const y = Array.from<number>({ length: n });
  const cls = Array.from<string>({ length: n });
  for (let i = 0; i < n; i++) {
    x[i] = rnd() * 100;
    y[i] = rnd() * 100;
    cls[i] = `series-${i % 5}`;
  }
  return { x, y, cls };
}

/** Multi-series line/area: shared x, independent y per series (columnar long form). */
export function makeMultiSeries(seriesCount: number, pointsPerSeries: number): SeriesColumns {
  const total = seriesCount * pointsPerSeries;
  const rnd = mulberry32(0xc0ffee ^ total);
  const x = Array.from<number>({ length: total });
  const y = Array.from<number>({ length: total });
  const series = Array.from<string>({ length: total });
  // Epoch-seconds style x (uPlot-like) so temporal libs can treat x as time if they want.
  const start = 1_600_000_000;
  for (let s = 0; s < seriesCount; s++) {
    const name = `s${s}`;
    let level = 10 + s * 5;
    for (let i = 0; i < pointsPerSeries; i++) {
      const idx = s * pointsPerSeries + i;
      x[idx] = start + i;
      level += (rnd() - 0.5) * 0.8;
      y[idx] = level + Math.sin(i / 40 + s) * 2;
      series[idx] = name;
    }
  }
  return { x, y, series };
}

export function makeStackedBars(categories: number, stacks: number): BarsColumns {
  const rnd = mulberry32(0xba5e ^ (categories * 17 + stacks));
  const total = categories * stacks;
  const category = Array.from<string>({ length: total });
  const value = Array.from<number>({ length: total });
  const stack = Array.from<string>({ length: total });
  for (let c = 0; c < categories; c++) {
    const cat = `c${String(c).padStart(2, "0")}`;
    for (let s = 0; s < stacks; s++) {
      const idx = c * stacks + s;
      category[idx] = cat;
      stack[idx] = `stack-${s}`;
      value[idx] = 1 + rnd() * 20;
    }
  }
  return { category, value, stack };
}

/**
 * Fixed case table. IDs are stable keys in results JSON.
 * Sizes span "interactive dashboard" (1k–10k) through uPlot-scale multi-series (~166k).
 */
export const CASES: readonly ScenarioCase[] = [
  // --- scatter (existing competitive focus, kept + extended) ---
  {
    id: "scatter-color-1k",
    scenario: "scatter-color",
    n: 1_000,
    defaultBrowser: true,
    defaultBundle: true,
    note: "Colored scatter, 5 series — prior sole competitive geom",
  },
  {
    id: "scatter-color-10k",
    scenario: "scatter-color",
    n: 10_000,
    defaultBrowser: true,
    defaultBundle: false,
    note: "Colored scatter mid",
  },
  {
    id: "scatter-color-100k",
    scenario: "scatter-color",
    n: 100_000,
    defaultBrowser: false,
    defaultBundle: false,
    note: "Colored scatter high-N (full matrix only)",
  },
  // --- multi-series line (uPlot / LightningChart primary shape) ---
  {
    id: "line-3x1k",
    scenario: "line-multiseries",
    n: 3_000,
    series: 3,
    pointsPerSeries: 1_000,
    defaultBrowser: true,
    defaultBundle: true,
    note: "3 series × 1k — small multi-line",
  },
  {
    id: "line-3x10k",
    scenario: "line-multiseries",
    n: 30_000,
    series: 3,
    pointsPerSeries: 10_000,
    defaultBrowser: true,
    defaultBundle: false,
    note: "3 series × 10k",
  },
  {
    id: "line-3x55k",
    scenario: "line-multiseries",
    n: 166_650,
    series: 3,
    pointsPerSeries: 55_550,
    defaultBrowser: false,
    defaultBundle: false,
    note: "uPlot bench scale: 3 × 55,550 ≈ 166,650 points",
  },
  {
    id: "line-10x10k",
    scenario: "line-multiseries",
    n: 100_000,
    series: 10,
    pointsPerSeries: 10_000,
    defaultBrowser: false,
    defaultBundle: false,
    note: "10 series × 10k (ggsvelte internal line-series workload shape)",
  },
  // --- area ---
  {
    id: "area-3x1k",
    scenario: "area-multiseries",
    n: 3_000,
    series: 3,
    pointsPerSeries: 1_000,
    defaultBrowser: true,
    defaultBundle: true,
    note: "3 series × 1k area",
  },
  {
    id: "area-3x10k",
    scenario: "area-multiseries",
    n: 30_000,
    series: 3,
    pointsPerSeries: 10_000,
    defaultBrowser: false,
    defaultBundle: false,
    note: "3 series × 10k area",
  },
  // --- bars (grammar strength, not just line paint) ---
  {
    id: "bars-stacked-50x4",
    scenario: "bars-stacked",
    n: 200,
    categories: 50,
    stacks: 4,
    defaultBrowser: true,
    defaultBundle: true,
    note: "50 categories × 4 stacks",
  },
] as const;

export type LibId =
  | "ggsvelte-svg"
  | "ggsvelte-canvas"
  | "d3"
  | "uplot"
  | "chartjs"
  | "echarts"
  | "svelteplot"
  | "layercake"
  | "layercake-canvas"
  | "unovis"
  | "tanstack-svelte"
  | "tanstack-react"
  | "ggsvelte-ggplot"
  | "ggsvelte-react"
  | "ggsvelte-full";

export type LibMeta = {
  readonly id: LibId;
  readonly label: string;
  /** Browser paint harness implements this lib. */
  readonly browser: boolean;
  /** Render form factor — the CI relative gate pairs peers with the
   * same-form ggsvelte adapter (svg vs svg, canvas vs canvas). */
  readonly form: "svg" | "canvas";
  /** Bundle matrix includes this lib. */
  readonly bundle: boolean;
  readonly scenarios: readonly ScenarioId[];
  readonly note: string;
};

/**
 * Competitor set: Svelte peers stay, plus general-purpose canvas/SVG libs from
 * uPlot / LightningChart comparison tables (MIT/open where practical).
 */
export const LIBS: readonly LibMeta[] = [
  {
    id: "ggsvelte-svg",
    label: "ggts SVG (lean)",
    form: "svg",
    browser: true,
    bundle: true,
    scenarios: ["scatter-color", "line-multiseries", "area-multiseries", "bars-stacked"],
    note: "Core headless scene + live SVG DOM; no framework host",
  },
  {
    id: "ggsvelte-canvas",
    label: "ggts canvas (lean pipeline)",
    form: "canvas",
    browser: true,
    bundle: true,
    scenarios: ["scatter-color", "line-multiseries", "area-multiseries"],
    note: "runPipeline + planStrata + drawStratum (canvas marks; axes still SVG-cost elsewhere)",
  },
  {
    id: "ggsvelte-full",
    label: "ggts full barrel",
    form: "svg",
    browser: false,
    bundle: true,
    scenarios: ["scatter-color"],
    note: "Identity scatter via @ggts-sh/core + registerAll() + @ggts-sh/spec (size ceiling)",
  },
  {
    id: "ggsvelte-ggplot",
    label: "ggts GGPlot (Svelte)",
    form: "svg",
    browser: true,
    bundle: true,
    scenarios: ["scatter-color", "line-multiseries", "area-multiseries", "bars-stacked"],
    note: "Shipped @ggts-sh/svelte GGPlot with spec prop and SVG marks; scatter bundle uses declaration children",
  },
  {
    id: "ggsvelte-react",
    label: "ggts GGPlot (React)",
    form: "svg",
    browser: true,
    bundle: true,
    scenarios: ["scatter-color", "line-multiseries", "area-multiseries", "bars-stacked"],
    note: "Shipped @ggts-sh/react GGPlot with spec prop and SVG marks",
  },
  {
    id: "d3",
    label: "raw D3",
    form: "svg",
    browser: true,
    bundle: true,
    scenarios: ["scatter-color", "line-multiseries", "area-multiseries", "bars-stacked"],
    note: "d3-scale + d3-axis + d3-selection + d3-shape/array",
  },
  {
    id: "uplot",
    label: "uPlot",
    form: "canvas",
    browser: true,
    bundle: true,
    scenarios: ["scatter-color", "line-multiseries", "area-multiseries"],
    note: "Canvas time-series specialist (~50KB); primary external speed bar",
  },
  {
    id: "chartjs",
    label: "Chart.js",
    form: "canvas",
    browser: true,
    bundle: true,
    scenarios: ["scatter-color", "line-multiseries", "area-multiseries", "bars-stacked"],
    note: "Widely used canvas generalist",
  },
  {
    id: "echarts",
    label: "Apache ECharts",
    form: "canvas",
    browser: true,
    bundle: true,
    scenarios: ["scatter-color", "line-multiseries", "area-multiseries", "bars-stacked"],
    note: "Large generalist (canvas); size + paint upper reference",
  },
  {
    id: "svelteplot",
    label: "SveltePlot",
    form: "svg",
    browser: true,
    bundle: true,
    scenarios: ["scatter-color", "line-multiseries", "area-multiseries", "bars-stacked"],
    note: "Svelte peer — <Plot><Dot>/<Line>/<AreaY>/<BarY> + default axes via components/svelteplot",
  },
  {
    id: "layercake",
    label: "LayerCake",
    form: "svg",
    browser: true,
    bundle: true,
    scenarios: ["scatter-color", "line-multiseries", "area-multiseries", "bars-stacked"],
    note: "Svelte peer — <LayerCake><Svg> + custom marks via components/layercake (no axes: framework ships none)",
  },
  {
    id: "layercake-canvas",
    label: "LayerCake (Canvas)",
    form: "canvas",
    browser: true,
    bundle: false,
    scenarios: ["scatter-color", "line-multiseries"],
    note: "LayerCake Canvas-layout fast path — one 2D-context draw pass, no per-mark DOM (rebuttal-proofing vs 'SVG-only peer' critique)",
  },
  {
    id: "unovis",
    label: "Unovis",
    form: "svg",
    browser: true,
    bundle: true,
    scenarios: ["scatter-color", "line-multiseries", "area-multiseries", "bars-stacked"],
    note: "Svelte peer (@unovis/svelte + @unovis/ts) — VisXYContainer + VisScatter/VisLine/VisArea/VisStackedBar + VisAxis",
  },
  {
    id: "tanstack-svelte",
    label: "TanStack Charts (Svelte)",
    form: "svg",
    browser: true,
    bundle: true,
    scenarios: ["scatter-color", "line-multiseries", "area-multiseries", "bars-stacked"],
    note: "Svelte peer — defineChart + <Chart> from @tanstack/charts/svelte (dot / lineY / areaY / stacked barY)",
  },
  {
    id: "tanstack-react",
    label: "TanStack Charts (React)",
    form: "svg",
    browser: true,
    bundle: true,
    scenarios: ["scatter-color", "line-multiseries", "area-multiseries", "bars-stacked"],
    note: "Generalist — same defineChart grammar through @tanstack/charts/react (default SVG Chart)",
  },
] as const;

export function casesForRun(full: boolean): ScenarioCase[] {
  return CASES.filter((c) => full || c.defaultBrowser);
}

export function bundleCasesForRun(full: boolean): ScenarioCase[] {
  return CASES.filter((c) => full || c.defaultBundle);
}

export function libSupports(lib: LibMeta, scenario: ScenarioId): boolean {
  return lib.scenarios.includes(scenario);
}

export function dataForCase(c: ScenarioCase): ScatterColumns | SeriesColumns | BarsColumns {
  switch (c.scenario) {
    case "scatter-color":
      return makeScatter(c.n);
    case "line-multiseries":
    case "area-multiseries":
      return makeMultiSeries(c.series ?? 3, c.pointsPerSeries ?? Math.floor(c.n / 3));
    case "bars-stacked":
      return makeStackedBars(c.categories ?? 50, c.stacks ?? 4);
  }
}

export const PLOT_WIDTH = 800;
export const PLOT_HEIGHT = 500;
