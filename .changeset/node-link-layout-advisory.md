---
"@ggts-sh/spec": minor
"@ggts-sh/skill": patch
---

Add the `node-link-layout` spec-lint advisory. On data-bearing specs it warns when a `segment` layer's endpoints mostly coincide with `point` rows and at least one node joins three or more non-axis-parallel segments — the shape of a graph drawn from an externally computed layout. `lintSpec()` and `validate(spec, { lint: true })` surface it; the advisory never blocks a render.

Migration: none — additive.
