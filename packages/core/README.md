# @ggts-sh/core

[![codecov](https://codecov.io/gh/ggts-sh/ggts/branch/main/graph/badge.svg?component=packages-core)](https://app.codecov.io/gh/ggts-sh/ggts/tree/main/packages%2Fcore)

Grammar pipeline (stats, positions, facets, scales, layout) and pure SVG-string
renderer. The main entry has no DOM — Node, edge runtimes, workers. Canvas and
hit-testing live under `@ggts-sh/core/dom`. Pre-1.0.

```sh
bun add @ggts-sh/core     # or: npm install @ggts-sh/core
```

For server, CLI, and agent rendering. Svelte apps use
[`@ggts-sh/svelte`](https://www.npmjs.com/package/@ggts-sh/svelte).

## Quick example

Author with the builder from `@ggts-sh/spec`, render here:

```ts
import { registerAll, renderToSVGString, runPipeline } from "@ggts-sh/core";
import { aes, gg } from "@ggts-sh/spec";

// The barrel is side-effect-free: register the grammar explicitly (or import
// "@ggts-sh/core/render" for identity charts only).
registerAll();

const spec = gg(
  [
    { year: "1835", value: 12 },
    { year: "2026", value: 31 },
  ],
  aes({ x: "year", y: "value" }),
)
  .geomLine()
  .spec();

const svg = renderToSVGString(spec, { width: 640, height: 400 });

const model = runPipeline(spec, { width: 640, height: 400 });
// model.scene, model.scaleDecisions, model.guidePlans,
// model.advisories, model.warnings, model.candidates
```

For the smallest point-only headless bundle, opt into one geom family:

```ts
import { renderToSVGString } from "@ggts-sh/core/headless";
import { registerBasicPoints } from "@ggts-sh/core/headless/register";

registerBasicPoints();
```

Mapped colors can stay catalog-free too: call `registerDefaultOrdinalColor()`
for the built-in palette or an explicit `range`. Call `registerOrdinalColor()`
instead when the spec selects a named categorical, ColorBrewer, sequential, or
Crameri scheme.

Bare PortableSpec JSON works the same way — channel mappings use
`{ field: "col" }`, not bare strings:

```ts
import { renderToSVGString } from "@ggts-sh/core";

const svg = renderToSVGString(
  {
    data: {
      values: [
        { year: "1835", value: 12 },
        { year: "2026", value: 31 },
      ],
    },
    layers: [
      {
        geom: "line",
        aes: { x: { field: "year" }, y: { field: "value" } },
      },
    ],
  },
  { width: 640, height: 400 },
);
```

## Entries

| Import                            | Use                                                 |
| --------------------------------- | --------------------------------------------------- |
| `@ggts-sh/core`                   | Full grammar + temporal + SVG string                |
| `@ggts-sh/core/render`            | Lean identity-chart surface (auto-registers basics) |
| `@ggts-sh/core/headless`          | Side-effect-free headless pipeline and SVG renderer |
| `@ggts-sh/core/headless/register` | Tree-shakeable basic geom/stat family registration  |
| `@ggts-sh/core/data`              | Bundled teaching datasets for any framework         |
| `@ggts-sh/core/dom`               | Browser canvas draw + hit index                     |
| `@ggts-sh/core/temporal`          | Temporal polyfill entry                             |

CLI without installing this package as a library:
[`ggts render`](https://www.npmjs.com/package/@ggts-sh/cli) (same pipeline,
JSONL diagnostics on stderr).

Specs validate through
[`@ggts-sh/spec`](https://www.npmjs.com/package/@ggts-sh/spec).
Docs: [ggts.sh](https://ggts.sh/) · Repo:
[github.com/ggts-sh/ggts](https://github.com/ggts-sh/ggts)

[MIT](https://github.com/ggts-sh/ggts/blob/main/LICENSE) © Liam O'Dea
