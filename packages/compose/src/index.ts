// @ggsvelte/compose — framework-free PortableSpec assembly.
// @lifecycle-default experimental
export {
  assemblePortableSpec,
  isFacetedPlotIntent,
  mappedChannelField,
  resolveInteractionScope,
  toLayerInput,
} from "./assemble.js";
export type {
  AssemblePortableSpecInput,
  MarkLayerDescriptorLike,
  ResolveInteractionScopeInput,
} from "./assemble.js";
export { foldPlotLayer } from "./fold.js";
export type { AssembleDraft } from "./fold.js";
export {
  GGPLOT_PROP_ORDER,
  GRAMMAR_DOC_URLS,
  GRAMMAR_FAMILIES,
  GRAMMAR_PROP_NAMES,
  MERGE_KEY_EMIT_ORDER,
  REPLACE_EMIT_ORDER,
  deprecatedGrammarPropPattern,
  grammarCodemodRules,
  grammarDocUrl,
} from "./grammar-families.js";
export type {
  GrammarCodemodForm,
  GrammarFamilyMeta,
  MergeByKeyKind,
  ReplaceKind,
} from "./grammar-families.js";
export { isHostPlotLayer } from "./types.js";
export type {
  GrammarLayerKind,
  Layer,
  LegendAestheticChannel,
  LegendFilterLayerValue,
  LegendFocusLayerValue,
  MarkLayerDescriptor,
  PlotLayerLike,
} from "./types.js";
export type { PlotInteractionScope, ZoomInput, ZoomOptions } from "./interaction-scope.js";

export {
  isCompositionDiagnostic,
  isDuplicateScaleChannelDiagnostic,
  isDuplicateMergeKeyDiagnostic,
  isDuplicatePlotLayerDiagnostic,
  duplicateScaleChannelDiagnostic,
  duplicateMergeKeyDiagnostic,
  duplicatePlotLayerDiagnostic,
  collectCompositionDiagnostics,
  compositionAdvisoryDedupKey,
} from "./composition-diagnostics.js";
export type {
  CompositionDiagnosticCode,
  DuplicateScaleChannelDiagnostic,
  DuplicateMergeKeyKind,
  DuplicateMergeKeyDiagnostic,
  DuplicatePlotLayerKind,
  DuplicatePlotLayerDiagnostic,
  CompositionDiagnostic,
} from "./composition-diagnostics.js";
