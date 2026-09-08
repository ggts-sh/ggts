/**
 * Plot-level composition advisories (ADR 0013 / #659).
 *
 * Sibling union to InteractionDiagnostic and DeprecationDiagnostic, delivered
 * through the existing `ondiagnostic` channel as PlotDiagnostic.
 *
 * Three families:
 * - keyed MERGE, scales (`kind: "scale"`): duplicate aesthetic channels after
 *   shallow per-key merge → `DUPLICATE_SCALE_CHANNEL`
 * - keyed MERGE, everything else (`kind: "labs" | "guides" | "legend"`, #659
 *   slice 6): duplicate keys in the same shallow merge → `DUPLICATE_MERGE_KEY`
 * - REPLACE (`kind: "coord" | "facet" | "theme"`): two children of the same
 *   kind → one silently wins → `DUPLICATE_PLOT_LAYER`
 *
 * The scale family keeps its own code rather than folding into
 * DUPLICATE_MERGE_KEY: it shipped in 0.11.0, its `channel` field and its
 * spelling-alias suggestion are scale-specific, and renaming a live advisory
 * code would break consumer `switch`es for no behavioural gain.
 *
 * Kind sets and doc anchors come from GRAMMAR_FAMILIES (#785).
 */
import {
  GRAMMAR_FAMILIES,
  MERGE_KEY_EMIT_ORDER,
  REPLACE_EMIT_ORDER,
  grammarDocUrl,
  type MergeByKeyKind,
  type ReplaceKind,
} from "./grammar-families.js";
import type { PlotLayerLike } from "./types.js";

export type CompositionDiagnosticCode =
  | "DUPLICATE_SCALE_CHANNEL"
  | "DUPLICATE_MERGE_KEY"
  | "DUPLICATE_PLOT_LAYER";

/**
 * `suggestions` and `docUrl` are NOT optional: both sibling members of
 * PlotDiagnostic (InteractionDiagnostic, DeprecationDiagnostic) carry them, so
 * a consumer rendering `d.docUrl` / `d.suggestions` over the union must not
 * break on this variant. An advisory whose whole job is "your chart is
 * silently wrong" is also the last place to omit the fix link.
 */
export interface DuplicateScaleChannelDiagnostic {
  readonly severity: "advisory";
  readonly code: "DUPLICATE_SCALE_CHANNEL";
  readonly message: string;
  readonly channel: string;
  readonly kind: "scale";
  readonly suggestions: ReadonlyArray<string>;
  readonly docUrl: string;
}

/** Keyed-MERGE families other than scales (#659 slice 6 / #785). */
export type DuplicateMergeKeyKind = MergeByKeyKind;

/**
 * Two children of one keyed-MERGE family wrote the same key. Unlike the
 * REPLACE families nothing is wholesale lost — only that one key, where the
 * later child's value silently overwrites the earlier one's.
 */
export interface DuplicateMergeKeyDiagnostic {
  readonly severity: "advisory";
  readonly code: "DUPLICATE_MERGE_KEY";
  readonly message: string;
  readonly kind: DuplicateMergeKeyKind;
  /** The colliding key: a labs/legend option name, or a guides channel. */
  readonly key: string;
  readonly suggestions: ReadonlyArray<string>;
  readonly docUrl: string;
}

export type DuplicatePlotLayerKind = ReplaceKind;

export interface DuplicatePlotLayerDiagnostic {
  readonly severity: "advisory";
  readonly code: "DUPLICATE_PLOT_LAYER";
  readonly message: string;
  readonly kind: DuplicatePlotLayerKind;
  readonly suggestions: ReadonlyArray<string>;
  readonly docUrl: string;
}

export type CompositionDiagnostic =
  | DuplicateScaleChannelDiagnostic
  | DuplicateMergeKeyDiagnostic
  | DuplicatePlotLayerDiagnostic;

export function isCompositionDiagnostic(d: { readonly code: string }): d is CompositionDiagnostic {
  return (
    d.code === "DUPLICATE_SCALE_CHANNEL" ||
    d.code === "DUPLICATE_MERGE_KEY" ||
    d.code === "DUPLICATE_PLOT_LAYER"
  );
}

/** Narrow to the scale variant so `.channel` consumers stay type-safe. */
export function isDuplicateScaleChannelDiagnostic(
  d: CompositionDiagnostic | { readonly code: string },
): d is DuplicateScaleChannelDiagnostic {
  return d.code === "DUPLICATE_SCALE_CHANNEL";
}

