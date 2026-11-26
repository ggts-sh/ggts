/**
 * Guide-level spec-lint rules: suppressed-mapped-guide.
 * Orchestrator: lint.ts.
 */
import type { Aes, ChannelName } from "./schema.js";
import type { SpecAdvisory } from "./lint.js";
import { effectiveChannel } from "./validate-data.js";

const NON_POSITION_GUIDE_CHANNELS = [
  "color",
  "fill",
  "size",
  "linewidth",
  "alpha",
  "shape",
  "linetype",
] as const;

const DIRECT_LABEL_GEOMS: ReadonlySet<string> = new Set(["text", "label", "sf_text", "sf_label"]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function mappedFieldName(
  plotAes: Aes | undefined,
  layerAes: Aes | undefined,
  channel: ChannelName,
): string | null {
  const mapped = effectiveChannel(plotAes, layerAes, channel);
  if (!isRecord(mapped) || !("field" in mapped)) return null;
  return typeof mapped.field === "string" && mapped.field.length > 0 ? mapped.field : null;
}

function guideSuppressionPath(
  channel: string,
  guides: Record<string, unknown> | undefined,
  scales: Record<string, unknown> | undefined,
): string | null {
  const top = guides?.[channel];
  if (isRecord(top)) {
    return top["type"] === "none" ? `/guides/${channel}` : null;
  }
  const scaleEntry = scales?.[channel];
  const local = isRecord(scaleEntry) && isRecord(scaleEntry["guide"]) ? scaleEntry["guide"] : null;
  return local?.["type"] === "none" ? `/scales/${channel}/guide` : null;
}

function axisLabelsVisible(
  axis: "x" | "y",
  guides: Record<string, unknown> | undefined,
  scales: Record<string, unknown> | undefined,
  theme: unknown,
): boolean {
  if (guideSuppressionPath(axis, guides, scales) !== null) return false;
  if (isRecord(theme)) {
    const themeKey = axis === "x" ? "labelsX" : "labelsY";
    if (theme[themeKey] === false) return false;
  }
  const top = isRecord(guides?.[axis]) ? guides[axis] : undefined;
  if (top?.["showLabels"] === false) return false;
  const scaleEntry = scales?.[axis];
  const local =
    isRecord(scaleEntry) && isRecord(scaleEntry["guide"]) ? scaleEntry["guide"] : undefined;
  if (top === undefined && local?.["showLabels"] === false) return false;
  return true;
}

function facetFieldName(raw: unknown): string | null {
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (isRecord(raw) && typeof raw["field"] === "string" && raw["field"].length > 0) {
    return raw["field"];
  }
  return null;
}

function visiblyKeyedFields(input: {
  layers: readonly unknown[];
  plotAes: Aes | undefined;
  guides: Record<string, unknown> | undefined;
  scales: Record<string, unknown> | undefined;
  facet: Record<string, unknown> | undefined;
  theme: unknown;
}): Set<string> {
  const { layers, plotAes, guides, scales, facet, theme } = input;
  const fields = new Set<string>();
  const xVisible = axisLabelsVisible("x", guides, scales, theme);
  const yVisible = axisLabelsVisible("y", guides, scales, theme);

  for (const layer of layers) {
    if (!isRecord(layer)) continue;
    const layerAes = isRecord(layer["aes"]) ? (layer["aes"] as Aes) : undefined;
    if (xVisible) {
      const xField = mappedFieldName(plotAes, layerAes, "x");
      if (xField !== null) fields.add(xField);
    }
    if (yVisible) {
      const yField = mappedFieldName(plotAes, layerAes, "y");
      if (yField !== null) fields.add(yField);
    }
    if (typeof layer["geom"] === "string" && DIRECT_LABEL_GEOMS.has(layer["geom"])) {
      const labelField = mappedFieldName(plotAes, layerAes, "label");
      if (labelField !== null) fields.add(labelField);
    }
  }

  if (facet !== undefined) {
    const strip = isRecord(facet["strip"]) ? facet["strip"] : undefined;
    if (strip?.["show"] !== false) {
      for (const key of ["wrap", "rows", "cols"] as const) {
        const field = facetFieldName(facet[key]);
        if (field !== null) fields.add(field);
      }
    }
  }

  return fields;
}

function activePaintChannelFields(
  channel: "color" | "fill",
  layers: readonly unknown[],
  plotAes: Aes | undefined,
  guides: Record<string, unknown> | undefined,
  scales: Record<string, unknown> | undefined,
): Set<string> {
  const fields = new Set<string>();
  if (guideSuppressionPath(channel, guides, scales) !== null) return fields;
  for (const layer of layers) {
    if (!isRecord(layer)) continue;
    const layerAes = isRecord(layer["aes"]) ? (layer["aes"] as Aes) : undefined;
    const field = mappedFieldName(plotAes, layerAes, channel);
    if (field !== null) fields.add(field);
  }
  return fields;
}

function firstUnkeyedFieldForChannel(
  channel: (typeof NON_POSITION_GUIDE_CHANNELS)[number],
  layers: readonly unknown[],
  plotAes: Aes | undefined,
  keyedFields: ReadonlySet<string>,
  twinPaintFields: ReadonlySet<string> | null,
): string | null {
  for (const layer of layers) {
    if (!isRecord(layer)) continue;
    const layerAes = isRecord(layer["aes"]) ? (layer["aes"] as Aes) : undefined;
    const field = mappedFieldName(plotAes, layerAes, channel);
    if (field !== null && !keyedFields.has(field) && twinPaintFields?.has(field) !== true) {
      return field;
    }
  }
  return null;
}

/** Collect `suppressed-mapped-guide` advisories (spec-only: needs "spec"). */
export function collectSuppressedGuideAdvisories(spec: Record<string, unknown>): SpecAdvisory[] {
  const layers = Array.isArray(spec["layers"]) ? (spec["layers"] as unknown[]) : [];
  const plotAes = isRecord(spec["aes"]) ? (spec["aes"] as Aes) : undefined;
  const guides = isRecord(spec["guides"]) ? spec["guides"] : undefined;
  const scales = isRecord(spec["scales"]) ? spec["scales"] : undefined;
  const facet = isRecord(spec["facet"]) ? spec["facet"] : undefined;
  const theme = spec["theme"];
  if (guides === undefined && scales === undefined) return [];

  let keyedFields: Set<string> | null = null;
  const twinCache = new Map<"color" | "fill", Set<string>>();
  const twinFieldsFor = (
    channel: (typeof NON_POSITION_GUIDE_CHANNELS)[number],
  ): Set<string> | null => {
    const twin = channel === "color" ? "fill" : channel === "fill" ? "color" : null;
    if (twin === null) return null;
    let cached = twinCache.get(twin);
    if (cached === undefined) {
      cached = activePaintChannelFields(twin, layers, plotAes, guides, scales);
      twinCache.set(twin, cached);
    }
    return cached;
  };

  const advisories: SpecAdvisory[] = [];
  for (const channel of NON_POSITION_GUIDE_CHANNELS) {
    const suppressionPath = guideSuppressionPath(channel, guides, scales);
    if (suppressionPath === null) continue;
    keyedFields ??= visiblyKeyedFields({ layers, plotAes, guides, scales, facet, theme });
    const field = firstUnkeyedFieldForChannel(
      channel,
      layers,
      plotAes,
      keyedFields,
      twinFieldsFor(channel),
    );
    if (field === null) continue;
    advisories.push({
      code: "suppressed-mapped-guide",
      path: suppressionPath,
      message: `${channel} maps field "${field}", but its guide is suppressed (type: "none"), hiding the scale key from the reader.`,
      suggestion: {
        description: `Restore the ${channel} guide so readers can decode "${field}", remove the ${channel} data mapping if it adds no signal, or label "${field}" directly on the marks.`,
      },
    });
  }

  return advisories;
}
