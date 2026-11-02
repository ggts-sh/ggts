/**
 * Checked emission registry (#628).
 *
 * Catalog completeness is proven by this data matching the catalogs 1:1, not by
 * scanning source text for string literals. When you add a catalog code, add a
 * registry entry here (TypeScript fails the satisfies check if you forget).
 * When you emit a new dual-channel rich diagnostic, register its factory module.
 */
import type { PipelineErrorCode } from "./diagnostics-error-catalog.js";
import type { PipelineWarningCode } from "./diagnostics-warning-catalog.js";
import type { AdvisoryCode, CLIDiagnosticCode } from "./diagnostics.js";

type EmissionChannel = "warning" | "advisory" | "error" | "cli";

interface EmissionRegistryEntry {
  channel: EmissionChannel;
  /**
   * Module that owns structured dual-channel projection (lean + rich from
   * facts). Absent when the code is lean-only or assembled later without
   * message parsing.
   */
  dualChannelModule?: "pipeline/diagnostics-emit" | "pipeline/prepare-panels-frames";
}

/** Every pipeline warning code must appear exactly once. */
export const WARNING_EMISSION_REGISTRY = {
  "facet-levels-missing": { channel: "warning" },
  "facet-levels-unknown": { channel: "warning" },
  "empty-data": { channel: "warning" },
  "empty-layer": { channel: "warning" },
  "empty-domain": { channel: "warning" },
  "removed-missing": { channel: "warning" },
  "raster-irregular-spacing": { channel: "warning" },
  "scale-transform-domain": {
    channel: "warning",
    dualChannelModule: "pipeline/prepare-panels-frames",
  },
  "scale-oob-censored": {
    channel: "warning",
    dualChannelModule: "pipeline/prepare-panels-frames",
  },
  "scale-oob-squished": {
    channel: "warning",
    dualChannelModule: "pipeline/prepare-panels-frames",
  },
  "scale-break-outside-domain": {
    channel: "warning",
    dualChannelModule: "pipeline/diagnostics-emit",
  },
  "sequential-discrete-field": { channel: "warning" },
  "color-temporal-censored": { channel: "warning" },
  "color-transform-invalid": { channel: "warning" },
  "color-na-values": { channel: "warning" },
  "color-unknown-values": { channel: "warning" },
  "style-temporal-censored": { channel: "warning" },
  "style-na-values": { channel: "warning" },
  "style-unknown-values": { channel: "warning" },
  "style-palette-exhausted": { channel: "warning" },
  "style-fingerprint-mismatch": { channel: "warning" },
  "style-version-mismatch": { channel: "warning" },
  "style-out-of-domain": { channel: "warning" },
  "invalid-label-format": { channel: "warning" },
  "unknown-edition": { channel: "warning" },
  "color-on-fill-geom": { channel: "warning" },
  "weight-unsupported": { channel: "warning" },
  "density-group-dropped": { channel: "warning" },
  "contour-group-dropped": { channel: "warning" },
  "density-2d-group-dropped": { channel: "warning" },
  "density-2d-filled-open-dropped": { channel: "warning" },
  "sf-coordinates-dropped": { channel: "warning" },
  "map-region-missing": { channel: "warning" },
  "group-single-observation": { channel: "warning" },
  "stack-align-skipped": { channel: "warning" },
  "smooth-group-dropped": { channel: "warning" },
  "quantile-empty": { channel: "warning" },
  "quantile-group-dropped": { channel: "warning" },
  "manual-group-dropped": { channel: "warning" },
  "ellipse-group-dropped": { channel: "warning" },
  "stat-channel-unsupported": { channel: "warning" },
  "palette-exhausted": { channel: "warning" },
  "fingerprint-mismatch": { channel: "warning" },
  "version-mismatch": { channel: "warning" },
  "out-of-domain": { channel: "warning" },
  "temporal-values-censored": { channel: "warning" },
  "guide-auto-bottom": { channel: "warning" },
  "unused-scale-option": { channel: "warning" },
  "temporal-label-overlap": { channel: "warning" },
  "temporal-label-margin-overflow": { channel: "warning" },
  "temporal-break-outside-domain": { channel: "warning" },
  "band-label-overlap": { channel: "warning" },
  "band-label-margin-overflow": { channel: "warning" },
  "text-label-overlap": { channel: "warning" },
  "coord-tessellation-cap": { channel: "warning" },
  "coord-invalid-geometry": { channel: "warning" },
  "coord-fixed-degraded": { channel: "warning" },
  "abline-scale-unsupported": { channel: "warning" },
  "function-domain-missing": { channel: "warning" },
  "function-fun-missing": { channel: "warning" },
  "function-fun-unknown": { channel: "warning" },
  "hex-band-scale": { channel: "warning" },
  "hex-missing-size": { channel: "warning" },
  "ydensity-group-dropped": { channel: "warning" },
  "panel-aspect-extreme": { channel: "warning" },
  "panel-height-share-low": { channel: "warning" },
} as const satisfies Record<PipelineWarningCode, EmissionRegistryEntry>;

