/**
 * Chart-fixture factories for the benchmark suite.
 *
 * Pure PortableSpec builders (plus the seeded PRNG they share). The
 * budget-sensitive registry that wires sizes, labels, and measured `fn`
 * closures lives under `workloads/` (concatenated by `workloads/index.ts`).
 */
import {
  aes,
  coordTransform,
  gg,
  MAX_BINNED_BREAKS,
  scaleColorBinned,
  scaleColorLog10,
  scaleColorManual,
  scaleAlphaContinuous,
  scaleShapeDiscrete,
  scaleSizeContinuous,
  scaleXBinned,
  scaleXContinuous,
} from "@ggts-sh/spec";
import type { PortableSpec } from "@ggts-sh/spec";

// Mulberry32 — deterministic data across runs/machines.
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

export function temporalLineSpec(n: number): PortableSpec {
  const start = Date.UTC(1800, 0, 1);
  const date = Array.from<string>({ length: n });
  const value = Array.from<number>({ length: n });
  for (let index = 0; index < n; index++) {
    date[index] = new Date(start + index * 86_400_000).toISOString().slice(0, 10);
    value[index] = 50 + Math.sin(index / 30) * 10;
  }
  return gg({ date, value }, aes({ x: "date", y: "value" }))
    .geomLine()
    .spec();
}

export function temporalFreeFacetSpec(panelCount: number): PortableSpec {
  const panel = Array.from<string>({ length: panelCount * 2 });
  const date = Array.from<string>({ length: panelCount * 2 });
  const value = Array.from<number>({ length: panelCount * 2 });
  for (let index = 0; index < panelCount; index++) {
    const first = index * 2;
    panel[first] = `panel-${String(index).padStart(3, "0")}`;
    panel[first + 1] = panel[first]!;
    date[first] = `${String(1800 + (index % 100))}-01-01`;
    date[first + 1] = `${String(1925 + (index % 100))}-01-01`;
    value[first] = index;
    value[first + 1] = index + 1;
  }
  return gg({ panel, date, value }, aes({ x: "date", y: "value" }))
    .geomLine()
    .facet({ wrap: "panel", ncol: 10, scales: "free_x" })
    .spec();
}

export function scatterSpec(n: number, render?: "svg" | "canvas"): PortableSpec {
  const rnd = mulberry32(0xbadc0de ^ n);
  const x = Array.from<number>({ length: n });
  const y = Array.from<number>({ length: n });
  const cls = Array.from<string>({ length: n });
  for (let i = 0; i < n; i++) {
    x[i] = rnd() * 100;
    y[i] = rnd() * 100;
    cls[i] = `series-${i % 5}`;
  }
  return gg({ x, y, cls }, aes({ x: "x", y: "y", color: "cls" }))
    .geomPoint({ size: 1.5, alpha: 0.7, ...(render !== undefined && { render }) })
    .spec();
}

/** PR 3 transform workload: positive data shared by identity/log10/sqrt. */
export function transformedScatterSpec(
  n: number,
  transform: "identity" | "log10" | "sqrt",
): PortableSpec {
  const x = Array.from<number>({ length: n });
  const y = Array.from<number>({ length: n });
  for (let i = 0; i < n; i++) {
    x[i] = 1 + (i % 10_000);
    y[i] = 1 + ((i * 17) % 10_000);
  }
  return gg({ x, y }, aes({ x: "x", y: "y" }))
    .geomPoint({ render: "canvas" })
    .scales(scaleXContinuous({ transform }))
    .spec();
}

export function transformedStatsSpec(n: number, stat: "smooth" | "bin"): PortableSpec {
  const x = Array.from<number>({ length: n });
  const y = Array.from<number>({ length: n });
  for (let i = 0; i < n; i++) {
    x[i] = 1 + (i % 10_000);
    y[i] = 5 + Math.log10(x[i]!) * 3 + (i % 7) / 10;
  }
  if (stat === "smooth") {
    return gg({ x, y }, aes({ x: "x", y: "y" }))
      .geomSmooth({ method: "lm", se: false, n: 80 })
      .scales(scaleXContinuous({ transform: "log10" }))
      .spec();
  }
  return gg({ x }, aes({ x: "x" }))
    .geomHistogram({ binwidth: 0.25, boundary: 0 })
    .scales(scaleXContinuous({ transform: "log10" }))
    .spec();
}

export function transformedFacetSpec(n: number, panels: number): PortableSpec {
  const x = Array.from<number>({ length: n });
  const y = Array.from<number>({ length: n });
  const panel = Array.from<string>({ length: n });
  for (let i = 0; i < n; i++) {
    x[i] = 1 + (i % 10_000);
    y[i] = 1 + ((i * 13) % 1_000);
    panel[i] = `panel-${i % panels}`;
  }
  return gg({ x, y, panel }, aes({ x: "x", y: "y" }))
    .geomPoint({ render: "canvas" })
    .facet({ wrap: "panel", ncol: 10 })
    .scales(scaleXContinuous({ transform: "log10" }))
    .spec();
}

