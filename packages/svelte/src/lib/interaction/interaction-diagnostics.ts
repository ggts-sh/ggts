/**
 * Agent-facing interaction diagnostic catalog — frozen codes, messages, and
 * doc URLs for capability normalization and runtime key/lineage checks.
 *
 * Extracted from interaction.ts so pure catalog data is not mixed with event
 * types and normalizeInteractionConfig.
 *
 * Inspect×geom advisories (bar/col x-guide + high-cardinality) are owned by
 * @ggts-sh/core so the CLI --inspect path reuses the same messages (#1531).
 */
import { INSPECT_GEOM_DIAGNOSTIC_CATALOG } from "@ggts-sh/core";

export type InteractionDiagnosticCode =
  | "INTERACTION_INTERVAL_FACET_UNSUPPORTED"
  | "INTERACTION_INVALID_MAX_DISTANCE"
  | "INTERACTION_POINT_REQUIRES_KEY"
  | "INTERACTION_INTERVAL_PRESET_REQUIRES_KEY"
  | "INTERACTION_INVALID_KEY"
  | "INTERACTION_DUPLICATE_KEY"
  | "INTERACTION_UNSTABLE_KEY"
  | "INTERACTION_MISSING_LINEAGE"
  | "INTERACTION_LEGEND_REQUIRES_KEY"
  | "INTERACTION_LEGEND_DISCRETE_ONLY"
  | "INTERACTION_INTERVAL_SCALE_UNSUPPORTED"
  | "INTERACTION_TOOL_UNAVAILABLE"
  | "INTERACTION_SCOPE_WITHOUT_CONTROLLER"
  | "INTERACTION_HANDLER_WITHOUT_CAPABILITY"
  | "INTERACTION_INSPECT_X_ON_COL"
  | "INTERACTION_INSPECT_X_ON_BAR"
  | "INTERACTION_INSPECT_X_BISECTS_COL_LABELS"
  | "INTERACTION_INSPECT_X_BISECTS_BAR_LABELS"
  | "INTERACTION_INSPECT_AXIS_ON_VIOLIN"
  | "INTERACTION_INSPECT_AXIS_ON_BOXPLOT"
  | "INTERACTION_INSPECT_AXIS_ON_ERRORBAR"
  | "INTERACTION_INSPECT_AXIS_ON_LINERANGE"
  | "INTERACTION_INSPECT_AXIS_ON_POINTRANGE"
  | "INTERACTION_INSPECT_AXIS_ON_CROSSBAR"
  | "INTERACTION_INSPECT_IDENTITY_DROPPED"
  | "INTERACTION_DUPLICATE_INSPECT_CAPABILITY"
  | "INTERACTION_INSPECT_HIGH_CARDINALITY_DISCRETE";

export interface InteractionDiagnostic {
  readonly severity: "error" | "warning" | "advisory";
  readonly code: InteractionDiagnosticCode;
  readonly message: string;
  readonly prop: string;
  readonly actual?: unknown;
  readonly suggestions: ReadonlyArray<string>;
  readonly docUrl: string;
}

export const INTERACTION_DIAGNOSTIC_CATALOG: Readonly<
  Record<InteractionDiagnosticCode, Omit<InteractionDiagnostic, "actual">>
