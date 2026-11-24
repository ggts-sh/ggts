/**
 * Color/fill scale lint rules: manual-palette-too-large (issue #1961).
 * Position scale rules: lint-scale-rules.ts. Orchestrator: lint.ts.
 */
import type { Aes } from "./schema.js";
import { configuredColorScaleType } from "./scale-color-helpers.js";
import type { FieldEvidenceEntry, FieldEvidenceMap, ProfileFieldType } from "./validate-data.js";
import { effectiveChannel } from "./validate-data.js";
import type { LintFieldOf } from "./lint-layer-rules.js";
import type { SpecAdvisory } from "./lint.js";

/** Perceptual hue distinguishability limit for authored discrete palettes. */
const MAX_DISCRETE_PALETTE_COLORS = 8;

const DISCRETE_FIELD_TYPES: ReadonlySet<ProfileFieldType> = new Set(["nominal", "ordinal"]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function layerFieldInfo(input: {
  layerAes: Aes | undefined;
  plotAes: Aes | undefined;
  fieldOf: LintFieldOf;
  layerEvidence: readonly (FieldEvidenceMap | null)[] | undefined;
  layerIndex: number;
  channel: "color" | "fill";
}): FieldEvidenceEntry | null {
  const { layerAes, plotAes, fieldOf, layerEvidence, layerIndex, channel } = input;
  const mapped = effectiveChannel(plotAes, layerAes, channel);
  if (mapped === undefined) {
    return fieldOf(layerAes, channel)?.info ?? null;
  }
  if (!isRecord(mapped) || !("field" in mapped) || typeof mapped.field !== "string") {
    return null;
  }
  if (layerEvidence !== undefined) {
    return layerEvidence[layerIndex]?.get(mapped.field) ?? null;
  }
  return fieldOf(layerAes, channel)?.info ?? null;
}

function hasDiscreteMappedField(input: {
  layers: unknown[];
  plotAes: Aes | undefined;
  fieldOf: LintFieldOf;
  layerEvidence: readonly (FieldEvidenceMap | null)[] | undefined;
  channel: "color" | "fill";
}): boolean {
  const { layers, plotAes, fieldOf, layerEvidence, channel } = input;
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    if (!isRecord(layer)) continue;
    const layerAes = isRecord(layer["aes"]) ? (layer["aes"] as Aes) : undefined;
    const info = layerFieldInfo({
      layerAes,
      plotAes,
      fieldOf,
      layerEvidence,
      layerIndex: i,
      channel,
    });
    if (info !== null && info.type !== null && DISCRETE_FIELD_TYPES.has(info.type)) {
      return true;
    }
  }
  return false;
}

/** Color/fill scale-level advisories for one lintSpec pass. */
export function collectColorScaleLintAdvisories(input: {
  layers: unknown[];
  scales: Record<string, unknown> | undefined;
  plotAes?: Aes | undefined;
  fieldOf: LintFieldOf;
  layerEvidence?: readonly (FieldEvidenceMap | null)[] | null | undefined;
}): SpecAdvisory[] {
  const { layers, scales, plotAes, fieldOf, layerEvidence } = input;
  if (scales === undefined) return [];

  const advisories: SpecAdvisory[] = [];
  const normalizedLayerEvidence = layerEvidence ?? undefined;

  for (const channel of ["color", "fill"] as const) {
    const raw = scales[channel];
    // Schema-invalid scale entries must not throw — lint never blocks.
    if (!isRecord(raw)) continue;
    const range = raw["range"];
    if (!Array.isArray(range) || range.length <= MAX_DISCRETE_PALETTE_COLORS) continue;

    const effectiveType = configuredColorScaleType(raw);
    const isDiscrete =
      effectiveType === "manual" ||
      effectiveType === "ordinal" ||
      (effectiveType === undefined &&
        hasDiscreteMappedField({
          layers,
          plotAes,
          fieldOf,
          layerEvidence: normalizedLayerEvidence,
          channel,
        }));
    if (!isDiscrete) continue;

    const familyLabel = effectiveType ?? "ordinal";
    advisories.push({
      code: "manual-palette-too-large",
      path: `/scales/${channel}`,
      message: `scales.${channel} (${familyLabel}) defines an explicit palette of ${range.length} colors — more than ${MAX_DISCRETE_PALETTE_COLORS} hues cannot be told apart in a legend or on the marks.`,
      suggestion: {
        description:
          'Use a named ordinal scheme with at most 8 classes (such as "colorblind" or "Dark2"), fold tail categories into an "Other" class, or move the field to position or small multiples.',
      },
    });
  }

  return advisories;
}
