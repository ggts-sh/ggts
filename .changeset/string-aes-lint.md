---
"@ggts-sh/spec": patch
---

`lintSpec()` no longer throws on authoring-sugar string aes (`aes({ x: "col" })`). `effectiveChannel()` canonicalizes a bare string to `{ field }` before structure, data, and lint checks read it, so `lintSpec()` and `validate(spec, { lint: true })` return advisories on builder output instead of a `TypeError` (#1896).