> = Object.freeze({
  INTERACTION_INTERVAL_FACET_UNSUPPORTED: {
    severity: "warning",
    code: "INTERACTION_INTERVAL_FACET_UNSUPPORTED",
    message: "Brush zoom currently requires one unfaceted panel.",
    prop: "zoom",
    suggestions: [
      "Remove the facet",
      "Use faceted interval selection",
      "Zoom a linked detail view",
    ],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-interval-facet-unsupported",
  },
  INTERACTION_INVALID_MAX_DISTANCE: {
    severity: "error",
    code: "INTERACTION_INVALID_MAX_DISTANCE",
    message: "inspect.maxDistance must be a finite non-negative CSS-pixel distance.",
    prop: "inspect.maxDistance",
    suggestions: ["Use a finite number greater than or equal to zero"],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-invalid-max-distance",
  },
  INTERACTION_POINT_REQUIRES_KEY: {
    severity: "warning",
    code: "INTERACTION_POINT_REQUIRES_KEY",
    message: "Durable point selection requires resolved row identity.",
    prop: "identity",
    suggestions: [
      "Ordinary charts omit identity — defaults to an id column or row index",
      'Override with <Inspect identity="id" /> or select={{ type: "point", identity: "id" }}',
    ],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-point-requires-key",
  },
  INTERACTION_INTERVAL_PRESET_REQUIRES_KEY: {
    severity: "warning",
    code: "INTERACTION_INTERVAL_PRESET_REQUIRES_KEY",
    message:
      "Coordinated interval presets (union, cross-panel) require resolved row identity; without it they combine no rows.",
    prop: "identity",
    suggestions: [
      "Ordinary charts omit identity — defaults to an id column or row index",
      'Override with select={{ type: "interval", identity: "id", … }} or <Inspect identity="id" />',
    ],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-interval-preset-requires-key",
  },
  INTERACTION_INVALID_KEY: {
    severity: "error",
    code: "INTERACTION_INVALID_KEY",
    message: "A key accessor returned null, undefined, or a non-PropertyKey value.",
    prop: "identity",
    suggestions: ["Return a stable string, number, or symbol for every row"],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-invalid-key",
  },
  INTERACTION_DUPLICATE_KEY: {
    severity: "error",
    code: "INTERACTION_DUPLICATE_KEY",
    message:
      "The key accessor returned a duplicate value; durable interaction is disabled for that value.",
    prop: "identity",
    suggestions: ["Use a field that uniquely identifies each source row"],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-duplicate-key",
  },
  INTERACTION_UNSTABLE_KEY: {
    severity: "error",
    code: "INTERACTION_UNSTABLE_KEY",
    message: "The key accessor returned a different value for the same source row.",
    prop: "identity",
    suggestions: ["Return an immutable field that uniquely identifies each row"],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-unstable-key",
  },
  INTERACTION_MISSING_LINEAGE: {
    severity: "warning",
    code: "INTERACTION_MISSING_LINEAGE",
    message: "A synthetic or aggregate mark did not expose source-row lineage.",
    prop: "layers",
    suggestions: ["Use a stat that preserves source-row lineage"],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-missing-lineage",
  },
  INTERACTION_LEGEND_REQUIRES_KEY: {
    severity: "warning",
    code: "INTERACTION_LEGEND_REQUIRES_KEY",
    message:
      "Legend focus requires resolved row identity so encoded legend values never become identities.",
    prop: "identity",
    suggestions: [
      "Ordinary charts omit identity — defaults to an id column or row index",
      'Override with <Inspect identity="id" /> or createPlotInteraction({ identity: "id" })',
    ],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-legend-requires-key",
  },
  INTERACTION_LEGEND_DISCRETE_ONLY: {
    severity: "advisory",
    code: "INTERACTION_LEGEND_DISCRETE_ONLY",
    message:
      "Legend focus currently applies to discrete color and fill legends; continuous ramps remain static.",
    prop: "focus",
    suggestions: [
      'Enable focus on a discrete guide: <GuideLegend channel="color" focus />',
      "Use a discrete color or fill mapping",
      "Keep the continuous ramp static",
    ],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-legend-discrete-only",
  },
  INTERACTION_INTERVAL_SCALE_UNSUPPORTED: {
    severity: "warning",
    code: "INTERACTION_INTERVAL_SCALE_UNSUPPORTED",
    message: "Interval domains and brush zoom require continuous linear, log, or time scales.",
    prop: "scales",
    suggestions: ["Use a continuous positional scale", "Use point inspection for band data"],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-interval-scale-unsupported",
  },
  INTERACTION_TOOL_UNAVAILABLE: {
    severity: "warning",
    code: "INTERACTION_TOOL_UNAVAILABLE",
    message: "The requested interaction tool is unavailable for the enabled capabilities.",
    prop: "tool",
    suggestions: ["Enable the matching capability", "Choose an available interaction tool"],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-tool-unavailable",
  },
  INTERACTION_SCOPE_WITHOUT_CONTROLLER: {
    severity: "advisory",
    code: "INTERACTION_SCOPE_WITHOUT_CONTROLLER",
    message:
      "interactionScope is ignored without an interaction controller; chart-local scope is derived from key and aes.",
    prop: "interactionScope",
    suggestions: [
      "Pass interaction={createPlotInteraction()} to control this plot",
      "Remove interactionScope from uncontrolled plots",
    ],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-scope-without-controller",
  },
  INTERACTION_HANDLER_WITHOUT_CAPABILITY: {
    severity: "advisory",
    code: "INTERACTION_HANDLER_WITHOUT_CAPABILITY",
    // Emitted with `prop` overridden to the concrete handler name and
    // `actual` naming the capability prop that would enable it.
    message:
      "An interaction handler is set but its capability prop is not enabled, so the handler never fires.",
    prop: "oninspect / onselect / onzoom / onlegendfocus / onlegendfilter",
    suggestions: [
      "Enable the matching capability prop (for example select for onselect)",
      "Remove the unused handler",
    ],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-handler-without-capability",
  },
  ...INSPECT_GEOM_DIAGNOSTIC_CATALOG,
  INTERACTION_INSPECT_IDENTITY_DROPPED: {
    severity: "advisory",
    code: "INTERACTION_INSPECT_IDENTITY_DROPPED",
    message:
      "An <Inspect> child replaced the inspect prop whole (REPLACE), so the prop's `identity` no longer applies; rows fall back to an id column or row index.",
    prop: "Inspect",
    suggestions: [
      "Move identity onto the <Inspect> child",
      "Drop identity from the inspect prop if the default row identity is intended",
    ],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-inspect-identity-dropped",
  },
  INTERACTION_DUPLICATE_INSPECT_CAPABILITY: {
    severity: "advisory",
    code: "INTERACTION_DUPLICATE_INSPECT_CAPABILITY",
    message:
      "Multiple <Inspect> children are registered; only the last one's options apply (REPLACE).",
    prop: "Inspect",
    suggestions: [
      "Keep a single <Inspect> child",
      "Merge options onto one <Inspect> instead of stacking siblings",
    ],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-duplicate-inspect-capability",
  },
});
