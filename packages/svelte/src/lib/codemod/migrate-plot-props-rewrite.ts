/**
 * Pure rewrite helpers for the plot-props codemod (AST walk, attribute→child
 * emission, import edits). The public transform is migrate-plot-props.ts.
 *
 * Semantic confidence (ADR 0013): only meaning-preserving rewrites are
 * performed. Each target component's props type is the prop's own type, so the
 * rewrite cannot change the assembled PortableSpec:
 *
 *   coord / scales / guides  →  <Coord|Scale|Guides value={…}/>   (`value` IS the prop type)
 *   facet / legend / labs    →  <Facet|Legend|Labs {...…}/>       (flat prop bags)
 *   theme (string literal)   →  <Theme name="…"/>
 *
 * `theme={expr}` is NOT rewritten: `theme` is `ThemeName | ThemeSpec`, and
 * `<Theme>` takes `name` plus role overrides with no `value` hatch, so an
 * object-valued expression cannot be routed without judgment.
 *
 * Named shells (`<ThemeDark/>`, `<ScaleColorDiscrete scheme="…"/>`) are what
 * the guide recommends by hand, but the codemod never produces them: mapping a
 * value onto a helper is a style choice, and for scales it is not even
 * byte-identity-preserving (D8 — `normalize()` does not infer scale `type`).
 */
import type { GrammarCodemodForm } from "../layers/grammar-families.js";
import type { Edit } from "./edits.js";

/** How a deprecated prop's value is handed to its replacement component. */
type Form = GrammarCodemodForm;

export interface PropRule {
  readonly component: string;
  readonly form: Form;
  readonly docUrl: string;
}

// ---------------------------------------------------------------------------
// AST shapes
//
// svelte/compiler's public types describe the template but leave `expression`
// as an ESTree node, so the few ESTree members this transform reads are
// declared structurally here rather than pulling in an estree dependency.
// ---------------------------------------------------------------------------

export interface Node {
  readonly type: string;
  readonly start: number;
  readonly end: number;
}

interface EsProperty extends Node {
  readonly type: "Property";
  readonly kind: string;
  readonly computed: boolean;
  readonly method: boolean;
  readonly shorthand: boolean;
  readonly key: Node & { readonly name?: string; readonly value?: unknown };
  /** `raw` is present on Literal nodes only — the sole ESTree member read here. */
  readonly value: Node & { readonly raw?: string };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Every object reachable one step down, arrays flattened.
 *
 * Deliberately not filtered to {@link isNode}: `Fragment` carries the children
 * of an element but has no start/end, so a node-only walk stops at the first
 * `<div>` and silently skips every plot nested inside one.
 */
export function childObjects(value: unknown): unknown[] {
  if (!isRecord(value)) return [];
  const out: unknown[] = [];
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) out.push(...child.filter((item) => isRecord(item)));
    else if (isRecord(child)) out.push(child);
  }
  return out;
}

export function isNode(value: unknown): value is Node {
  return (
    isRecord(value) &&
    typeof value["type"] === "string" &&
    typeof value["start"] === "number" &&
    typeof value["end"] === "number"
  );
}

// ---------------------------------------------------------------------------
// Source helpers
// ---------------------------------------------------------------------------

export function lineOf(source: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i += 1) {
    if (source[i] === "\n") line += 1;
  }
  return line;
}

/** Leading whitespace of the line `offset` sits on, or "" if code precedes it. */
export function indentAt(source: string, offset: number): string {
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
  const prefix = source.slice(lineStart, offset);
  return /^[\t ]*$/.test(prefix) ? prefix : "";
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** A double-quoted string literal with nothing an attribute value must escape. */
function plainDoubleQuoted(raw: string | undefined): raw is string {
  return raw !== undefined && /^"[^"\\\n]*"$/.test(raw);
}

// ---------------------------------------------------------------------------
// Attribute → child element
// ---------------------------------------------------------------------------

/** The `{ … }` expression tag of an attribute, or undefined for other shapes. */
function expressionTag(attribute: Record<string, unknown>): Node | undefined {
  const value = attribute["value"];
  const nodes = Array.isArray(value) ? value : [value];
  if (nodes.length !== 1) return undefined;
  const only: unknown = nodes[0];
  return isNode(only) && only.type === "ExpressionTag" ? only : undefined;
}

/** The single quoted-text value of an attribute, or undefined. */
function textValue(attribute: Record<string, unknown>): Node | undefined {
  const value = attribute["value"];
  if (!Array.isArray(value) || value.length !== 1) return undefined;
  const only: unknown = value[0];
  return isNode(only) && only.type === "Text" ? only : undefined;
}

/**
 * Attributes for a flat prop bag whose value is an object literal made only of
 * plain `key: value` properties.
 *
 * Anything else — shorthand, spread, computed keys, methods, getters, a
 * non-identifier key — falls back to `{...expr}` rather than being partially
 * expanded. Both forms are correct; expansion only exists so the common
 * `labs={{ title: "Sales" }}` migrates to code a human would have written.
 */
function expandObjectLiteral(source: string, expression: unknown): string | undefined {
  if (!isRecord(expression) || expression["type"] !== "ObjectExpression") return undefined;
  const properties = expression["properties"];
  if (!Array.isArray(properties) || properties.length === 0) return undefined;

  const parts: string[] = [];
  for (const raw of properties) {
    if (!isRecord(raw) || raw["type"] !== "Property") return undefined;
    const property = raw as unknown as EsProperty;
    if (property.kind !== "init" || property.computed || property.method || property.shorthand) {
      return undefined;
    }
    const key =
      property.key.type === "Identifier"
        ? property.key.name
        : property.key.type === "Literal" && typeof property.key.value === "string"
          ? property.key.value
          : undefined;
    if (key === undefined || !IDENTIFIER.test(key)) return undefined;

    const valueSource = source.slice(property.value.start, property.value.end);
    parts.push(
      property.value.type === "Literal" && plainDoubleQuoted(property.value.raw)
        ? `${key}=${valueSource}`
        : `${key}={${valueSource}}`,
    );
  }
  return parts.join(" ");
}

