/**
 * Interactions guide section plus the interaction reference search index.
 */

export const INTERACTIONS_MD = `# Interactions

Static by default. Opt in with \`<Inspect>\`, \`select\`, \`zoom\`, and GuideLegend
\`focus\` / \`filter\` (or the legacy GGPlot \`inspect\` prop, and deprecated plot
props \`legendFocus\` / \`legendFilter\`). With more than one draw tool, an
accessible tool rail keeps gestures from competing.

Without a controller, state is private to one chart and callbacks report
changes. Pass \`createPlotInteraction()\` when plots, controls, or tables share
semantic state (required, stable semantic scope via \`interactionScope\`).

Examples: [inspect](/examples/interactions/inspection),
[interval/zoom](/examples/interactions/interval-selection),
[linked views](/examples/interaction/linked-views),
[legend focus](/examples/interaction/legend-focus),
[legend filter](/examples/interaction/legend-filter),
[facet intervals](/examples/interaction/facet-intervals).
Contracts: [interaction reference](/guide/interaction-reference).

## Inspection

\`<Inspect />\` enables the default HTML tooltip, semantic crosshair, keyboard
traversal, and click-or-Enter pinning (same as the legacy \`inspect={true}\`
prop on \`<GGPlot>\`). Configure it when the chart has a natural comparison
axis:

\`\`\`svelte fragment
<script lang="ts">
  import { GeomLine, GeomPoint, GGPlot, Inspect } from "@ggsvelte/svelte";
</script>

<GGPlot
  {data}
  aes={{ x: "date", y: "value", color: "series" }}
  oninspect={(event) => console.log(event)}
>
  <GeomLine />
  <GeomPoint />
  <Inspect mode="x" pin maxDistance={24} />
</GGPlot>
\`\`\`

The modes are \`auto\`, \`exact\`, \`x\`, \`y\`, and \`xy\`. \`auto\` resolves to a
concrete mode before an event is emitted. \`x\` and \`y\` return one
representative per semantic series at the focused axis value; \`exact\` and
\`xy\` return the focused datum. \`maxDistance\` is measured in CSS pixels: the
dominant axis for \`x\` or \`y\`, Euclidean distance for \`xy\`, and geometry
containment plus tolerance for \`exact\`. Rect marks (\`geom_col\` / \`geom_bar\`)
never draw a point ring; default hover is tooltip-only. Pass
\`muteSiblings\` on \`<Inspect>\` to mute non-focused bars via the interaction mask.
\`tooltipTotal="bottom"\` or \`"top"\` adds a stack/fill Total on exact inspection
without switching \`mode\` to \`"x"\` / \`"y"\`.


For custom HTML, pass a Svelte 5 snippet on \`content\`. Informational content is
the default; choose \`contentMode="interactive"\` only when the pinned tooltip
contains controls that need focus.

\`\`\`svelte fragment
{#snippet details(inspection)}
  <strong>{inspection.focus.row?.name}</strong>
  <span>{inspection.members.length} series at this value</span>
{/snippet}

<GGPlot {data} aes={{ x: "date", y: "value" }}>
  <Inspect mode="x" content={details} />
</GGPlot>
\`\`\`

## Point and interval selection

Point selection is durable identity, not a renderer index. Identity defaults
to an \`id\` column or row index; override with \`identity\` on Select / Inspect
for a non-\`id\` natural key:

\`\`\`svelte fragment
<GGPlot
  select={{ type: "point", multiple: true, identity: "id" }}
  onselect={(event) => {
    if (event.mode === "point") selectedKeys = event.keys;
  }}
/>
\`\`\`

Use interval selection for brushing. The callback receives both the selected
domain and normalized plot-pixel rectangle, plus semantic keys and a lineage
count for aggregate marks.

\`\`\`svelte fragment
<GGPlot
  select={{ type: "interval", mode: "xy", persistent: true }}
  onselect={(event) => {
    if (event.mode !== "point" && event.phase === "end") {
      selectedDomain = event.domain;
    }
  }}
/>
\`\`\`

Faceted intervals use stable field-and-value panel identities rather than panel
indices. Choose a preset for the relationship between panels:

- \`independent\` (default) replaces the interval in only the origin panel.
- \`union\` keeps independently drawn panel intervals and combines their keys.
- \`cross-panel\` projects one semantic domain through every compatible panel.

\`cross-panel\` intersects the interval with each panel's domain when facet
scales are free; a disjoint panel selects nothing instead of clamping to an
unrelated edge. Panel identity survives row reordering and temporary absence.
See the [runnable facet example](/examples/interaction/facet-intervals).

## Shared controlled state

\`createPlotInteraction<Key>()\` owns selection, emphasis, and continuous zoom
domains outside any chart. Give linked consumers the same controller and a
required, stable semantic scope via \`interactionScope\`. A transition is
published once by its origin; passive charts render the new snapshot without
emitting the callback again. Controlled plots never infer channel names: add an
\`x\` and/or \`y\` scope whenever controlled zoom uses that channel.

\`\`\`svelte fragment
<script lang="ts">
  import { createPlotInteraction } from "@ggsvelte/svelte";

  const interaction = createPlotInteraction<string>({ identity: "id" });
  const scope = { keys: "penguin-id", x: "flipper-mm", y: "mass-g" } as const;
  const selected = $derived(interaction.selected(scope));
</script>

<GGPlot
  {data}
  select={{ type: "point", multiple: true }}
  {interaction}
  interactionScope={scope}
/>
<GGPlot
  {data}
  select={{ type: "point", multiple: true }}
  {interaction}
  interactionScope={scope}
/>
<button onclick={() => interaction.setSelection(["gentoo-1"], { scope })}>
  Select Gentoo 1
</button>
\`\`\`

Use \`setSelection\`, \`toggleSelection\`, and \`clearSelection\` for durable
keys. \`setEmphasis\` is presentation-only: linked charts update their highlight
overlay without retraining scales or rerunning the render pipeline. Matching
\`x\` and \`y\` scope names share numeric zoom domains. When application data is
replaced, call \`reconcileKeys(validKeys, { scope })\` explicitly; a chart never
guesses whether a temporary subset should erase another view's selection.

Durable facet intervals use their own optional \`interactionScope.intervals\`
namespace (falling back to \`keys\`). Read them with \`intervals(scope)\`, write
one with \`setInterval\`, clear one panel with \`clearInterval\`, or clear the
scope with \`clearIntervals\`. Interval state is semantic data-space state, not
pixels or renderer indices.

## Legend focus

\`<GuideLegend channel="color" focus />\` adds real HTML controls over that
aesthetic's discrete legend. Hover and DOM focus preview one chart without
mutating shared state. Click, touch, Enter, or Space commits the matching
stable row keys; the active entry or Escape clears them. Arrow keys traverse
entries in rendered legend order, with Home and End moving to the boundaries.

\`focus={{ preview: false }}\` keeps committed activation but disables transient
previews. Continuous ramps remain static. A stable \`key\` is required: encoded
legend values are reported as values, never used as controller keys. Focused
and muted marks share one semantic mask across SVG and canvas, and the mask
does not retrain scales, recompute statistics, change layout, or reassign
colors. Author discrete legend appearance with
[GuideLegend](/reference/guides/legend); see the full
[guides reference](/reference/guides) and the
[runnable three-view example](/examples/interaction/legend-focus). The plot prop
\`legendFocus\` is deprecated since 0.19.0.

## Legend filtering

GuideLegend \`focus\` is presentation emphasis only — it does not change data.
\`<GuideLegend channel="color" filter />\` adds Show-group checkboxes on that
aesthetic's discrete legend and filters rows before facets, stats, scales,
layout, and render. Hidden groups stay in the legend catalog and keep the same
categorical color when shown again.

Use \`filter={{ mode: "exclude", multiple: true }}\` for the default independent
checkboxes. \`mode: "include"\` stores the shown values instead; \`multiple:
false\` makes a toggle isolate one group. \`onlegendfilter\` reports the raw
typed values and field in a \`LegendFilterClause\`. Reset legend filters
restores the data pipeline; Clear legend focus only removes presentation
emphasis. The plot prop \`legendFilter\` is deprecated since 0.19.0. See the
[stable-color example](/examples/interaction/legend-filter).

## Brush zoom

\`zoom={true}\` enables two-dimensional brush zoom. Set \`zoom={{ mode: "x" }}\`
or \`zoom={{ mode: "y" }}\` for a single axis. The tool rail separates Zoom area
from Select area when both are enabled. A completed zoom emits explicit
domains; Reset zoom or double-click emits a clear event.
Faceted interval selection is supported, but faceted brush zoom remains
disabled with \`INTERACTION_INTERVAL_FACET_UNSUPPORTED\`; use a linked detail
view when each facet needs a zoomed inspection surface.

\`\`\`svelte fragment
<GGPlot
  zoom={{ mode: "xy" }}
  onzoom={(event) => console.log(event.domains)}
/>
\`\`\`

## Precise bounds without dragging

After an interval selection or zoom is committed, the tool rail exposes Edit x
or y bounds alongside its drag controls. The inline HTML form stages edits:
typing does not rerun the chart, Apply commits once, Cancel or Escape discards
the draft, and validation focuses the first invalid field. This provides a
keyboard and assistive-technology path to the same semantic result as brushing.

- Linear and reversed scales accept ascending data-space numbers. Reversal is
  presentation only, so do not enter screen order.
- Log scales accept positive ascending numbers.
- Time scales accept ISO 8601 dates or date-times with \`Z\` or an explicit
  offset; events store Unix milliseconds.
- Band scales use two native selects and include both endpoint categories.

Recovery actions are deliberately separate: Clear panel selection removes one
facet interval, Clear all selections removes interval state, Reset zoom restores
natural domains, and Reset legend filters restores excluded rows. None of these
controls silently performs another reset.

## Event reference

All events carry \`type\`, \`phase\`, and \`source\` (\`pointer\`, \`keyboard\`,
\`touch\`, or \`programmatic\`). Use the focused callback for one capability or
\`oninteraction\` for the discriminated union of every event.

### \`oninspect(event: PlotInspection)\`

- A change is \`{ type: "inspect", phase: "change", state, source, mode,
  panelId, focus, members }\`.
- \`state\` is \`transient\` or \`pinned\`; \`members\` is always non-empty and
  \`focus\` is the member under direct inspection.
- \`x\` and \`y\` changes also carry the original logical \`axisValue\` and its
  formatted \`axisLabel\`.
- Dismissal is the small event \`{ type: "inspect", phase: "clear", source }\`.

Each \`PlotDatum\` has \`key\`, source \`row\` when one exists, aggregate
\`sourceKeys\` and \`lineageCount\`, \`layerIndex\`, \`panelId\`, mapped \`fields\`,
and a plot-pixel \`anchor\`. Keyless or synthetic marks expose \`key: null\`;
internal renderer indices never leak into callbacks.

### \`onselect(event: PlotSelection)\`

- Point selection emits \`{ type: "select", phase: "end" | "clear",
  mode: "point", keys, source }\`.
- Interval selection emits \`start\`, \`change\`, \`end\`, and \`clear\` phases with
  \`mode\`, \`panelId\`, \`domain\`, \`pixels\`, \`keys\`, \`lineageCount\`, and
  \`source\`.

### \`onzoom(event: ZoomEvent)\`

- Zoom completion is \`{ type: "zoom", phase: "end", source, domains }\`.
- Reset is \`{ type: "zoom", phase: "clear", source, domains: null }\`.

### \`onlegendfocus(event: LegendFocusEvent)\`

- Preview and commit emit \`{ type: "legend-focus", phase: "change", state,
  source, scale, value, label, keys }\`.
- \`state\` is \`transient\` or \`committed\`. \`value\` is the raw encoded
  domain value while \`keys\` are distinct stable source-row identities.
- Dismissal emits \`{ type: "legend-focus", phase: "clear", source }\`.

### \`onlegendfilter(event: LegendFilterEvent)\`

- A change emits \`{ type: "legend-filter", phase: "change", source, clause }\`.
- \`clause\` names the color or fill scale, source field, typed values, and
  include or exclude mode. Reset emits \`phase: "clear"\` and \`clause: null\`.
- Filtering is data-changing and intentionally separate from the
  presentation-only \`onlegendfocus\` event.

\`oninteraction(event: PlotInteractionEvent)\` receives the same objects. It
does not wrap or duplicate them. A linked chart that consumes shared state
should not re-emit the origin chart's event.

## Keyboard and accessibility defaults

Name charts with \`ariaLabel\` (subject or takeaway — not generic image alt).
Focus the plot, then use arrow keys or brackets to traverse data. Enter or
Space pins inspection, activates point selection, or sets the two corners of
an area, depending on the active tool. Escape dismisses the current
interaction. Keyboard inspection updates a polite live region with a concise
axis, count, and pin summary; complete pinned content remains ordinary labelled
and navigable DOM. Canvas marks keep SVG axes/legends and the accessible
description path.

## Identity and diagnostics

Ordinary charts omit custom identity: the engine uses an \`id\` column when
present, otherwise the row index (order-stable only). For a non-\`id\` natural
key or accessor, set \`identity\` on \`<Inspect>\`, object-form \`select\`, or
\`createPlotInteraction({ identity })\` — not plot-level \`key\` (deprecated).
Keys must be non-null unique \`PropertyKey\` values and stable across updates.
Invalid or duplicate keys emit structured diagnostics through \`ondiagnostic\`.
Stable identity lets pinned inspection and point selection follow a datum when
data is updated.
`;
export interface InteractionReferenceEntry {
  id: string;
  name: string;
  summary: string;
  href: string;
  keywords: readonly string[];
}