/** Narrow to the non-scale keyed-MERGE variant so `.key` consumers stay safe. */
export function isDuplicateMergeKeyDiagnostic(
  d: CompositionDiagnostic | { readonly code: string },
): d is DuplicateMergeKeyDiagnostic {
  return d.code === "DUPLICATE_MERGE_KEY";
}

/** Narrow to the REPLACE-family plot-layer variant. */
export function isDuplicatePlotLayerDiagnostic(
  d: CompositionDiagnostic | { readonly code: string },
): d is DuplicatePlotLayerDiagnostic {
  return d.code === "DUPLICATE_PLOT_LAYER";
}

function mergeKeyNoun(kind: DuplicateMergeKeyKind): string {
  return GRAMMAR_FAMILIES[kind].mergeKeyNoun ?? "key";
}

function mergeKeyChild(kind: DuplicateMergeKeyKind): string {
  return GRAMMAR_FAMILIES[kind].mergeKeyChild ?? `<${kind}>`;
}

/**
 * Frozen catalog entry for composition codes. Per-emission fields are filled
 * by {@link duplicateScaleChannelDiagnostic} / {@link duplicatePlotLayerDiagnostic}.
 */
const COMPOSITION_DIAGNOSTIC_CATALOG: Readonly<
  Record<
    CompositionDiagnosticCode,
    Pick<CompositionDiagnostic, "severity" | "code"> & {
      readonly messageTemplate: (subject: string) => string;
    }
  >
> = Object.freeze({
  DUPLICATE_SCALE_CHANNEL: {
    severity: "advisory",
    code: "DUPLICATE_SCALE_CHANNEL",
    messageTemplate: (channel) =>
      `Multiple scale children configure channel "${channel}"; later children overwrite earlier ones.`,
  },
  DUPLICATE_MERGE_KEY: {
    severity: "advisory",
    code: "DUPLICATE_MERGE_KEY",
    messageTemplate: (key) =>
      `Multiple children set "${key}"; later children overwrite earlier ones.`,
  },
  DUPLICATE_PLOT_LAYER: {
    severity: "advisory",
    code: "DUPLICATE_PLOT_LAYER",
    messageTemplate: (kind) =>
      `Multiple ${kind} children are registered; the last one replaces earlier ones.`,
  },
});

/** Build a fully-populated duplicate-channel advisory. */
export function duplicateScaleChannelDiagnostic(channel: string): DuplicateScaleChannelDiagnostic {
  const entry = COMPOSITION_DIAGNOSTIC_CATALOG.DUPLICATE_SCALE_CHANNEL;
  return {
    severity: entry.severity,
    code: "DUPLICATE_SCALE_CHANNEL",
    message: entry.messageTemplate(channel),
    channel,
    kind: "scale",
    suggestions: [
      `Keep one scale child per channel — remove all but the intended "${channel}" scale`,
      `British and American spellings write the same channel: <ScaleColorDiscrete/> and <ScaleColourContinuous/> both configure "color"`,
    ],
    docUrl: grammarDocUrl("scale"),
  };
}

/** Build a fully-populated duplicate merge-key advisory (labs/guides/legend). */
export function duplicateMergeKeyDiagnostic(
  kind: DuplicateMergeKeyKind,
  key: string,
): DuplicateMergeKeyDiagnostic {
  const entry = COMPOSITION_DIAGNOSTIC_CATALOG.DUPLICATE_MERGE_KEY;
  const noun = mergeKeyNoun(kind);
  const child = mergeKeyChild(kind);
  return {
    severity: entry.severity,
    code: "DUPLICATE_MERGE_KEY",
    message: entry.messageTemplate(key),
    kind,
    key,
    suggestions: [
      `Set the ${noun} "${key}" on exactly one ${child} child`,
      `${kind} is a MERGE family: siblings that touch different ${noun}s all survive — only "${key}" is overwritten`,
    ],
    docUrl: grammarDocUrl(kind),
  };
}

/** Build a fully-populated duplicate REPLACE-family plot-layer advisory. */
export function duplicatePlotLayerDiagnostic(
  kind: DuplicatePlotLayerKind,
): DuplicatePlotLayerDiagnostic {
  const entry = COMPOSITION_DIAGNOSTIC_CATALOG.DUPLICATE_PLOT_LAYER;
  const shell =
    kind === "theme" ? "Theme" : kind === "coord" ? "Coord" : kind === "facet" ? "Facet" : kind;
  return {
    severity: entry.severity,
    code: "DUPLICATE_PLOT_LAYER",
    message: entry.messageTemplate(kind),
    kind,
    suggestions: [
      `Keep one <${shell}*> child — remove earlier ${kind} children so the intended one is the only registration`,
      `${kind} is a REPLACE family: the last child fully replaces earlier ones (and any ${kind} prop)`,
    ],
    docUrl: grammarDocUrl(kind),
  };
}

