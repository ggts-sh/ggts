---
"@ggts-sh/svelte": minor
"@ggts-sh/react": minor
"@ggts-sh/core": minor
---

Add `@ggts-sh/svelte/lean` and `@ggts-sh/react/lean`. These entries export the same API as the default entries but do not call `registerBasic()` on import. Apps register only the geoms and scale kinds their charts use. A point and line Svelte chart drops from 231.5 KB to 205.7 KB gzip; a React scatter drops from 187.4 KB to 157.7 KB. Both entries and the default entries now re-export the per-family register functions (`registerBasicPoints`, `registerOrdinalColor`, `registerDefaultOrdinalColor`, …), and `@ggts-sh/core` exports `registerDefaultOrdinalColor` from its main entry. Migration: none — additive. The default entries keep their behavior.
