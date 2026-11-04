---
"@ggts-sh/core": minor
---

`renderToSVGString` and `mountSceneSvg` accept `idPrefix`, so several charts can share one HTML document without stealing each other's clip paths.

SVG ids are document-scoped. Every render emitted `gg-clip-<panel>`, `gg-strip-clip-<panel>`, `gg-paint-*` and `gg-ramp-*`, so inlining two charts in one page made the second chart's `url(#gg-clip-0)` resolve to the first chart's panel rect: marks below that height vanished with no error or warning (a report, a slide deck, a print-to-PDF page).

`idPrefix` namespaces every id and every `url(#…)` reference a render emits. Use a distinct value per chart:

```ts
const a = renderToSVGString(spec, {
  width: 400,
  height: 150,
  idPrefix: "chart-a",
});
const b = renderToSVGString(spec, {
  width: 400,
  height: 400,
  idPrefix: "chart-b",
});
document.body.innerHTML = a + b;
```

`mountSceneSvg` takes the same option and keeps patched references in sync. Omitted, ids stay `gg-*` and output stays byte-identical, so existing goldens and single-chart pages are unchanged.

Migration: none — additive
