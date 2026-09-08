/**
 * Single source of truth for the seven grammar families (#785 / #659).
 *
 * Prop names, components, composition rules, doc anchors, and codemod forms
 * live here. Consumers look up; they do not restate. `plot-props.ts` JSDoc
 * keeps since/URL for the deprecation-wiring guard and is ratcheted against
 * this table. Deprecation emit windows and suggestion copy left with the
 * 0.13.0 grammar-prop removal — props are gone, codemod + composition remain.
 */
import type { GrammarLayerKind } from "./types.js";

const GUIDE = "https://ggts.sh/guide/upgrading";

/** How sibling children of the same kind compose when folding into the builder. */
type GrammarComposition = "merge-by-channel" | "merge-by-key" | "replace";

/** How a deprecated prop's value is handed to its replacement component. */
export type GrammarCodemodForm = "value" | "spread" | "theme";

/** Fluent-builder method that receives this family's value. */
type GrammarBuilderMethod = "scales" | "theme" | "coord" | "facet" | "labs" | "guides" | "legend";

export type GrammarFamilyMeta = {
  readonly kind: GrammarLayerKind;
  /** Deprecated `<GGPlot>` prop name (`scales` for kind `scale`). */
  readonly propName: string;
  /** Codemod escape-hatch component name. */
  readonly component: string;
  readonly codemodForm: GrammarCodemodForm;
  readonly composition: GrammarComposition;
  /** Heading anchor on /guide/upgrading (without `#`). */
  readonly docAnchor: string;
  readonly builderMethod: GrammarBuilderMethod;
  /** DUPLICATE_MERGE_KEY message helpers (merge-by-key only). */
  readonly mergeKeyNoun?: string;
  readonly mergeKeyChild?: string;
};

type GrammarFamilies = {
  readonly [K in GrammarLayerKind]: GrammarFamilyMeta & { readonly kind: K };
};

/**
 * Authoritative metadata for every non-mark grammar family.
 * Key order is insertion order (scale → theme → …); consumers that need a
 * different emission order must use the explicit order constants below.
 */
export const GRAMMAR_FAMILIES: GrammarFamilies = {
  scale: {
    kind: "scale",
    propName: "scales",
    component: "Scale",
    codemodForm: "value",
    composition: "merge-by-channel",
    docAnchor: "compose-scales-as-child-layers",
    builderMethod: "scales",
  },
  theme: {
    kind: "theme",
    propName: "theme",
    component: "Theme",
    codemodForm: "theme",
    composition: "replace",
    docAnchor: "compose-the-theme-as-a-child-layer",
    builderMethod: "theme",
  },
  coord: {
    kind: "coord",
    propName: "coord",
    component: "Coord",
    codemodForm: "value",
    composition: "replace",
    docAnchor: "compose-coord-as-a-child-layer",
    builderMethod: "coord",
  },
  facet: {
    kind: "facet",
    propName: "facet",
    component: "Facet",
    codemodForm: "spread",
    composition: "replace",
    docAnchor: "compose-facet-as-a-child-layer",
    builderMethod: "facet",
  },
  labs: {
    kind: "labs",
    propName: "labs",
    component: "Labs",
    codemodForm: "spread",
    composition: "merge-by-key",
    docAnchor: "compose-labs-as-a-child-layer",
    builderMethod: "labs",
    mergeKeyNoun: "label",
    mergeKeyChild: "<Labs>",
  },
  guides: {
    kind: "guides",
    propName: "guides",
    component: "Guides",
    codemodForm: "value",
    composition: "merge-by-key",
    docAnchor: "compose-guides-as-child-layers",
    builderMethod: "guides",
    mergeKeyNoun: "channel",
    mergeKeyChild: "<Guide*>",
  },
  legend: {
    kind: "legend",
    propName: "legend",
    component: "Legend",
    codemodForm: "spread",
    composition: "merge-by-key",
    docAnchor: "compose-legend-as-a-child-layer",
    builderMethod: "legend",
    mergeKeyNoun: "option",
    mergeKeyChild: "<Legend>",
  },
};

/**
 * GGPlotProps / codemod RULES order (declaration order in plot-props.ts).
 * Codemod `changes[]` ordering depends on this.
 */
export const GGPLOT_PROP_ORDER: readonly GrammarLayerKind[] = [
  "facet",
  "coord",
  "scale",
  "guides",
  "legend",
  "theme",
  "labs",
] as const;

/** DUPLICATE_MERGE_KEY advisory emission order. */
export const MERGE_KEY_EMIT_ORDER = [
  "labs",
  "guides",
  "legend",
] as const satisfies readonly GrammarLayerKind[];

/** DUPLICATE_PLOT_LAYER advisory emission order. */
export const REPLACE_EMIT_ORDER = [
  "coord",
  "facet",
  "theme",
] as const satisfies readonly GrammarLayerKind[];

export type MergeByKeyKind = (typeof MERGE_KEY_EMIT_ORDER)[number];
export type ReplaceKind = (typeof REPLACE_EMIT_ORDER)[number];

/** Deprecated GGPlot prop names in GGPlotProps order. */
export const GRAMMAR_PROP_NAMES: readonly string[] = GGPLOT_PROP_ORDER.map(
  (kind) => GRAMMAR_FAMILIES[kind].propName,
);

/** Full upgrading-guide docUrl for a family. */
export function grammarDocUrl(kind: GrammarLayerKind): string {
  return `${GUIDE}#${GRAMMAR_FAMILIES[kind].docAnchor}`;
}

/** Absolute docUrls for every family (catalog-anchor tests). */
export const GRAMMAR_DOC_URLS: readonly string[] = (
  Object.keys(GRAMMAR_FAMILIES) as GrammarLayerKind[]
).map((kind) => grammarDocUrl(kind));

/**
 * Regex matching deprecated grammar props on `<GGPlot` or at line start.
 * Same shape as the pre-#785 `DEPRECATED_PROP` in repo-child-layers.
 */
export function deprecatedGrammarPropPattern(): RegExp {
  const names = GRAMMAR_PROP_NAMES.join("|");
  return new RegExp(`(?:^\\s*|<GGPlot\\s+)(${names})=`, "gm");
}

/** Codemod rule bag keyed by prop name, in GGPLOT_PROP_ORDER. */
export function grammarCodemodRules(): Readonly<
  Record<
    string,
    { readonly component: string; readonly form: GrammarCodemodForm; readonly docUrl: string }
  >
> {
  const rules: Record<
    string,
    { readonly component: string; readonly form: GrammarCodemodForm; readonly docUrl: string }
  > = {};
  for (const kind of GGPLOT_PROP_ORDER) {
    const family = GRAMMAR_FAMILIES[kind];
    rules[family.propName] = {
      component: family.component,
      form: family.codemodForm,
      docUrl: grammarDocUrl(kind),
    };
  }
  return rules;
}
