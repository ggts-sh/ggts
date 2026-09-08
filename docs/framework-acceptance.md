# Framework launch acceptance — 0.43.0

React and Svelte share the PortableSpec grammar and core interaction semantics.
This matrix fixes the launch contract; it does not claim complete ggplot2 compatibility.
Paths below are relative to the repository root. Browser suites run Chromium,
Firefox and WebKit through each adapter's Vitest configuration.

| Contract                                                                      | React evidence                                                                                     | Svelte / shared evidence                                                                                    |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Grammar composition, updates and public exports                               | `packages/react/tests/component.test.tsx`, `exports.test.ts`                                       | `packages/svelte/tests/geoms/`, `packages/compose/tests/`                                                   |
| Real SSR SVG, hydration and resource identity                                 | `packages/react/tests/parity.test.tsx`                                                             | `packages/svelte/tests/ssr-harness.ssr.test.ts`, `hydration-harness.test.ts`                                |
| StrictMode cleanup, conditional children, responsive readiness                | `packages/react/tests/parity.test.tsx`                                                             | `packages/svelte/tests/runtime/`                                                                            |
| Keyboard inspection, pin/dismiss, custom host content                         | `packages/react/tests/parity.test.tsx`, `gallery-examples.test.tsx`                                | `packages/svelte/tests/inspection/`                                                                         |
| Grouped inspection members, axis semantics and totals                         | `packages/react/tests/acceptance.test.tsx`                                                         | `packages/svelte/tests/inspection/resolve-snapshot-transient-members.test.ts`                               |
| Point/interval selection, precise zoom bounds, linked views                   | `packages/react/tests/interaction.test.tsx`, `plot-controls.test.tsx`, `gallery-examples.test.tsx` | `packages/svelte/tests/interaction/`, `packages/core/tests/interaction-canonical.test.ts`                   |
| Legend filtering, focus and restoration                                       | `packages/react/tests/parity.test.tsx`, `gallery-examples.test.tsx`                                | `packages/svelte/tests/legend/`                                                                             |
| Canvas alternatives update with data; backend replacement removes stale marks | `packages/react/tests/acceptance.test.tsx`                                                         | `packages/svelte/tests/a11y/canvas-a11y-component.test.ts`, `interaction/interaction-canvas-strata.test.ts` |
| Hover after zoom does not rerun the pipeline                                  | `packages/react/tests/acceptance.test.tsx`                                                         | `packages/svelte/tests/interaction/interaction-hover-tooltip.test.ts`                                       |
| Generated prop types and diagnostics                                          | `scripts/gen-react-children.test.ts`, `packages/react/tests/component.test.tsx`                    | `scripts/gen-geom-children.test.ts`, shared core diagnostic tests                                           |
| Packed consumers and complete quickstarts                                     | `scripts/consumer-compat-react-fixture.ts`, `scripts/consumer-compat-skill.ts`                     | `scripts/consumer-compat-fixture.ts`, `scripts/agent-quickstart.test.ts`                                    |

Run the focused additional acceptance checks with:

```sh
cd packages/react
bunx vitest run tests/acceptance.test.tsx
```

Run the full adapter suites with `bun run test:components`; packed version and
platform qualification follows `support-matrix.json` through `bun run compat:consumer`.
Publication, destination CI and domain verification remain separate launch gates
in [the migration runbook](ggts-migration.md).
