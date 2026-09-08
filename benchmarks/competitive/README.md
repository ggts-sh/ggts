# Competitive browser + bundle bench

Measures the core renderer and shipped React/Svelte components against charting libraries.

External references that shaped the matrix:

- [leeoniya/uPlot](https://github.com/leeoniya/uPlot) — multi-series time-line cold paint, size, interaction
- [Lightning-Chart/javascript-charts-performance-comparison](https://github.com/Lightning-Chart/javascript-charts-performance-comparison) — multi-geom (line/scatter/area/step/spline) × load / stream / capacity

## Why this exists

The first competitive harness measured **one** colored scatter (SVG) at 1k/10k against D3 (+ SveltePlot/LayerCake for **bundle only**). That is enough to over-fit optimisations to a single geom and miss where specialists win (multi-series lines on canvas, streaming, capacity).

This suite expands:

| Axis    | Coverage                                                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Geoms   | scatter, multi-series line, multi-series area, stacked bars                                                                                                         |
| Sizes   | 1k → 10k default; full matrix adds 100k scatter, uPlot-scale 3×55.5k line, 10×10k line                                                                              |
| Libs    | ggsvelte SVG, ggsvelte canvas, D3, **uPlot**, **Chart.js**, **ECharts**, **TanStack Charts (React)**, plus SveltePlot/LayerCake/Unovis/**TanStack Charts (Svelte)** |
| Metrics | gzip bundle per lib×scenario; browser cold mount + in-place update, each with paint-inclusive total and synchronous medians                                         |

Internal mitata workloads in `benchmarks/` remain the self-regression gate. This package is the **external** comparison.

## Commands

```sh
# Install monorepo deps from repo root first: bun install

bun run measure:bundles    # Vite minify + gzip -9
bun run measure:browser    # Playwright Chromium, default case matrix
bun run measure:ssr        # server-side SVG render throughput (no browser)
bun run measure            # bundles + browser

COMPETITIVE_FULL=1 bun run measure:browser   # includes 100k / uPlot-scale cells
COMPETITIVE_FULL=1 bun run measure:bundles
COMPETITIVE_LIBS=ggsvelte-ggplot COMPETITIVE_CASES=scatter-color-10k bun run measure:browser
# focus an existing default framework cell
bun test                   # catalog integrity
```

Results: `results/bundles.json`, `results/browser.json`.

## Published benchmarks

The README and docs show fixed workloads: 10,000 colored points and three
10,000-point lines, with mount and update timings for core SVG, React, and
Svelte. A loss stays in the chart. The full results retain every comparator,
including area, stacked bars, and the smaller cases.

`measure:browser` builds the fixture in production mode and serves the output
through Vite preview. Both GGPlot hosts cover all four geom families in the
default matrix. `ggsvelte-svg` means the core SVG renderer, `ggsvelte-ggplot`
means the Svelte component, and `ggsvelte-react` means the React component.
The labels keep those surfaces distinct.

From the repo root, after building the packages:

```sh
bun run bench:competitive:browser
bun run bench:competitive:bundles
bun benchmarks/competitive/measure-ssr.ts
bun scripts/gen-benchmark-charts.ts --publish
bun scripts/gen-benchmark-charts.ts --check
```

Run all three measurements from one clean source commit before publishing.
`--publish` copies the measured browser, bundle, and SSR results into the committed
`benchmarks/competitive/published.json` snapshot and generates the charts.
The snapshot records the commit, working-tree status, lockfile hash, package
versions, runtime, browser, machine, and measurement dates. Without
`--publish`, generation and `--check` use that snapshot; CI can reproduce
all chart artifacts without rerunning host-sensitive timings. Release version
bumps do not change the measured package versions.

The full page includes the fresh SSR and bundle matrices alongside browser
results. It preserves high-N results from their historical run, labeled with
the recorded date and development-server protocol; its source commit and
package versions were not recorded. These rows must not be compared with the
new production timings. Later publishes retain that historical record from
the committed snapshot. `measure:browser:100k-peers` remains a separate report.

## Fairness notes (read before optimising)

1. **Apples and oranges by design.** uPlot is a lean canvas time-series painter with almost no grammar. ggsvelte runs a ggplot-like pipeline (scales, stats hooks, guides, candidates). Beating uPlot on raw line paint is a long game; the matrix shows the gap honestly.
2. **ggsvelte-canvas harness draws mark strata only** (no axis/legend SVG chrome). That isolates mark cost; production `GGPlot` still composites SVG chrome.
3. **ggsvelte-svg** mounts one full chart (including axes) and patches compatible scenes in place. The core adapter uses direct `SpecInput` objects rather than fluent builder sugar so bundle cells measure the renderer graph, not an optional authoring API; output-equivalence tests lock the same normalized chart.
4. **`replace` is a full remount**, not in-place `setData`. The browser harness therefore **does not re-sample** replace (it mirrors mount stats) until a real in-place update metric lands (LightningChart's streaming score).
5. **`area-multiseries` is overlaid (identity), not stacked.** ggsvelte `geomArea` defaults to `stack`; adapters pass `position: "identity"` so ggsvelte matches D3/Chart.js/ECharts/uPlot overlays. `bars-stacked` remains the stack fairness cell.
6. **No interaction (mousemove) or max-capacity sweep yet.** uPlot's table and LC's capacity/stream metrics are the next expansion targets.
7. **Svelte peers** (SveltePlot, LayerCake, Unovis, TanStack Charts Svelte) mount real component fixtures in Playwright for browser + bundle; SSR is measured separately. TanStack Charts React is a React comparator (same `defineChart` grammar, `@tanstack/charts/react` host), not a Svelte-peer gate.
8. Compare **within one machine and one run**. Absolute ms are host-sensitive (same as internal budgets).
9. **Each library×case cell gets a fresh page.** Chromium and the production preview server stay alive, but page-local framework state, detached DOM, and garbage-collection pressure do not leak from one peer into the next.
10. **Browser timing reports both total and sync medians from the same samples.** Total time includes the existing double animation-frame wait. Sync time stops when the adapter returns, excluding deterministic data generation and the frame wait; it separates pipeline/draw work from compositor and host scheduling. The relative CI gate requires both metrics to corroborate a loss, preventing frame-scheduling noise from failing a cell; deferred-render peers still keep total honest because their tiny sync return cannot rescue ggsvelte.
11. **Paint-inclusive timing** can still be noisy on small cases. Use denser cases (`line-3x10k`, `scatter-color-10k`, full matrix) to rank libraries, and use the paired sync result to attribute a total-time gap before changing runtime code.
12. **SSR throughput (`measure:ssr`) is reported, not cherry-picked.** Each lib renders data -> SVG string with no browser: ggsvelte via the headless SVG renderer, peers via Svelte 5 `render()` of the same fixture components (LayerCake with its documented `ssr` prop). Honest findings: **LayerCake out-renders ggsvelte at 1k** (plain string concat beats the full grammar pipeline at small N — the cell is kept, not hidden); **SveltePlot and Unovis server-render empty shells** (marks live in client-side `$effect` / `onMount`), recorded as `ssrCapable: false` — never a 0 bar. Any _other_ lib regressing to an empty shell fails the run loudly (`minMarks`).
13. **uPlot scatter** sorts x ascending before paint (uPlot requires monotonic `data[0]`); that sort is inside the timed path for this adapter.
14. **Every timed update proves it changed visible output and reached fresh-final parity.** Update variants include an index-dependent wave because an affine-only transform disappears when a chart retrains a linear scale. SVG output is compared after canonicalizing generated ids/references; canvas output uses exact pixel-buffer hashes.

## Scenario catalog

See `scenarios.ts` (`CASES`, `LIBS`). Stable case ids (e.g. `line-3x55k`, `scatter-color-10k`) are the keys in results JSON.

Default browser cells include at least:

- `scatter-color` @ 1k, 10k
- `line-multiseries` @ 3×1k, 3×10k
- `area-multiseries` @ 3×1k
- `bars-stacked` @ 50×4

## Adding a lib or scenario

1. Add data shape / case to `scenarios.ts`.
2. Implement `adapters/<lib>.ts` mount.
3. Wire `fixtures/main.ts` switch.
4. Add `entries/<lib>__<scenario>.ts` for bundle graph.
5. Extend `scenarios.test.ts` so the catalog cannot collapse back to scatter-only.
