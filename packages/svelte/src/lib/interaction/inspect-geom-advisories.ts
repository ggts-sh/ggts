/**
 * Inspect-mode × geom advisories — re-export pure collectors from @ggts-sh/core
 * so host plot-engine and the headless CLI share one implementation (#1531).
 *
 * Catalog messages for these codes also live in core
 * (`INSPECT_GEOM_DIAGNOSTIC_CATALOG`); INTERACTION_DIAGNOSTIC_CATALOG spreads them.
 * CLI-only helpers (`collectInspectIntentDiagnostics`, intent modes) stay on
 * `@ggts-sh/core` — do not re-export them here (knip).
 */
export {
  discreteColorFillDomainSizes,
  HIGH_CARDINALITY_DISCRETE_THRESHOLD,
  inspectAxisOnBarColDiagnostics,
  inspectAxisOnDistributionDiagnostics,
  inspectHighCardinalityDiagnostics,
  layerGeomsFromSpecLayers,
} from "@ggts-sh/core";
