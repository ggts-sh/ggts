# ggts

Formerly ggsvelte. [Migration guide](https://ggts.sh/guide/upgrading#0-42-to-0-43).

[![CI](https://img.shields.io/github/actions/workflow/status/ggts-sh/ggts/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/ggts-sh/ggts/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40ggts-sh%2Fsvelte?style=flat-square)](https://www.npmjs.com/package/@ggts-sh/svelte)
[![codecov](https://codecov.io/gh/ggts-sh/ggts/branch/main/graph/badge.svg)](https://app.codecov.io/gh/ggts-sh/ggts)
[![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

ggts is a fast agent-native implementation of the grammar of graphics in TypeScript.

[Documentation](https://ggts.sh/) · [Agent setup](https://ggts.sh/guide/agents) ·
[Examples](https://ggts.sh/examples) · [Framework quickstarts](https://ggts.sh/guide/getting-started)

## Benchmarks

[Source and full results](benchmarks/competitive).

<!-- framework-benchmark-charts:start -->

![SVG chart benchmarks. Median time including paint. Lower is better. 10,000-point scatter · First render. ggts 42.2 ms, LayerCake 137.8 ms, TanStack 171 ms, Unovis 202 ms. 1,000-point scatter · First render. ggts 7.8 ms, LayerCake 15.5 ms, TanStack 20.4 ms, Unovis 27.8 ms. 10,000-point scatter · Data update. ggts 38.8 ms, LayerCake 61.1 ms, TanStack 115.9 ms, Unovis 268.7 ms. 30,000-point line · Data update. ggts 14.4 ms, LayerCake 20.5 ms, TanStack 50.5 ms, Unovis 58.9 ms.](apps/docs/static/benchmarks/bench-core-svg-grid.svg)

<!-- framework-benchmark-charts:end -->

## Start in an agent sandbox

```sh
npm install --save-dev --save-exact @ggts-sh/cli @ggts-sh/skill
```

Keep the lockfile and tell your agent to read
`node_modules/@ggts-sh/skill/SKILL.md`. If you copy the package into the
agent’s skills directory, refresh that copy after each dependency update.
The skill shares one grammar and selects React or Svelte instructions from
the target application.

Try this task:

> Make a column chart of annual sales: 2023: 12, 2024: 18, 2025: 25.
> Save a complete PortableSpec as chart.json. Run `ggts check`, read its
> diagnostics, fix errors, and render chart.svg.

A complete `chart.json`:

```json
{
  "data": {
    "values": [
      { "year": "2023", "sales": 12 },
      { "year": "2024", "sales": 18 },
      { "year": "2025", "sales": 25 }
    ]
  },
  "aes": { "x": { "field": "year" }, "y": { "field": "sales" } },
  "layers": [{ "geom": "col" }],
  "scales": { "x": { "type": "band" } },
  "labs": { "title": "Annual sales", "x": "Year", "y": "Sales" }
}
```

```sh
npm exec -- ggts check chart.json
npm exec -- ggts render chart.json > chart.svg
```

`check` runs the rendering checks without SVG output. Both commands write
JSONL diagnostics to stderr; validation errors include a path and suggested
fix. Inspect the SVG after the checks pass. No browser or UI framework is
required for this workflow.

[Complete sandbox setup and repair loop](https://ggts.sh/guide/agents) ·
[Schema](https://ggts.sh/schema/v0.json) · [llms.txt](https://ggts.sh/llms.txt) ·
[Full corpus](https://ggts.sh/llms-full.txt)

## Use React or Svelte

```sh
npm install @ggts-sh/react   # React DOM 18.2 or 19
# or
npm install @ggts-sh/svelte  # Svelte 5.33.1+
```

Pass the same spec to `GGPlot`, calling `registerAll()` once for spec-driven
charts. Or compose `GeomPoint`, `GeomSmooth`, scales, themes, and other
layers as components. The TypeScript `gg()` builder produces the same spec.
[Complete React and Svelte examples](https://ggts.sh/guide/getting-started).

For a smaller bundle, import from `@ggts-sh/react/lean` or
`@ggts-sh/svelte/lean` and register only the geoms and scales your charts use
([React](packages/react#smaller-bundles-the-lean-entry),
[Svelte](packages/svelte#smaller-bundles-the-lean-entry)).

Node.js 22+; CI tests npm, pnpm, and Bun. Interactive charts also need browser
checks for callbacks, keyboard use, and hydration.

## Packages

| Package                                | Surface                                                                      |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| [`@ggts-sh/spec`](packages/spec)       | PortableSpec, schema, validation, normalization, TypeScript builder          |
| [`@ggts-sh/core`](packages/core)       | Shared pipeline, headless SVG, canvas, hit testing; teaching data at `/data` |
| [`@ggts-sh/react`](packages/react)     | React DOM components                                                         |
| [`@ggts-sh/svelte`](packages/svelte)   | Svelte 5 components                                                          |
| [`@ggts-sh/compose`](packages/compose) | Shared grammar composition                                                   |
| [`@ggts-sh/cli`](packages/cli)         | `ggts check` and `ggts render`                                               |
| [`@ggts-sh/skill`](packages/skill)     | Versioned agent skill and framework references                               |

## Why ggts?

Use ggplot2's grammar in TypeScript, validate portable chart specs, and render
SVG without a DOM. The same grammar powers React and Svelte components.

Compare Svelte ecosystem capabilities:

| Capability                                       | ggts                           | TanStack | SveltePlot | Unovis   | LayerCake |
| ------------------------------------------------ | ------------------------------ | -------- | ---------- | -------- | --------- |
| **Headless server-side SVG** (no DOM)            | ✅                             | ✅       | ❌         | ❌       | ⚠️ opt-in |
| **Portable JSON spec + schema**                  | ✅                             | ❌       | ❌         | ❌       | ❌        |
| **CLI validator + renderer**                     | ✅                             | ❌       | ❌         | ❌       | ❌        |
| **Agent skill**                                  | ✅                             | ✅       | ❌         | ❌       | ❌        |
| **Automatic temporal detection**                 | ✅                             | ❌       | ⚠️ Some    | ❌       | ❌        |
| **Built-in interactions**                        | ✅                             | ✅       | ⚠️ Some    | ⚠️ Some  | ❌        |
| **ggplot2 API**                                  | ✅                             | ❌       | ❌         | ❌       | ❌        |
| **Scale, axis & coord control**                  | ✅                             | ✅       | ✅         | ✅       | ⚠️ d3     |
| **Bundle size** (min+gzip, scatter import graph) | 94 KB core SVG / 232 KB Svelte | ✅ 43 KB | ⚠️ 90 KB   | ✅ 64 KB | ✅ 30 KB  |
| **API stability**                                | ⚠️ v0.50.0                     | ⚠️ v0.14 | ⚠️ v0.14   | ✅ v1.6  | ✅ v10    |

## Reference

- [Guide](https://ggts.sh/docs)
- [Example gallery](https://ggts.sh/examples)
- [Themes and palettes](https://ggts.sh/themes)
- [Interactions and events](https://ggts.sh/reference/interactions)
- [Production](https://ggts.sh/guide/production)
- [Upgrading](https://ggts.sh/guide/upgrading)

## Release status

Pre-1.0. Package manifests are the version source of truth. Lifecycle and
compatibility contracts live in [`lifecycle.json`](lifecycle.json) and the
[lifecycle guide](https://ggts.sh/guide/lifecycle).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © Liam O'Dea. Loess reference attribution is in [NOTICE](NOTICE).