type MergeKeyLayer = Extract<PlotLayerLike, { kind: DuplicateMergeKeyKind }>;
type ReplaceLayer = Extract<PlotLayerLike, { kind: DuplicatePlotLayerKind }>;

function isMergeKeyLayer(layer: PlotLayerLike): layer is MergeKeyLayer {
  return (MERGE_KEY_EMIT_ORDER as readonly string[]).includes(layer.kind);
}

function isReplaceLayer(layer: PlotLayerLike): layer is ReplaceLayer {
  return (REPLACE_EMIT_ORDER as readonly string[]).includes(layer.kind);
}

/**
 * Scan plot layers for composition collisions (duplicate scale channels,
 * keyed-MERGE key collisions, REPLACE multi-children). Pure — safe to call
 * from a `$derived` that only re-reads `registry.layers`.
 *
 * Emission order: scale channels, then MERGE_KEY_EMIT_ORDER, then
 * REPLACE_EMIT_ORDER. Mark layers are ignored.
 */
export function collectCompositionDiagnostics(
  layers: readonly PlotLayerLike[],
): CompositionDiagnostic[] {
  const list: CompositionDiagnostic[] = [];
  const seenChannels = new Set<string>();
  const duplicateChannels = new Set<string>();
  // Kind membership and emit order come from GRAMMAR_FAMILIES (#785).
  // Scales keep their own advisory code (0.11.0 surface); labs/guides/legend
  // share DUPLICATE_MERGE_KEY.
  const mergeSeen = Object.fromEntries(
    MERGE_KEY_EMIT_ORDER.map((k) => [k, new Set<string>()]),
  ) as Record<DuplicateMergeKeyKind, Set<string>>;
  const mergeDuplicates = Object.fromEntries(
    MERGE_KEY_EMIT_ORDER.map((k) => [k, new Set<string>()]),
  ) as Record<DuplicateMergeKeyKind, Set<string>>;
  const replaceCounts = Object.fromEntries(REPLACE_EMIT_ORDER.map((k) => [k, 0])) as Record<
    DuplicatePlotLayerKind,
    number
  >;
  for (const layer of layers) {
    if (layer.kind === "scale") {
      for (const channel of Object.keys(layer.value)) {
        if (seenChannels.has(channel)) {
          duplicateChannels.add(channel);
        } else {
          seenChannels.add(channel);
        }
      }
      continue;
    }
    if (isMergeKeyLayer(layer)) {
      const kind = layer.kind;
      for (const key of Object.keys(layer.value)) {
        if (mergeSeen[kind].has(key)) {
          mergeDuplicates[kind].add(key);
        } else {
          mergeSeen[kind].add(key);
        }
      }
      continue;
    }
    if (isReplaceLayer(layer)) {
      replaceCounts[layer.kind] += 1;
    }
  }
  for (const channel of duplicateChannels) {
    list.push(duplicateScaleChannelDiagnostic(channel));
  }
  for (const kind of MERGE_KEY_EMIT_ORDER) {
    for (const key of mergeDuplicates[kind]) {
      list.push(duplicateMergeKeyDiagnostic(kind, key));
    }
  }
  for (const kind of REPLACE_EMIT_ORDER) {
    if (replaceCounts[kind] > 1) {
      list.push(duplicatePlotLayerDiagnostic(kind));
    }
  }
  return list;
}

/**
 * Once-per-instance advisory dedup key for composition diagnostics.
 * Shape matches the assembly deliveredAdvisories Set:
 * - scale: `${code}:${channel}`
 * - merge-key: `${code}:${kind}:${key}`
 * - replace: `${code}:${kind}`
 */
export function compositionAdvisoryDedupKey(diagnostic: CompositionDiagnostic): string {
  if (isDuplicateScaleChannelDiagnostic(diagnostic)) {
    return `${diagnostic.code}:${diagnostic.channel}`;
  }
  if (isDuplicateMergeKeyDiagnostic(diagnostic)) {
    return `${diagnostic.code}:${diagnostic.kind}:${diagnostic.key}`;
  }
  if (isDuplicatePlotLayerDiagnostic(diagnostic)) {
    return `${diagnostic.code}:${diagnostic.kind}`;
  }
  // Exhaustiveness: CompositionDiagnostic has only the three variants above.
  return ((x: never) => x)(diagnostic);
}
