# Pre-migration chart lineage

The old homepage did lead these comparisons. Its “ggsvelte” bars measured the
**core SVG renderer on first mount**, not Svelte component updates.

| Published chart            | Source commit | ggts entry        | Operation |     Time |
| -------------------------- | ------------- | ----------------- | --------- | -------: |
| Old scatter, 10k           | `de6f1222`    | `ggsvelte-svg`    | mount     |  69.9 ms |
| Old line, 30k              | `d3c1a089`    | `ggsvelte-svg`    | mount     |  30.6 ms |
| Launch Svelte scatter, 10k | `f9896386`    | `ggsvelte-ggplot` | update    | 213.0 ms |
| Launch Svelte line, 30k    | `f9896386`    | `ggsvelte-ggplot` | update    | 189.6 ms |

The launch added a surface/operation matrix. Selecting Svelte/update switched
both the measured entry and the operation. It did not track the old bar over
time. The old 30k line card was removed in `de6f1222` before the rename; the
remaining line card measured 100k points.

In the launch snapshot's same-run **update** measurements, the core SVG entry
records 98.8 ms for scatter-10k and 24.8 ms for line-30k. The Svelte host adds
rendering, reactivity, diagnostics, and interaction preparation. The host cost
is a performance target; these charts do not establish a same-entry regression.
The historical harness used Vite development serving; launch uses production
builds. Cross-date raw timings do not isolate a code change.

Reproduce the published chart evidence without running a benchmark:

```sh
git show de6f1222:scripts/gen-benchmark-charts.ts
git show de6f1222:apps/docs/static/benchmarks/bench-scatter-mount.svg
git show d3c1a089:apps/docs/static/benchmarks/bench-line-mount.svg
```

Current full measurements and their provenance are in [published.json](published.json).
The homepage highlights use the separate [focused SVG run](published-svg.json).
