# @ggts-sh/compose

Framework-free PortableSpec assembly: fold grammar layers, merge plot props,
and produce the same spec the `gg()` builder emits. No DOM. Pre-1.0.

```sh
bun add @ggts-sh/compose     # or: npm install @ggts-sh/compose
```

Hosts (`@ggts-sh/svelte`, `@ggts-sh/react`) import this package so
children and props assemble through one implementation.

## Quick example

```ts
import { assemblePortableSpec } from "@ggts-sh/compose";

const spec = assemblePortableSpec({
  data: [
    { year: "1835", value: 12 },
    { year: "2026", value: 31 },
  ],
  aes: { x: "year", y: "value" },
  layers: [{ geom: "line" }],
});
```

Use [`@ggts-sh/spec`](https://www.npmjs.com/package/@ggts-sh/spec) to
validate or lint the result, then render with
[`@ggts-sh/core`](https://www.npmjs.com/package/@ggts-sh/core).
