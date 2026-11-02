---
"@ggts-sh/spec": minor
"@ggts-sh/core": minor
"@ggts-sh/skill": patch
---

Remove the `magma` sequential scheme (#1861). Its ramp was a near-duplicate of `inferno`, so `inferno` is retained unchanged as the replacement and no alias is registered.

`magma` is gone from `SEQUENTIAL_SCHEME_NAMES`, the scheme enums, and the viridis-family `option` lists. Specs or helpers that still name it fail validation.

Replace `scheme: "magma"` / `option: "magma"` with `inferno` in color and fill scales, including ordinal sampling and the `scaleColorViridis*()` / `scaleFillViridis*()` constructors.

Migration: <https://ggts.sh/guide/upgrading#removed-the-magma-sequential-scheme>
