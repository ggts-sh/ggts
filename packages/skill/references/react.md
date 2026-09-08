# React DOM

Read this reference for a React target. The shared [grammar](grammar.md) and
[validation loop](../SKILL.md#the-validation-contract-use-it) apply unchanged.
Use React DOM 18.2 or 19 and install `@ggts-sh/react`.
For the bundled dataset example below, also install `@ggts-sh/core`:

```sh fragment
npm install @ggts-sh/react @ggts-sh/core
```

In a server-component application, place interactive charts behind a client component boundary.

## Render a portable spec

Use the same spec that passed `ggts check`. Spec-driven charts need full
registration because no geom children self-register.

```tsx complete
"use client";

import { GGPlot, registerAll, type PortableSpec } from "@ggts-sh/react";

registerAll();

const spec: PortableSpec = {
  data: {
    values: [
      { year: "2023", sales: 12 },
      { year: "2024", sales: 18 },
      { year: "2025", sales: 25 },
    ],
  },
  aes: { x: { field: "year" }, y: { field: "sales" } },
  layers: [{ geom: "col" }],
  scales: { x: { type: "band" } },
  labs: { title: "Annual sales", x: "Year", y: "Sales" },
};

export default function SalesChart() {
  return <GGPlot spec={spec} height={400} />;
}
```

## Compose the grammar in JSX

Geom and grammar children declare layers. They render no markup themselves.
Bare strings in component `aes` map fields; JSON specs use `{ field: name }`.
`spec` takes precedence over component authoring inputs. Keep mark order as
the desired drawing order.

```tsx complete
"use client";

import {
  GGPlot,
  GeomPoint,
  GeomSmooth,
  Labs,
  ThemeMinimal,
} from "@ggts-sh/react";
import { palmerPenguins } from "@ggts-sh/core/data";

export default function PenguinChart() {
  return (
    <GGPlot
      data={palmerPenguins}
      aes={{ x: "flipperLengthMm", y: "bodyMassG", color: "species" }}
      height={400}
    >
      <GeomSmooth method="loess" se={false} />
      <GeomPoint alpha={0.8} />
      <ThemeMinimal />
      <Labs title="Penguin size" x="Flipper length (mm)" y="Body mass (g)" />
    </GGPlot>
  );
}
```

## Interactions and lifecycle

Read [Choosing inspect mode and interaction contracts](interactions.md)
before enabling Inspect, selection, zoom, or linked charts. Its grammar and
event semantics are shared; translate Svelte template syntax into JSX.
Pass functions as React props, use React state for application state, and
use a ref for `resetScales()` and `setZoom()`.

- `<Inspect />` declares inspection. Keep its mode, pinning, identity, and
  custom content on this child. Treat Svelte snippets and React render
  callbacks as adapter-specific code.
- `<GuideLegend channel="color" focus />` and `filter` control legend
  interaction. These are host behavior, not PortableSpec keys.
- Keep a shared `createPlotInteraction()` controller stable across renders
  with a lazy React state initializer. Match `interactionScope` channels
  between linked plots; separate unrelated datasets.
- React consumes JSX `key` itself. Use `identity` on Inspect, selection, or
  the interaction controller for durable row keys.
- Check actual browser hover/pin, keyboard operation, selection, and zoom.
  CLI success verifies the portable chart pipeline, not React event wiring.

For lean imports or stat overrides, read [registration](registration.md).