/** Every advisory code must appear exactly once. */
export const ADVISORY_EMISSION_REGISTRY = {
  "scale-type-inferred": { channel: "advisory" },
  "zero-forced": { channel: "advisory" },
  "scale-baseline-transformed-origin": {
    channel: "advisory",
    dualChannelModule: "pipeline/diagnostics-emit",
  },
  "bar-x-discretized": { channel: "advisory" },
  "bin-default-bins": { channel: "advisory" },
  "smooth-method-inferred": { channel: "advisory" },
  "jitter-seeded": { channel: "advisory" },
  "stack-align-applied": { channel: "advisory" },
  "palette-inferred": { channel: "advisory" },
  "canvas-auto": { channel: "advisory" },
  "temporal-year-inferred": { channel: "advisory" },
  "temporal-inference-ambiguous": { channel: "advisory" },
  "temporal-inference-invalid": { channel: "advisory" },
  "band-labels-wrapped": { channel: "advisory" },
  "band-labels-rotated": { channel: "advisory" },
  "percent-labels-out-of-range": { channel: "advisory" },
} as const satisfies Record<AdvisoryCode, EmissionRegistryEntry>;

/**
 * Error codes are thrown via `new PipelineError(code, …)` / ScaleConfigError.
 * Registry proves intentional catalog membership; dual-channel is N/A.
 */
export const ERROR_EMISSION_REGISTRY = {
  "guide-aesthetic-incompatible": { channel: "error" },
  "guide-layout-overflow": { channel: "error" },
  "no-data": { channel: "error" },
  "dataset-collision": { channel: "error" },
  "unknown-dataset": { channel: "error" },
  "unknown-field": { channel: "error" },
  "all-null-column": { channel: "error" },
  "missing-channel": { channel: "error" },
  "unknown-stat-column": { channel: "error" },
  "channel-type-mismatch": { channel: "error" },
  "computed-y-mapped": { channel: "error" },
  "bin-center-and-boundary": { channel: "error" },
  "rule-form-ambiguous": { channel: "error" },
  "rule-form-missing": { channel: "error" },
  "rule-both-axes": { channel: "error" },
  "ribbon-orientation-ambiguous": { channel: "error" },
  "ribbon-inverted-bounds": { channel: "error" },
  "facet-form-ambiguous": { channel: "error" },
  "facet-form-missing": { channel: "error" },
  "invalid-scale-domain": { channel: "error" },
  "invalid-scale-breaks": { channel: "error" },
  "invalid-temporal-labels": { channel: "error" },
  "invalid-temporal-locale": { channel: "error" },
  "temporal-parse-failed": { channel: "error" },
  "temporal-break-limit": { channel: "error" },
  "temporal-break-progression": { channel: "error" },
  "invalid-scale-transform": { channel: "error" },
  "scale-transform-domain": { channel: "error" },
  "scale-type-transform-conflict": { channel: "error" },
  "scale-zero-invalid-for-transform": { channel: "error" },
  "coord-transform-domain": { channel: "error" },
  "coord-transform-temporal": { channel: "error" },
  "coord-transform-continuous": { channel: "error" },
  "coord-fixed-free-scales": { channel: "error" },
  "coord-fixed-invalid-aspect": { channel: "error" },
  "binned-scale-requires-continuous": { channel: "error" },
  "binned-scale-break-limit": { channel: "error" },
  "palette-exhausted": { channel: "error" },
  "color-temporal-parse": { channel: "error" },
  "color-temporal-kind": { channel: "error" },
  "color-manual-domain-range": { channel: "error" },
  "color-binned-breaks": { channel: "error" },
  "color-binned-empty": { channel: "error" },
  "color-binned-domain": { channel: "error" },
  "color-domain-invalid": { channel: "error" },
  "color-transform-empty": { channel: "error" },
  "color-domain-transform": { channel: "error" },
  "unsupported-aesthetic-scale": { channel: "error" },
  "unsupported-geom-aesthetic": { channel: "error" },
  "unsupported-annotation-style": { channel: "error" },
  "tile-nonpositive-size": { channel: "error" },
  "raster-duplicate-cells": { channel: "error" },
  "unsupported-param": { channel: "error" },
  "invalid-aesthetic-constant": { channel: "error" },
  "style-temporal-parse": { channel: "error" },
  "style-temporal-kind": { channel: "error" },
  "style-manual-domain-range": { channel: "error" },
  "style-palette-exhausted": { channel: "error" },
  "style-domain-empty": { channel: "error" },
  "style-domain-invalid": { channel: "error" },
  "style-range-invalid": { channel: "error" },
  "style-binned-breaks": { channel: "error" },
  "stat-channel-unsupported": { channel: "error" },
  "manual-fun-required": { channel: "error" },
  "manual-fun-unknown": { channel: "error" },
  "unknown-theme": { channel: "error" },
  "renderer-failure": { channel: "error" },
  "max-marks-exceeded": { channel: "error" },
  "sf-geometry-missing": { channel: "error" },
  "sf-geometry-invalid": { channel: "error" },
  "sf-geometry-unsupported": { channel: "error" },
  "sf-geometry-mixed": { channel: "error" },
  "map-data-required": { channel: "error" },
  "map-coords-missing": { channel: "error" },
  "map-id-column-missing": { channel: "error" },
} as const satisfies Record<PipelineErrorCode, EmissionRegistryEntry>;

export const CLI_EMISSION_REGISTRY = {
  usage: { channel: "cli" },
  "unreadable-input": { channel: "cli" },
  "invalid-json": { channel: "cli" },
  "invalid-data-file": { channel: "cli" },
  "max-marks-exceeded": { channel: "cli" },
  internal: { channel: "cli" },
} as const satisfies Record<CLIDiagnosticCode, EmissionRegistryEntry>;
