# @ggts-sh/spec

[![codecov](https://codecov.io/gh/ggts-sh/ggts/branch/main/graph/badge.svg?component=packages-spec)](https://app.codecov.io/gh/ggts-sh/ggts/tree/main/packages%2Fspec)

PortableSpec types, published JSON Schema, `normalize()`, two-tier
`validate()` with the agent error contract
(`{ code, path, message, allowed?, fix }`), `lintSpec()`, and the fluent
`gg()` / `aes()` builder. No DOM, no d3. Pre-1.0.

```sh
bun add @ggts-sh/spec     # or: npm install @ggts-sh/spec
```

Install alone for validation and authoring without a renderer.
[`@ggts-sh/svelte`](https://www.npmjs.com/package/@ggts-sh/svelte)
re-exports this package.

## Quick example

```ts
import { gg, aes, validate } from "@ggts-sh/spec";
// constrained decoding / tool schemas
import schema from "@ggts-sh/spec/schema/v0.json";

const spec = gg(
  [
    { year: "1835", value: 12 },
    { year: "2026", value: 31 },
  ],
  aes({ x: "year", y: "value" }),
)
  .geomLine()
  .spec();

const result = validate(spec, {
  profile: {
    fields: [
      { name: "year", type: "temporal" },
      { name: "value", type: "quantitative" },
    ],
  },
  lint: true,
});
if (!result.ok) {
  // Apply fix.example at path, then re-validate.
  // { code, path, message, allowed?, fix: { description, example } }
}
```

## Agent contract

- `validate(spec)` — shape only.
- `validate(spec, { profile })` — data-aware without shipping rows.
- `validate(spec, { lint: true })` — advisories for valid-but-questionable specs.
- Every error carries `fix.example`. Apply it at `path` and re-validate.
- PortableSpec is JSON-only: no `Date`, callbacks, or regular expressions.
  Builder `Date` values canonicalize to ISO strings.
- JSON aes uses `{ field: "col" }` (bare strings are invalid in JSON). The
  builder and Svelte props accept bare-string shorthand.

## Render

- Headless SVG: [`@ggts-sh/core`](https://www.npmjs.com/package/@ggts-sh/core)
  (`renderToSVGString`)
- CLI loop (validation + warnings on stderr):
  [`@ggts-sh/cli`](https://www.npmjs.com/package/@ggts-sh/cli)
  (`ggts render`)
- Svelte 5:
  [`@ggts-sh/svelte`](https://www.npmjs.com/package/@ggts-sh/svelte)

Schema: [schema/v0.json](https://ggts.sh/schema/v0.json) · Docs:
[ggts.sh](https://ggts.sh/) · Repo:
[github.com/ggts-sh/ggts](https://github.com/ggts-sh/ggts)

[MIT](https://github.com/ggts-sh/ggts/blob/main/LICENSE) © Liam O'Dea
