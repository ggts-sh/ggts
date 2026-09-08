# @ggts-sh/react

React DOM adapter for ggts. ggplot2-named components
(`GGPlot`, `GeomPoint`, `ScaleXLog10`, `ThemeMinimal`, …) over the
framework-agnostic `@ggts-sh/core` pipeline. Pre-1.0.

```sh
npm install @ggts-sh/react @ggts-sh/core
```

Peers: `react` and `react-dom` ^18.2 or ^19. Does not depend on
[`@ggts-sh/svelte`](https://www.npmjs.com/package/@ggts-sh/svelte).

The example imports bundled data from `@ggts-sh/core/data`, so install
`@ggts-sh/core` as a direct dependency. Charts with inline data need only
`@ggts-sh/react`.

## Quick example

```tsx
"use client";

import { mpg as cars } from "@ggts-sh/core/data";
import {
  GGPlot,
  GeomPoint,
  GeomSmooth,
  ScaleColorDiscrete,
  ThemeMinimal,
  Labs,
} from "@ggts-sh/react";

export default function CarsChart() {
  return (
    <GGPlot
      data={cars}
      aes={{ x: "displ", y: "hwy", color: "class" }}
      height={400}
    >
      <GeomSmooth method="loess" se={false} />
      <GeomPoint size={3} alpha={0.85} />
      <ScaleColorDiscrete scheme="observable10" />
      <ThemeMinimal />
      <Labs title="Cars" x="Displacement (l)" y="Highway mpg" color="Class" />
    </GGPlot>
  );
}
```

Children are declaration-only: they register into the plot and render
nothing themselves. You can also pass a `spec` from `gg()`, or `data` /
`aes` / `layers` as props. `spec` wins.

Use a ref for `resetScales()` and `setZoom()`. Specialty geoms still
need their family `register*` (or `registerAll`) when you override
`stat`. Temporal scale children import `@ggts-sh/core/temporal`.

Both adapters share inspection, selection, zoom, legends, and linked interaction
controllers. React renders chart SVG on the server and measures its container
after hydration. In server-component applications, use a client component
boundary for interactive charts.

See the [agent sandbox guide](https://ggts.sh/guide/agents) for the shared
JSON workflow and [React examples](https://ggts.sh/examples) for host callbacks.

CLI rendering stays on [`@ggts-sh/cli`](https://www.npmjs.com/package/@ggts-sh/cli).
