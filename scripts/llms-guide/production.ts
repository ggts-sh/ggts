/**
 * Production guide section (docs pages + llms surfaces).
 */

import supportMatrix from "../../support-matrix.json";

export const PRODUCTION_MD = `# Production

## Responsive sizing

Omit width: GGPlot observes its container. Positive-width block, no chart CSS.
Omitted height: 400px default. Collapsed parent, hidden tab, or zero-width track
→ not-ready until ResizeObserver reports positive width. Do not paper over that
with a fake fixed width. [Troubleshooting](/guide/errors#quickstart-troubleshooting).

SSR uses an 832×400 deterministic fallback and stays not-ready in HTML until
hydration measures the real container. Reserve layout space to avoid CLS.

## Rendering

Renderer follows mark density and interaction needs. Axes, legends, labels, and
a11y chrome stay semantic regardless of SVG vs canvas.

SVG: DOM marks. Canvas: dense strata. Auto: switches above the published
threshold (\`CANVAS_AUTO_THRESHOLD\`) and emits \`canvas-auto\`. Force with
layer \`"render": "canvas"\` or \`render="canvas"\`; axes, legends, and a11y
chrome stay SVG.

Inspection and selection use the model-owned candidate store, not DOM hit tests.
Stable keys keep identity across SVG/canvas; renderer indices never appear in
public callbacks. Measure with repo fixtures before forcing canvas globally.
For a real-data scatter surface, see [scatter color](/examples/point/scatter-color).

## Server and export

One PortableSpec: React or Svelte SSR, pure \`renderToSVGString\`, CLI.

\`\`\`ts fragment
import { registerAll, renderToSVGString } from "@ggts-sh/core";

// Headless full-grammar rendering (#1420): explicit opt-in.
registerAll();

const svg = renderToSVGString(spec, { width: 640, height: 400 });
\`\`\`

\`\`\`sh fragment
# npm install -g @ggts-sh/cli
ggts check spec.json
ggts render spec.json > chart.svg
\`\`\`

SVG on stdout; JSON Lines diagnostics on stderr — the agent feedback loop.
[CLI reference](/reference/cli).

## Compatibility

Every release is tested as an installed package: clean install, strict
type-check, client build, server render, pure Node render, and the
\`ggts\` CLI.

- Node.js \`${supportMatrix.node.range}\` (${supportMatrix.node.tested.join(" and ")} in CI; ${supportMatrix.node.canary} nightly)
- React DOM \`${supportMatrix.react.range}\` (tested floor ${supportMatrix.react.minimum}, current ${supportMatrix.react.current})
- Svelte \`${supportMatrix.svelte.range}\` (tested floor ${supportMatrix.svelte.minimum}, current ${supportMatrix.svelte.current})
- npm ${supportMatrix.packageManagers.npm}, pnpm ${supportMatrix.packageManagers.pnpm}, Bun ${supportMatrix.packageManagers.bun}
- Chromium, Firefox, and WebKit (Playwright ${supportMatrix.browsers.playwright})
- Ubuntu and Windows in CI; macOS nightly

Exact machine-checked rows live in
[support-matrix.json](https://github.com/ggts-sh/ggts/blob/main/support-matrix.json).
Bun is the contributor toolchain only; consumers can use any installer above.
`;
