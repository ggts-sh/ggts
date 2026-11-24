---
"@ggts-sh/spec": minor
---

Add the `missing-chart-title` spec-lint advisory (`needs: "spec"`). It advises at `/labs` when `labs.title` is missing or blank and either `labs.subtitle` is non-empty or at least one layer has data, prompting the author to add a one-line `labs.title` stating the chart's message. `lintSpec()`, `validate(spec, { lint: true })`, and the CLI `check`/`render` commands surface it; the advisory never blocks a render.

Migration: none — additive.
