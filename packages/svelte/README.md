# @ggsvelte/svelte

[![codecov](https://codecov.io/gh/ljodea/ggsvelte/branch/main/graph/badge.svg?component=packages-svelte)](https://app.codecov.io/gh/ljodea/ggsvelte/tree/main/packages%2Fsvelte)

Svelte 5 components for ggsvelte. Re-exports `@ggsvelte/spec` and
`@ggsvelte/core`. The agent skill ships separately as
[`@ggsvelte/skill`](https://www.npmjs.com/package/@ggsvelte/skill), and the
`ggsvelte-render` CLI as
[`@ggsvelte/cli`](https://www.npmjs.com/package/@ggsvelte/cli) — install both in
every sandbox where an agent authors specs.

```sh
bun add @ggsvelte/svelte
# or: npm install @ggsvelte/svelte
```

Requires Node.js 22+ and Svelte 5.33.1+.

## Example

Compose with declaration-only children (theme, scales, labs, geoms). Do not put
`theme`, `scales`, `labs`, `guides`, `facet`, `coord`, or `legend` on
`<GGPlot>` — those props were removed in 0.13.0.

```svelte
<script lang="ts">
  import {
    GeomPoint,
    GeomSmooth,
    GGPlot,
    Labs,
    ThemeMinimal,
  } from "@ggsvelte/svelte";
  import { kyotoSakura } from "@ggsvelte/core/data";
</script>

<GGPlot data={kyotoSakura} aes={{ x: "year", y: "bloomDoy" }}>
  <GeomSmooth method="loess" se={false} />
  <GeomPoint size={2} alpha={0.7} />
  <ThemeMinimal />
  <Labs
    title="Kyoto cherry blossom full-bloom dates, 812–2026"
    subtitle="Full bloom moved about ten days earlier after the industrial era"
    x="Year"
    y="Day of year"
  />
</GGPlot>
```

Convention (ggplot2 thinking order): mark layers first, then scales / coords /
facets, then theme / guides / labs, then host-only `<Inspect>` last. Dense
points may render on canvas; axes, legends, text, and accessible descriptions
stay in the DOM. Prefer `<Inspect />` and `<GuideLegend channel focus>` /
`<GuideLegend channel filter>` for interaction — not plot-level `inspect`,
`legendFocus`, or `legendFilter`.

## Agent skill

Published separately as
[`@ggsvelte/skill`](https://www.npmjs.com/package/@ggsvelte/skill):
`node_modules/@ggsvelte/skill/SKILL.md`. Copy it into your agent's skills
directory as `ggsvelte/` and re-copy on version bumps — dependabot surfaces
those. (Removed from this package in 0.27.0.)

Emit PortableSpec JSON, run `validate()`, apply `fix.example` at `path`,
re-validate, then render with `<GGPlot spec={…} />`, `renderToSVGString`, or
`ggsvelte-render`. Schema: [schema/v0.json](https://ggsvelte.sh/schema/v0.json).

## Migrating old code

If you still have pre-0.13 sources with grammar props on `<GGPlot>`, the
codemod rewrites them to children:

```sh
npx ggsvelte-codemod src          # show what would change
npx ggsvelte-codemod --write src  # apply
```

Shapes it will not rewrite mechanically are printed as `manual change
required` with a link to the [upgrading
guide](https://ggsvelte.sh/guide/upgrading), never half-migrated.

## Links

- [Documentation](https://ggsvelte.sh/)
- [Getting started](https://ggsvelte.sh/guide/getting-started)
- [Example gallery](https://ggsvelte.sh/examples)
- [Interactions](https://ggsvelte.sh/reference/interactions)
- [Upgrading](https://ggsvelte.sh/guide/upgrading)
- [CLI (`@ggsvelte/cli`)](https://www.npmjs.com/package/@ggsvelte/cli)
- [Repository](https://github.com/ljodea/ggsvelte)

Pre-1.0. Lifecycle and compatibility contracts are on the docs site.

[MIT](https://github.com/ljodea/ggsvelte/blob/main/LICENSE) © Liam O'Dea
