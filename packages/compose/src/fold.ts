/**
 * Fold non-mark grammar layers onto an assemble draft (#785).
 * Pure module: no Svelte runes, no fluent builder / TypeBox validate.
 * Safe for assemble.ts.
 */
import type {
  AesInput,
  CoordSpec,
  DataInput,
  FacetInput,
  GuidesSpec,
  Labs,
  LayerInput,
  LegendSpec,
  Scales,
  ThemeName,
  ThemeSpec,
} from "@ggts-sh/spec";

import { GRAMMAR_FAMILIES, type GrammarFamilyMeta } from "./grammar-families.js";
import type { PlotLayerLike } from "./types.js";

/**
 * Mutable assemble state before normalize(). Mirrors builder composition:
 * REPLACE families overwrite; MERGE families shallow-merge.
 */
export type AssembleDraft = {
  data?: DataInput | readonly Record<string, unknown>[];
  aes?: AesInput;
  layers: LayerInput[];
  facet?: FacetInput;
  coord?: CoordSpec | "flip";
  a11y?: import("@ggts-sh/spec").A11yMode;
  scales?: Scales;
  guides?: GuidesSpec;
  legend?: LegendSpec;
  labs?: Labs;
  theme?: ThemeName | ThemeSpec;
};

/**
 * Apply one plot layer onto the assemble draft.
 * Marks are ignored (they travel through `input.layers` / `toLayerInput`).
 */
export function foldPlotLayer(draft: AssembleDraft, layer: PlotLayerLike): AssembleDraft {
  if (layer.kind === "mark") {
    return draft;
  }
  // Host-only interaction contributions never fold into PortableSpec.
  if (layer.kind === "legendFocus" || layer.kind === "legendFilter") {
    return draft;
  }
  // Index via string map so unforeseen runtime kinds are undefined (not a
  // silent miss). Typed callers already exhaust GrammarLayerKind.
  const family = (GRAMMAR_FAMILIES as Readonly<Record<string, GrammarFamilyMeta | undefined>>)[
    layer.kind
  ];
  if (family === undefined) {
    throw new TypeError(`Unhandled plot layer kind: ${layer.kind}`);
  }
  switch (family.builderMethod) {
    case "scales":
      return { ...draft, scales: { ...draft.scales, ...(layer.value as Scales) } };
    case "theme":
      return { ...draft, theme: layer.value as ThemeName | ThemeSpec };
    case "coord":
      return { ...draft, coord: layer.value as CoordSpec | "flip" };
    case "facet":
      return { ...draft, facet: layer.value as FacetInput };
    case "labs":
      return { ...draft, labs: { ...draft.labs, ...(layer.value as Labs) } };
    case "guides":
      return { ...draft, guides: { ...draft.guides, ...(layer.value as GuidesSpec) } };
    case "legend":
      return { ...draft, legend: { ...draft.legend, ...(layer.value as LegendSpec) } };
    default: {
      const unhandled: never = family.builderMethod;
      throw new TypeError(`Unhandled builder method: ${String(unhandled)}`);
    }
  }
}
