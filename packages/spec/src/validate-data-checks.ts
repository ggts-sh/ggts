/**
 * Tier-2 data-aware orchestrator — resolve evidence, walk layers, then scale/type
 * compatibility (style → position → color diagnostic order).
 *
 * Implementation:
 *  - validate-data-checks-layer.ts — geom/stat rules + field walk + channel collection
 *  - validate-data-checks-temporal.ts — shared temporalDecisionForField memoization
 *  - validate-data-checks-position.ts — pre-evidence temporal axis config + x/y scale types
 *  - validate-data-checks-color.ts — color/fill scale types + manual domain/range
 *  - validate-data-checks-color-temporal.ts — temporal censor recovery lattice
 *  - validate-data-checks-style.ts — shape/linetype + size/linewidth/alpha (finite + numeric modules)
 *
 * Style and color scale checks take the same per-use `evidenceForUse` path as
 * position (#609 / #844): multi-table layers that share a field name keep their
 * own type evidence. The last-wins union `fields` map remains a fallback only.
 *
 * Evidence is one `resolveLayerFieldEvidence` pass (plot + per-layer tables).
 * validate() may pre-resolve and pass the result so lint shares the same pass.
 */
import type { SpecError } from "./errors.js";
import type { Aes, ChannelName } from "./schema.js";
import type { ValidateLimits, ValidateOptions } from "./validate-data.js";
import {
  resolveLayerFieldEvidence,
  type FieldEvidenceMap,
  type ResolveLayerFieldEvidenceResult,
} from "./validate-data-evidence.js";
import { checkColorScaleDataCompatibility } from "./validate-data-checks-color.js";
import { collectLayerDataChecks, STAT_COLUMNS } from "./validate-data-checks-layer.js";
import {
  checkPositionScaleDataCompatibility,
  scaleRequestsTime,
  validateTemporalAxisConfiguration,
} from "./validate-data-checks-position.js";
import {
  checkFiniteStyleScaleDataCompatibility,
  checkNumericStyleScaleDataCompatibility,
} from "./validate-data-checks-style.js";
import type { TemporalDecisionCache } from "./validate-data-checks-temporal.js";

export { STAT_COLUMNS };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function unionFieldEvidence(
  plotFields: FieldEvidenceMap | null,
  layerMaps: readonly (FieldEvidenceMap | null)[],
): FieldEvidenceMap {
  const fields: FieldEvidenceMap = new Map(plotFields ?? undefined);
  const lastUse = new Map<FieldEvidenceMap, number>();
  for (const [index, layerMap] of layerMaps.entries()) {
    if (layerMap !== null) lastUse.set(layerMap, index);
  }
  const inserted = new Set<FieldEvidenceMap>();
  for (const [index, layerMap] of layerMaps.entries()) {
    if (layerMap === null) continue;
    if (lastUse.get(layerMap) === index) {
      for (const [name, entry] of layerMap) fields.set(name, entry);
    } else if (!inserted.has(layerMap)) {
      inserted.add(layerMap);
      // Reserve keys in their original first-seen order.
      for (const [name, entry] of layerMap) if (!fields.has(name)) fields.set(name, entry);
    }
  }
  return fields;
}

export function dataChecks(
  spec: Record<string, unknown>,
  options: ValidateOptions,
  limits: ValidateLimits,
  /**
   * Pre-resolved layer evidence from validate() so the pivot/type pass runs
   * once and can be shared with lintSpec.
   */
  preResolvedLayer?: ResolveLayerFieldEvidenceResult,
): SpecError[] {
  const errors: SpecError[] = [];
  // One cache per dataChecks call — shared by position, color, and style checkers.
  // Nested by FieldEvidenceEntry so same-named fields on different datasets stay independent (#1339).
  const temporalDecisionCache: TemporalDecisionCache = new Map();
  const scales = isRecord(spec["scales"]) ? spec["scales"] : undefined;

  // Pre-evidence: temporal axis configuration (errors even without data/profile).
  const temporalConfig = validateTemporalAxisConfiguration(scales);
  errors.push(...temporalConfig.errors);
  const { invalidTemporalAxes } = temporalConfig;

  // One pass over plot + layer tables (#589 multi-table evidence).
  const layerResolved = preResolvedLayer ?? resolveLayerFieldEvidence(spec, options, limits);
  if (layerResolved.status === "errors") return [...errors, ...layerResolved.errors];
  if (layerResolved.status === "none") return errors;

  const plotFields: FieldEvidenceMap | null = layerResolved.plot;
  const layerMaps = layerResolved.layers;

  const plotAes = isRecord(spec["aes"]) ? (spec["aes"] as Aes) : undefined;
  const layers = Array.isArray(spec["layers"]) ? (spec["layers"] as unknown[]) : [];
  const scaleRequestsTimeForChannel = (channel: ChannelName): boolean => {
    const axis =
      channel === "x" || channel === "xmin" || channel === "xmax" || channel === "xend"
        ? "x"
        : channel === "y" || channel === "ymin" || channel === "ymax" || channel === "yend"
          ? "y"
          : null;
    return axis !== null && scaleRequestsTime(scales, axis);
  };

  const walk = collectLayerDataChecks({
    layers,
    plotAes,
    plotFields,
    layerMaps,
    scaleRequestsTime: scaleRequestsTimeForChannel,
  });
  errors.push(...walk.errors);

  // --- scale/type compatibility (order preserved for diagnostics) ------------
  // Union layer evidence as a fallback for non-layer-scoped lookups. Position,
  // style, and color scale checks prefer per-layer evidence via evidenceForUse
  // so same field names on different tables stay independent (#609 / #844).
  const fields = unionFieldEvidence(plotFields, layerMaps);
  const evidenceForUse = (use: { field: string; path: string }) => {
    const match = /^\/layers\/(\d+)\//.exec(use.path);
    if (match !== null) {
      const layerMap = layerMaps[Number(match[1])];
      if (layerMap !== null && layerMap !== undefined) {
        const hit = layerMap.get(use.field);
        if (hit !== undefined) return hit;
      }
      // Layer with no override inherits plot evidence.
      if (plotFields !== null) {
        const hit = plotFields.get(use.field);
        if (hit !== undefined) return hit;
      }
    }
    return fields.get(use.field);
  };
  // Diagnostic order: finite style → numeric style → position → color.
  errors.push(
    ...checkFiniteStyleScaleDataCompatibility({
      scales,
      fields,
      evidenceForUse,
      finiteStyleFields: walk.finiteStyleFields,
    }),
    ...checkNumericStyleScaleDataCompatibility({
      scales,
      fields,
      evidenceForUse,
      numericStyleFields: walk.numericStyleFields,
      numericStyleScaledConstants: walk.numericStyleScaledConstants,
      temporalDecisionCache,
    }),
    ...checkPositionScaleDataCompatibility({
      scales,
      fields,
      evidenceForUse,
      axisFields: walk.axisFields,
      invalidTemporalAxes,
      temporalDecisionCache,
    }),
    ...checkColorScaleDataCompatibility({
      scales,
      fields,
      evidenceForUse,
      colorFields: walk.colorFields,
      colorScaledConstants: walk.colorScaledConstants,
      temporalDecisionCache,
    }),
  );

  return errors;
}