/** Search data for the human-facing reference page, kept beside its prose. */
export const INTERACTION_REFERENCE_INDEX: readonly InteractionReferenceEntry[] = [
  {
    id: "static-default",
    name: "Static by default",
    summary: "No capture layer or gesture until a capability is enabled.",
    href: "/guide/interaction-reference#static-default",
    keywords: ["opt in", "capture", "scroll"],
  },
  {
    id: "inspect",
    name: "Inspect and pin",
    summary: "HTML tooltip, semantic crosshair, pointer and keyboard traversal.",
    href: "/guide/interaction-reference#inspect",
    keywords: ["tooltip", "crosshair", "pin", "keyboard"],
  },
  {
    id: "point-selection",
    name: "Point selection",
    summary: "Select records by stable semantic keys, not renderer indices.",
    href: "/guide/interaction-reference#point-selection",
    keywords: ["select", "multiple", "keys"],
  },
  {
    id: "interval-selection",
    name: "Interval selection",
    summary: "Brush a rectangle; receive domain, pixels, and semantic keys.",
    href: "/guide/interaction-reference#interval-selection",
    keywords: ["brush", "rectangle", "domain", "facet", "union", "cross-panel"],
  },
  {
    id: "zoom",
    name: "Brush zoom",
    summary: "Zoom x, y, or both with an explicit area tool and reset path.",
    href: "/guide/interaction-reference#zoom",
    keywords: ["domain", "reset", "double click"],
  },
  {
    id: "legend-focus",
    name: "Legend focus",
    summary: "Preview or commit discrete legend groups across SVG and canvas.",
    href: "/guide/interaction-reference#legendfocus",
    keywords: ["legendFocus", "onlegendfocus", "emphasis", "keyboard", "touch"],
  },
  {
    id: "legend-filter",
    name: "Legend filtering",
    summary: "Include or exclude groups before stats/scales; color identity stable.",
    href: "/guide/interaction-reference#legendfilter",
    keywords: [
      "legendFilter",
      "filter",
      "GuideLegend",
      "onlegendfilter",
      "checkbox",
      "stable color",
    ],
  },
  {
    id: "controlled-tool",
    name: "Controlled tool",
    summary: "Bind active Inspect / Select area / Zoom area to Svelte state.",
    href: "/guide/interaction-reference#controlled-tool",
    keywords: ["tool", "ontoolchange", "state"],
  },
  {
    id: "shared-controller",
    name: "Shared controller",
    summary: "Scoped selection, emphasis, and domains across plots and UI.",
    href: "/guide/interaction-reference#shared-controller",
    keywords: ["createPlotInteraction", "linked views", "scope", "reconcileKeys"],
  },
  {
    id: "identity",
    name: "Stable identity",
    summary: "Unique application keys for inspection and selection across updates.",
    href: "/guide/interaction-reference#identity",
    keywords: ["key", "lineage", "sourceKeys"],
  },
  {
    id: "events",
    name: "Typed events",
    summary: "Focused callbacks or PlotInteractionEvent with explicit phases.",
    href: "/guide/interaction-reference#events",
    keywords: ["oninspect", "onselect", "onzoom", "oninteraction", "phase"],
  },
  {
    id: "diagnostics",
    name: "Diagnostics",
    summary: "Structured codes, props, suggestions, and doc URLs.",
    href: "/guide/interaction-reference#diagnostics",
    keywords: ["ondiagnostic", "warning", "error", "suggestions"],
  },
  {
    id: "accessibility",
    name: "Accessibility",
    summary: "Keyboard traversal, bounds form, live region, labelled DOM, explicit tools.",
    href: "/guide/interaction-reference#accessibility",
    keywords: ["screen reader", "keyboard", "live region", "focus", "bounds", "ISO 8601"],
  },
];
