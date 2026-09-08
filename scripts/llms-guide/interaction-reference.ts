/**
 * Human-facing interaction reference page, built from the diagnostics catalog.
 */

import { INTERACTION_DIAGNOSTIC_CATALOG } from "../../packages/svelte/src/lib/interaction/interaction";

const interactionDiagnostics = Object.values(INTERACTION_DIAGNOSTIC_CATALOG)
  .map(
    (entry) => `### \`${entry.code}\`

${entry.message}

- Prop: \`${entry.prop}\`
- Severity: \`${entry.severity}\`
- Try: ${entry.suggestions.join("; ")}
- More: [${entry.docUrl}](${entry.docUrl})`,
  )
  .join("\n\n");

export const INTERACTION_REFERENCE_MD = `# Interaction reference

Searchable interaction contract. Chart-local state and callbacks by default.
\`createPlotInteraction()\` for shared semantic state across plots and UI.

## Static default

No capture layer, tooltip, selection, or zoom until a capability is enabled.
Page scroll is not hijacked by unused tools.

## Capability props

### \`inspect\`

Prefer the declaration child \`<Inspect />\` (or \`<Inspect mode="x" pin />\`,
etc.). Options match the legacy GGPlot prop: \`mode\`, \`pin\`, \`maxDistance\`,
\`content\`, \`contentMode\`, \`muteSiblings\`, \`tooltipTotal\`. Empty \`<Inspect />\` equals
\`inspect={true}\`. The GGPlot \`inspect\` prop still works. The heading id stays
\`inspect\` for stable deep links.


### Point selection

\`select={{ type: "point", multiple: true }}\` stores stable semantic keys.
Identity defaults to an \`id\` column or row index; override with
\`select={{ type: "point", identity: "…" }}\` or \`<Inspect identity="…" />\`.

### Interval selection

\`select={{ type: "interval", mode: "x" | "y" | "xy", persistent: true }}\`
enables an explicit Select area tool and emits domain and pixel bounds. In
facets, add \`preset: "independent" | "union" | "cross-panel"\` to replace one
panel, combine panel selections, or project one domain through compatible
panels.

### \`zoom\`

\`zoom={{ mode: "x" | "y" | "xy" }}\` enables the explicit Zoom area tool.
Reset zoom and double-click return to the natural domains.

### \`legendFocus\`

Prefer \`<GuideLegend channel="color" focus />\` (boolean or
\`{ preview?: boolean }\`) for discrete legend preview and committed focus on
that aesthetic. Host-only — never a PortableSpec / \`guideLegend()\` field. Use
\`focus={{ preview: false }}\` to disable hover/focus preview while retaining
click, touch, Enter, Space, Escape, and arrow-key controls. Requires stable
row \`key\` values; continuous ramps stay static.

The plot prop \`legendFocus={true}\` is deprecated since 0.19.0 (removed in
0.20.0) and still enables focus plot-wide during the dual-read window — see
[Legend focus on GuideLegend](/guide/upgrading#legend-focus-on-guidelegend).

### \`legendFilter\`

Prefer \`<GuideLegend channel="color" filter />\` (boolean or
\`{ mode?: "exclude" | "include", multiple?: boolean }\`) for data-changing
checkboxes on that aesthetic's discrete legend. Host-only — never a
PortableSpec / \`guideLegend()\` field. It changes the rows supplied to facets,
statistics, scales, and rendering while preserving the full legend catalog and
categorical color identity. Receive typed clauses through \`onlegendfilter\`.
Independent of presentation-only GuideLegend \`focus\`.

The plot prop \`legendFilter={true}\` is deprecated since 0.19.0 (removed in
0.20.0) and still enables filter plot-wide during the dual-read window — see
[Legend filter on GuideLegend](/guide/upgrading#legend-filter-on-guidelegend).

## Controlled tool

\`tool\` and \`ontoolchange\` control the active Inspect, Select area, or Zoom
area mode. Keep the value in Svelte state when application controls and the
plot tool rail must stay synchronized:

\`\`\`svelte fragment
<script lang="ts">
  import { GGPlot, Inspect, type InteractionTool } from "@ggts-sh/svelte";

  let activeTool = $state<InteractionTool>("inspect");
</script>

<GGPlot
  select={{ type: "interval" }}
  tool={activeTool}
  ontoolchange={(next) => (activeTool = next)}
>
  <Inspect />
</GGPlot>
\`\`\`

A controlled unavailable tool requests a change and emits a diagnostic; it
does not silently arm a different drag behavior. The active tool remains local
to one chart; shared controllers coordinate data semantics, not UI modes.

## Shared controller

\`createPlotInteraction<Key>({ onchange? })\` returns a reactive
\`PlotInteractionController<Key>\`. Pass it through the \`interaction\` prop and
name the semantic channels with the required
\`interactionScope={{ keys, x?, y? }}\`; controlled plots never fall back to a
generic scope or infer x/y channel names from encodings. Controlled zoom
requires an explicit scope for every active channel (x, y, or both).

- Reads: \`selected(scope)\`, \`emphasized(scope)\`, \`intervals(scope)\`,
  \`isSelected(key, scope)\`, \`zoom(scope)\`, \`snapshot\`, and \`revision\`.
- Selection: \`setSelection\`, \`toggleSelection\`, and \`clearSelection\`.
- Lightweight presentation: \`setEmphasis\` and \`clearEmphasis\`.
- Facet intervals: \`setInterval\`, \`clearInterval\`, and \`clearIntervals\`.
- Domains: \`setZoom\` and \`resetZoom\` for finite numeric x/y pairs.
- Data replacement: \`reconcileKeys(validKeys, { scope })\` explicitly removes
  selected or emphasized keys that no longer exist.

Scopes are application-level names. Reuse a key scope only where keys mean the
same thing, and reuse x/y scopes only where their data domains are compatible.
Every mutation returns one immutable transition or \`null\` for a no-op. Passive
consumers never republish controller state, preventing linked-view feedback
loops. Do not mutate the controller inside its synchronous \`onchange\`
callback; schedule a later Svelte application update instead. See the
[linked views example](/examples/interaction/linked-views).

## Identity

\`key\` is a field name or accessor returning a unique stable \`PropertyKey\`. Public
events expose semantic keys, aggregate \`sourceKeys\`, and \`lineageCount\`,
never renderer indices.

## Events

### \`oninspect\`

Receives \`PlotInspection\`: \`change\` with transient or pinned focus and
members, or \`clear\`.

### \`onselect\`

Receives \`PlotSelection\`. Point selection emits \`end\` and \`clear\`.
Interval selection emits \`start\`, \`change\`, \`end\`, and \`clear\`.

### \`onzoom\`

Receives \`ZoomEvent\`: \`end\` with explicit domains or \`clear\` with null
domains.

### \`onlegendfocus\`

Receives \`LegendFocusEvent\`: a transient or committed \`change\` carrying the
raw encoded value, formatted label, scale channel, and stable row keys, or a
small \`clear\` event. The same object is included in \`oninteraction\`.

### \`onlegendfilter\`

Receives \`LegendFilterEvent\`: a \`change\` with one typed
\`LegendFilterClause\`, or \`clear\` with \`clause: null\`. Legend filtering
changes pipeline input and is not folded into the presentation interaction
union.

### \`oninteraction\`

Receives the same discriminated \`PlotInteractionEvent\` union emitted by the
focused callbacks. Narrow on \`type\` and \`phase\`.

### \`ondiagnostic\`

Receives structured \`PlotDiagnostic\` objects (\`InteractionDiagnostic\` or
\`DeprecationDiagnostic\`) with \`severity\`, \`code\`, \`message\`, \`prop\`,
\`suggestions\`, and \`docUrl\`. Deprecation advisories also carry \`since\`
and \`removeIn\`.

\`\`\`svelte fragment
<GGPlot
  ondiagnostic={(diagnostic) =>
    console.warn(diagnostic.code, diagnostic.message, diagnostic.suggestions)}
/>
\`\`\`

Every event has a \`source\`: \`pointer\`, \`keyboard\`, \`touch\`, or
\`programmatic\`.

## Diagnostics

${interactionDiagnostics}

## Accessibility

The plot surface is named and keyboard focusable when interaction is enabled.
Arrow keys or brackets traverse data; Enter or Space pins or commits the active
tool; Escape dismisses. A polite live region announces concise state while
pinned HTML remains labelled, navigable DOM. Area tools remain explicit so
ordinary page scrolling is available until a user chooses a drag mode.

Committed interval and zoom state exposes precise Edit-bounds buttons in the
tool rail. Their inline form uses labelled native inputs, stages drafts until
Apply, validates log/time/category constraints, restores trigger focus after
Apply or Cancel, and supports Escape. Linear and reversed domains use ascending
data values; time uses ISO 8601 text; band intervals use inclusive native
selects. Clear panel selection, Clear all selections, Reset zoom, and Reset
legend filters remain separate operations.
`;