/** PR 4 post-stat coordinate projection workloads. */
export function coordPointSpec(n: number, transform: "identity" | "log10"): PortableSpec {
  const x = Array.from<number>({ length: n });
  const y = Array.from<number>({ length: n });
  for (let i = 0; i < n; i++) {
    x[i] = 1 + (i % 10_000);
    y[i] = 1 + ((i * 17) % 10_000);
  }
  return gg({ x, y }, aes({ x: "x", y: "y" }))
    .geomPoint({ render: "canvas" })
    .coord(
      coordTransform({
        x: transform === "identity" ? { transform, reverse: true } : transform,
      }),
    )
    .spec();
}

export function coordFixedSpec(n: number): PortableSpec {
  const x = Array.from<number>({ length: n });
  const y = Array.from<number>({ length: n });
  for (let i = 0; i < n; i++) {
    x[i] = i % 1_000;
    y[i] = (i * 17) % 1_000;
  }
  return gg({ x, y }, aes({ x: "x", y: "y" }))
    .geomPoint({ render: "canvas" })
    .coordFixed()
    .spec();
}

export function coordTessellationSpec(n: number): PortableSpec {
  const x = Array.from<number>({ length: n });
  const y = Array.from<number>({ length: n });
  const group = Array.from<string>({ length: n });
  for (let i = 0; i < n; i++) {
    x[i] = i % 2 === 0 ? 1 : 1_000_000_000;
    y[i] = i % 2 === 0 ? 1 : 100_000_000;
    group[i] = `segment-${i >>> 1}`;
  }
  return gg({ x, y, group }, aes({ x: "x", y: "y", group: "group" }))
    .geomLine()
    .coord(coordTransform({ x: "log10", y: "sqrt" }))
    .spec();
}

export function maxBoundaryBinnedSpec(n: number): PortableSpec {
  const x = Array.from({ length: n }, (_, i) => (i % MAX_BINNED_BREAKS) + 0.5);
  const y = Array.from({ length: n }, () => 1);
  const breaks = Array.from({ length: MAX_BINNED_BREAKS + 1 }, (_, i) => i);
  return gg({ x, y }, aes({ x: "x", y: "y" }))
    .geomPoint({ render: "canvas" })
    .scales(scaleXBinned({ breaks }))
    .spec();
}

export function nonPositionColorSpec(
  n: number,
  family: "log10" | "binned" | "manual",
): PortableSpec {
  const x = Array.from<number>({ length: n });
  const y = Array.from<number>({ length: n });
  const color = Array.from<number | string>({ length: n });
  for (let index = 0; index < n; index++) {
    x[index] = index % 1_000;
    y[index] = (index * 17) % 1_000;
    color[index] = family === "manual" ? `series-${index % 10}` : 1 + (index % 1_000);
  }
  const scale =
    family === "log10"
      ? scaleColorLog10()
      : family === "binned"
        ? scaleColorBinned({
            breaks: Array.from(
              { length: MAX_BINNED_BREAKS + 1 },
              (_, index) => 1 + (index * 999) / MAX_BINNED_BREAKS,
            ),
          })
        : scaleColorManual({
            domain: Array.from({ length: 10 }, (_, index) => `series-${index}`),
            values: [
              "#4269d0",
              "#efb118",
              "#ff725c",
              "#6cc5b0",
              "#3ca951",
              "#ff8ab7",
              "#a463f2",
              "#97bbf5",
              "#9c6b4e",
              "#9498a0",
            ],
          });
  return gg({ x, y, color }, aes({ x: "x", y: "y", color: "color" }))
    .geomPoint({ render: "canvas" })
    .scales(scale)
    .spec();
}

export function responsiveGuideSpec(n: number): PortableSpec {
  const x = Array.from<number>({ length: n });
  const y = Array.from<number>({ length: n });
  const group = Array.from<string>({ length: n });
  for (let index = 0; index < n; index++) {
    x[index] = index % 1_000;
    y[index] = (index * 17) % 1_000;
    group[index] = `group-${index % 12}`;
  }
  return gg({ x, y, group }, aes({ x: "x", y: "y", color: "group" }))
    .geomPoint({ render: "canvas" })
    .guides({ color: { type: "legend", position: "auto" } })
    .spec();
}