/**
 * Build the replacement child for one deprecated attribute.
 *
 * @returns the element source, or a skip reason when the shape is one the
 * codemod refuses to guess at.
 */
export function childFor(
  source: string,
  prop: string,
  rule: PropRule,
  attribute: Record<string, unknown>,
): { element: string } | { skip: string } {
  const tag = expressionTag(attribute);
  const text = textValue(attribute);

  if (rule.form === "theme") {
    if (text !== undefined) {
      return { element: `<Theme name="${source.slice(text.start, text.end)}" />` };
    }
    if (tag !== undefined) {
      const expression = (tag as unknown as Record<string, unknown>)["expression"];
      if (
        isRecord(expression) &&
        expression["type"] === "Literal" &&
        typeof expression["value"] === "string"
      ) {
        return { element: `<Theme name="${expression["value"]}" />` };
      }
    }
    return {
      skip: "theme is ThemeName | ThemeSpec and <Theme> has no `value` hatch, so only a string literal can be rewritten mechanically",
    };
  }

  if (text !== undefined) {
    const quoted = `"${source.slice(text.start, text.end)}"`;
    return rule.form === "value"
      ? { element: `<${rule.component} value=${quoted} />` }
      : { skip: `${prop} is an object-valued prop, so a quoted string is not a shape it can hold` };
  }

  if (tag === undefined) {
    return { skip: `${prop} has no single expression value to move onto <${rule.component}>` };
  }

  const inner = source.slice(tag.start + 1, tag.end - 1);
  if (rule.form === "value") {
    return { element: `<${rule.component} value={${inner}} />` };
  }

  const expanded = expandObjectLiteral(
    source,
    (tag as unknown as Record<string, unknown>)["expression"],
  );
  return {
    element:
      expanded === undefined
        ? `<${rule.component} {...${inner}} />`
        : `<${rule.component} ${expanded} />`,
  };
}

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

export interface ImportSite {
  /** Named specifiers, in source order. */
  readonly specifiers: { readonly local: string; readonly start: number; readonly end: number }[];
}

/**
 * The named-import statement that brought ggts's `GGPlot` into scope.
 *
 * Scoped by module specifier on purpose: a `GGPlot` imported from a consumer's
 * own `./local.js` is somebody else's component, and rewriting its props would
 * be exactly the wrong-rewrite blast radius ADR 0013 weighs. `sources` exists
 * so this repo can still migrate its own files, which import the package
 * through relative paths because the workspace has no self-link.
 */
export function findGGPlotImport(
  program: unknown,
  sources: readonly string[],
): ImportSite | undefined {
  if (!isRecord(program)) return undefined;
  const body = program["body"];
  if (!Array.isArray(body)) return undefined;

  for (const statement of body) {
    if (!isRecord(statement) || statement["type"] !== "ImportDeclaration") continue;
    const source = statement["source"];
    if (!isRecord(source) || typeof source["value"] !== "string") continue;
    if (!sources.includes(source["value"])) continue;
    const rawSpecifiers = statement["specifiers"];
    if (!Array.isArray(rawSpecifiers)) continue;

    const specifiers: ImportSite["specifiers"] = [];
    let hasGGPlot = false;
    for (const specifier of rawSpecifiers) {
      if (!isRecord(specifier) || specifier["type"] !== "ImportSpecifier") continue;
      const local = specifier["local"];
      const imported = specifier["imported"];
      if (!isNode(specifier) || !isRecord(local) || typeof local["name"] !== "string") continue;
      if (isRecord(imported) && imported["name"] === "GGPlot") hasGGPlot = true;
      specifiers.push({ local: local["name"], start: specifier.start, end: specifier.end });
    }
    if (hasGGPlot && specifiers.length > 0) return { specifiers };
  }
  return undefined;
}

function isSortedCaseInsensitive(names: readonly string[]): boolean {
  for (let i = 1; i < names.length; i += 1) {
    if (names[i - 1]!.toLowerCase() > names[i]!.toLowerCase()) return false;
  }
  return true;
}

/**
 * Edits that add `additions` to an existing named-import list.
 *
 * Sorted lists stay sorted (case-insensitively — the repo's own convention,
 * e.g. `{ coordFixed, GGPlot, GeomLine }`); an unsorted list is appended to,
 * so the codemod never reorders a line the author arranged deliberately.
 */
export function importEdits(site: ImportSite, additions: readonly string[]): Edit[] {
  const existing = site.specifiers.map((specifier) => specifier.local);
  const missing = additions.filter((name) => !existing.includes(name));
  if (missing.length === 0) return [];

  const last = site.specifiers.at(-1)!;
  if (!isSortedCaseInsensitive(existing)) {
    return [{ start: last.end, end: last.end, text: missing.map((n) => `, ${n}`).join("") }];
  }

  const edits: Edit[] = [];
  for (const name of missing) {
    const before = site.specifiers.find(
      (specifier) => specifier.local.toLowerCase() > name.toLowerCase(),
    );
    edits.push(
      before === undefined
        ? { start: last.end, end: last.end, text: `, ${name}` }
        : { start: before.start, end: before.start, text: `${name}, ` },
    );
  }
  return edits;
}
