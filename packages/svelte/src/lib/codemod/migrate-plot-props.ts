/**
 * Codemod: deprecated <GGPlot> grammar props → declaration-only child layers
 * (#659 slice 7, closes #290).
 *
 * Rewrites the seven props deprecated in 0.11.0 — facet, coord, scales,
 * guides, legend, theme, labs — into the child components that replace them,
 * and adds the components to whichever import statement already provided
 * `GGPlot`.
 *
 * ## Why children go first
 *
 * D2: assemblePortableSpec applies props first, then child plotLayers in
 * registration order. A prop that becomes a child must therefore register
 * BEFORE any child the file already had, or a pre-existing `<ScaleColorDiscrete/>`
 * would stop winning over the migrated `scales` prop. Inserting immediately
 * after the open tag preserves the old precedence exactly.
 *
 * Attribute rewrite and import edits live in migrate-plot-props-rewrite.ts.
 */
import { parse } from "svelte/compiler";

import { grammarCodemodRules } from "../layers/grammar-families.js";
import { applyEdits, type Edit } from "./edits.js";
import {
  childFor,
  childObjects,
  findGGPlotImport,
  importEdits,
  indentAt,
  isNode,
  isRecord,
  lineOf,
  type ImportSite,
  type Node,
  type PropRule,
} from "./migrate-plot-props-rewrite.js";

/** A prop this run rewrote. */
export interface PropChange {
  readonly prop: string;
  readonly component: string;
  readonly line: number;
}

/** A prop this run deliberately left alone, with the manual-change pointer. */
export interface PropSkip {
  readonly prop: string;
  readonly line: number;
  readonly reason: string;
  readonly docUrl: string;
}

/** The module specifier a consumer imports `GGPlot` from. */
export const PACKAGE_SPECIFIER = "@ggts-sh/svelte";

export interface MigrateOptions {
  /**
   * Extra module specifiers that also count as ggts, on top of
   * {@link PACKAGE_SPECIFIER}. Exists for this repo's own sources, which
   * import through relative paths; consumers never need it.
   */
  readonly sources?: readonly string[];
}

export interface MigrationResult {
  /** Migrated source. Byte-identical to the input when nothing was rewritten. */
  readonly code: string;
  readonly changes: readonly PropChange[];
  readonly skipped: readonly PropSkip[];
}

/**
 * The seven props deprecated in 0.11.0, in GGPlotProps declaration order.
 * Built from GRAMMAR_FAMILIES / GGPLOT_PROP_ORDER (#785) so codemod rules
 * cannot drift from deprecation metadata.
 */
const RULES: Readonly<Record<string, PropRule>> = grammarCodemodRules();

type MigrationAccumulator = {
  readonly edits: Edit[];
  readonly changes: PropChange[];
  readonly skipped: PropSkip[];
  readonly needed: Set<string>;
};

function migrateElement(
  source: string,
  plotName: string,
  element: Record<string, unknown>,
  output: MigrationAccumulator,
): void {
  const attributes = Array.isArray(element["attributes"]) ? element["attributes"] : [];
  const elementStart = (element as unknown as Node).start;
  const elementEnd = (element as unknown as Node).end;
  const children: string[] = [];
  let previousEnd = elementStart + 1 + plotName.length;

  for (const raw of attributes) {
    if (!isRecord(raw) || !isNode(raw)) continue;
    const attributeEnd = raw.end;
    const attributeStart = raw.start;
    const name = raw["name"];
    if (raw["type"] !== "Attribute" || typeof name !== "string") {
      previousEnd = attributeEnd;
      continue;
    }
    const rule = Object.hasOwn(RULES, name) ? RULES[name] : undefined;
    if (rule === undefined) {
      previousEnd = attributeEnd;
      continue;
    }

    const built = childFor(source, name, rule, raw);
    if ("skip" in built) {
      output.skipped.push({
        prop: name,
        line: lineOf(source, attributeStart),
        reason: built.skip,
        docUrl: rule.docUrl,
      });
      previousEnd = attributeEnd;
      continue;
    }

    children.push(built.element);
    output.needed.add(rule.component);
    output.changes.push({
      prop: name,
      component: rule.component,
      line: lineOf(source, attributeStart),
    });
    output.edits.push({ start: previousEnd, end: attributeEnd, text: "" });
    previousEnd = attributeEnd;
  }

  if (children.length === 0) return;
  const fragment = element["fragment"];
  const fragmentNodes =
    !Array.isArray(fragment) && isRecord(fragment) && Array.isArray(fragment["nodes"])
      ? (fragment["nodes"] as unknown[])
      : [];
  const firstChild = fragmentNodes.find((node) => isNode(node));
  const elementIndent = indentAt(source, elementStart);
  const childIndent = `${elementIndent}  `;
  const block = children.map((child) => `\n${childIndent}${child}`).join("");

  if (firstChild === undefined) {
    output.edits.push({
      start: previousEnd,
      end: elementEnd,
      text: `>${block}\n${elementIndent}</${plotName}>`,
    });
  } else {
    output.edits.push({
      start: firstChild.start,
      end: firstChild.start,
      text: block,
    });
  }
}

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------

/**
 * Rewrite deprecated `<GGPlot>` grammar props into child layers.
 *
 * Returns the source unchanged (and no changes) when the file imports no
 * `GGPlot`, uses none of the deprecated props, or only uses shapes the
 * codemod refuses to guess at — the second run of any file is therefore a
 * no-op, which is ADR 0013's idempotence criterion.
 */
export function migratePlotProps(source: string, options: MigrateOptions = {}): MigrationResult {
  const sources = [PACKAGE_SPECIFIER, ...(options.sources ?? [])];
  const ast = parse(source, { modern: true });
  const importSite =
    findGGPlotImport(isRecord(ast.instance) ? ast.instance["content"] : undefined, sources) ??
    findGGPlotImport(isRecord(ast.module) ? ast.module["content"] : undefined, sources);
  if (importSite === undefined) return { code: source, changes: [], skipped: [] };

  const localName = importSite.specifiers.find((specifier) => {
    // The local name for the GGPlot binding: re-derived here so `import
    // { GGPlot as Plot }` rewrites <Plot> rather than silently doing nothing.
    return specifier.local === "GGPlot";
  })?.local;
  const plotName = localName ?? aliasedGGPlotName(source, importSite);
  if (plotName === undefined) return { code: source, changes: [], skipped: [] };

  const edits: Edit[] = [];
  const changes: PropChange[] = [];
  const skipped: PropSkip[] = [];
  const needed = new Set<string>();

  const output = { edits, changes, skipped, needed };
  for (const element of collectComponents(ast.fragment, plotName))
    migrateElement(source, plotName, element, output);

  if (changes.length === 0) return { code: source, changes: [], skipped };

  edits.push(...importEdits(importSite, [...needed].toSorted()));
  return { code: applyEdits(source, edits), changes, skipped };
}

/** Local name of an aliased `import { GGPlot as X }`, read back from source. */
function aliasedGGPlotName(source: string, site: ImportSite): string | undefined {
  for (const specifier of site.specifiers) {
    const text = source.slice(specifier.start, specifier.end);
    if (/^GGPlot\s+as\s+/.test(text)) return specifier.local;
  }
  return undefined;
}

/** Every `<plotName>` component in the template, including nested ones. */
function collectComponents(fragment: unknown, plotName: string): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const walk = (node: unknown): void => {
    if (!isRecord(node)) return;
    if (node["type"] === "Component" && node["name"] === plotName) found.push(node);
    for (const child of childObjects(node)) walk(child);
  };
  walk(fragment);
  return found;
}