export function mappedStyleSpec(n: number): PortableSpec {
  const x = Array.from<number>({ length: n });
  const y = Array.from<number>({ length: n });
  const magnitude = Array.from<number>({ length: n });
  const confidence = Array.from<number>({ length: n });
  const group = Array.from<string>({ length: n });
  for (let index = 0; index < n; index++) {
    x[index] = index % 1_000;
    y[index] = (index * 17) % 1_000;
    magnitude[index] = 1 + (index % 100);
    confidence[index] = (index % 100) / 100;
    group[index] = `group-${index % 5}`;
  }
  return gg(
    { x, y, magnitude, confidence, group },
    aes({ x: "x", y: "y", size: "magnitude", alpha: "confidence", shape: "group" }),
  )
    .geomPoint({ render: "canvas" })
    .scales({
      ...scaleSizeContinuous(),
      ...scaleAlphaContinuous(),
      ...scaleShapeDiscrete(),
    })
    .spec();
}

/** M2 workload: faceted bars, 50 panels (plan workload) — per-panel counts,
 *  stacks, and the facet grid layout all exercise the partitioned path. */
export function facetedBarsSpec(): PortableSpec {
  const rnd = mulberry32(0xfa2e7);
  const n = 50 * 40;
  const cat = Array.from<string>({ length: n });
  const panel = Array.from<string>({ length: n });
  for (let p = 0; p < 50; p++) {
    for (let i = 0; i < 40; i++) {
      const j = p * 40 + i;
      panel[j] = `panel-${String(p).padStart(2, "0")}`;
      cat[j] = `c${Math.floor(rnd() * 5)}`;
    }
  }
  return gg({ cat, panel }, aes({ x: "cat" }))
    .geomBar()
    .facet({ wrap: "panel", ncol: 10 })
    .spec();
}

/** M1 workload: stacked bars, 50 categories x 4 series (plan workload). */
export function stackedBarSpec(): PortableSpec {
  const rnd = mulberry32(0x5eed);
  const category = Array.from<string>({ length: 200 });
  const series = Array.from<string>({ length: 200 });
  const value = Array.from<number>({ length: 200 });
  for (let c = 0; c < 50; c++) {
    for (let s = 0; s < 4; s++) {
      const i = c * 4 + s;
      category[i] = `cat-${String(c).padStart(2, "0")}`;
      series[i] = `series-${s}`;
      value[i] = rnd() * 100;
    }
  }
  return gg({ category, series, value }, aes({ x: "category", y: "value", fill: "series" }))
    .geomCol()
    .spec();
}

/** M1 workload: 10 line series x 10k points each (plan workload). */
export function lineSeriesSpec(pointsPerSeries: number): PortableSpec {
  const rnd = mulberry32(0x11e5);
  const n = 10 * pointsPerSeries;
  const x = Array.from<number>({ length: n });
  const y = Array.from<number>({ length: n });
  const series = Array.from<string>({ length: n });
  for (let s = 0; s < 10; s++) {
    let level = rnd() * 100;
    for (let i = 0; i < pointsPerSeries; i++) {
      const j = s * pointsPerSeries + i;
      x[j] = i;
      level += rnd() - 0.5;
      y[j] = level;
      series[j] = `series-${s}`;
    }
  }
  return gg({ x, y, series }, aes({ x: "x", y: "y", color: "series" }))
    .geomLine()
    .spec();
}

/** M2 workload: histogram over n rows (stat bin dominates). */
export function histogramSpec(n: number): PortableSpec {
  const rnd = mulberry32(0xb111 ^ n);
  const v = Array.from<number>({ length: n });
  for (let i = 0; i < n; i++) v[i] = (rnd() + rnd() + rnd() + rnd()) * 25;
  return gg({ v }, aes({ x: "v" }))
    .geomHistogram({ binwidth: 2, boundary: 0 })
    .spec();
}

/** M2 workload: loess smooth (+ se band) over n scatter rows.
 *  For n > INTERPOLATE_DIRECT_LIMIT (500) the interpolate surface is O(nv·q)
 *  with nv ≪ n (#1422); below that, direct/exact is O(n·q). */
export function loessSpec(n: number): PortableSpec {
  const rnd = mulberry32(0x10e55 ^ n);
  const x = Array.from<number>({ length: n });
  const y = Array.from<number>({ length: n });
  for (let i = 0; i < n; i++) {
    x[i] = rnd() * 100;
    y[i] = 20 + 0.8 * x[i]! - 0.006 * x[i]! * x[i]! + (rnd() - 0.5) * 8;
  }
  return gg({ x, y }, aes({ x: "x", y: "y" }))
    .geomSmooth({ method: "loess", span: 0.75 })
    .spec();
}

/** M2 workload: gaussian KDE over n rows (direct summation: 512·n kernel
 *  evaluations — exact, no FFT binning; decision 0010). */
export function densitySpec(n: number): PortableSpec {
  const rnd = mulberry32(0xd317 ^ n);
  const v = Array.from<number>({ length: n });
  for (let i = 0; i < n; i++) v[i] = (rnd() + rnd() + rnd()) * 33;
  return gg({ v }, aes({ x: "v" }))
    .geomDensity()
    .spec();
}
