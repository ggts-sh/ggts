---
"@ggts-sh/core": patch
"@ggts-sh/react": patch
"@ggts-sh/svelte": patch
---

Stop walking every source row on each hover of a stat mark. Smooth and density lines have many vertices that share one list of source rows, and each pointer move walked that list again. At 100k rows, a hover along a smooth line now takes under 1 ms, from about 58 ms in React and 24 ms in Svelte. In React, a selection change on such a line takes about 4 ms, from about 1.5 s, because the hook no longer walks the rows once per vertex. Inspection results do not change. Snapshots of the same line now share one frozen `sourceKeys` array, so compare its contents and not its identity. `@ggts-sh/core/interaction` adds the experimental `createSourceKeysCache`, and `materializeInspection` takes an optional cache as a last argument.
