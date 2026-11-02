/**
 * Shared classification machinery for the SCALE_REFERENCE builder (gen-only):
 * public scale types, schema walkers, param-doc sugar, and per-helper
 * lookups. Family classifiers live in scale-reference-classify-*.ts.
 */
import type { ScaleCapability } from "./capabilities.js";
import { SpecDeclarations } from "./schema-declarations.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ScaleParamDoc {
  readonly name: string;
  readonly description: string;
  readonly typeSummary: string;
  readonly required: boolean;
}

export type ScaleFamily = ScaleCapability["family"];

/** Canonical aesthetic channel(s) this Scale* component configures. */
export type ScaleAesthetic =
  | "x"
  | "y"
  | "color"
  | "fill"
  | "size"
  | "linewidth"
  | "alpha"
  | "shape"
  | "linetype";

// ---------------------------------------------------------------------------
// Schema walkers (param docs)
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function descriptionOf(node: unknown): string {
  if (!isRecord(node)) return "";
  const d = node["description"];
  return typeof d === "string" ? d : "";
}

function typeSummaryOf(node: unknown, depth = 0): string {
  if (!isRecord(node) || depth > 8) return "unknown";
  const ref = node["$ref"];
  if (typeof ref === "string") return ref;
  if (typeof node["const"] === "string" || typeof node["const"] === "number") {
    return JSON.stringify(node["const"]);
  }
  const anyOf = node["anyOf"];
  if (Array.isArray(anyOf)) {
    const parts = anyOf.map((branch) => typeSummaryOf(branch, depth + 1));
    if (parts.every((p) => p.startsWith('"') || p.startsWith("'") || /^-?\d/.test(p))) {
      return [...new Set(parts)].join(" | ");
    }
    return parts.join(" | ");
  }
  const type = node["type"];
  if (type === "number" || type === "integer") return type === "integer" ? "integer" : "number";
  if (type === "string") return "string";
  if (type === "boolean") return "boolean";
  if (type === "array") {
    const items = node["items"];
    return `Array<${typeSummaryOf(items, depth + 1)}>`;
  }
  if (type === "object") return "object";
  if (Array.isArray(type)) {
    return type.filter((t) => t !== "null").join(" | ") || "unknown";
  }
  return "unknown";
}

function propertiesOf(declName: keyof typeof SpecDeclarations): Record<string, unknown> {
  const schema: unknown = SpecDeclarations[declName];
  if (!isRecord(schema)) {
    throw new Error(`SCALE_REFERENCE: SpecDeclarations.${declName} is not an object`);
  }
  // Intersect schemas put properties on allOf[0].properties
  const direct = schema["properties"];
  if (isRecord(direct)) return direct;
  const allOf = schema["allOf"];
  if (Array.isArray(allOf)) {
    for (const branch of allOf) {
      if (isRecord(branch) && isRecord(branch["properties"])) {
        return branch["properties"];
      }
    }
  }
  throw new Error(`SCALE_REFERENCE: SpecDeclarations.${declName} has no properties`);
}

/** Fallback prose when a schema node has no description (shared style fields). */
const PARAM_DESCRIPTION_FALLBACKS: Readonly<Record<string, string>> = Object.freeze({
  domain:
    "Explicit semantic domain. Continuous scales use [min, max]; ordinal uses ordered values.",
  domainMode:
    'Ordinal domain stability: "grow" (default) preserves assignments across filters; "data" rebuilds from current data.',
  breaks: "Explicit reference ticks or bin boundaries in data units.",
  range: "Explicit output range for the mapped aesthetic.",
  reverse: "Reverse the scale's output direction. Default false.",
  oob: 'Out-of-bounds policy for values outside an explicit domain: "censor" (default) or "squish".',
  naValue: "Replacement for missing/null source values.",
  unknownValue: "Replacement for invalid, out-of-domain, or unmapped values.",
  onExhaust: 'Ordinal palette exhaustion policy: "cycle" (default) with a warning, or "error".',
  labels: "Guide label format string (numeric or temporal).",
  guide: "Guide presentation override (legend, colorbar, colorsteps, or none).",
  transform: 'Pre-training quantitative transform: "identity" (default), "log10", or "sqrt".',
  scheme: "Named color scheme (categorical or sequential family).",
});

export function paramDocsFromSchema(
  declName: keyof typeof SpecDeclarations,
  keys: readonly string[],
): ScaleParamDoc[] {
  const props = propertiesOf(declName);
  const docs: ScaleParamDoc[] = [];
  for (const name of keys) {
    const prop = props[name];
    if (prop === undefined) {
      throw new Error(`SCALE_REFERENCE: ${declName} missing property "${name}"`);
    }
    const fromSchema = descriptionOf(prop).trim();
    const description =
      fromSchema === ""
        ? (PARAM_DESCRIPTION_FALLBACKS[name] ?? `Authoring option \`${name}\` for this scale.`)
        : fromSchema;
    docs.push({
      name,
      description,
      typeSummary: typeSummaryOf(prop),
      required: false,
    });
  }
  return docs;
}

export function sugarParam(
  name: string,
  typeSummary: string,
  description: string,
  required = false,
): ScaleParamDoc {
  return { name, typeSummary, description, required };
}

// ---------------------------------------------------------------------------
// Per-helper classification lookups
// ---------------------------------------------------------------------------

export interface HelperMeta {
  optionsType: string;
  scaleType: string;
  transform?: "log10" | "sqrt";
  temporalKind?: string;
  params: readonly ScaleParamDoc[];
  guide: string;
  summary: string;
}

export function aestheticFromHelper(helper: string): ScaleAesthetic {
  if (helper.startsWith("scaleX")) return "x";
  if (helper.startsWith("scaleY")) return "y";
  if (helper.startsWith("scaleColor") || helper.startsWith("scaleColour")) return "color";
  if (helper.startsWith("scaleFill")) return "fill";
  if (helper.startsWith("scaleSize") || helper === "scaleRadius") return "size";
  if (helper.startsWith("scaleLinewidth")) return "linewidth";
  if (helper.startsWith("scaleAlpha")) return "alpha";
  if (helper.startsWith("scaleShape")) return "shape";
  if (helper.startsWith("scaleLinetype")) return "linetype";
  throw new Error(`SCALE_REFERENCE: cannot derive aesthetic from "${helper}"`);
}

export function styleSchemaFor(aes: ScaleAesthetic): keyof typeof SpecDeclarations {
  if (aes === "alpha") return "AlphaScaleSpec";
  if (aes === "shape") return "ShapeScaleSpec";
  if (aes === "linetype") return "LinetypeScaleSpec";
  if (aes === "size" || aes === "linewidth") return "PositiveStyleScaleSpec";
  throw new Error(`SCALE_REFERENCE: no style schema for aesthetic ${aes}`);
}

export function guideFor(aes: ScaleAesthetic, scaleType: string): string {
  if (aes === "x" || aes === "y") {
    return 'Axis guide on the position channel (band axis guide when type is band). Set guide to customize ticks/labels or guide: "none" to hide.';
  }
  if (aes === "color" || aes === "fill") {
    if (scaleType === "sequential") {
      return 'Colorbar guide by default for continuous ramps. Use guide helpers or guide: "none" to suppress.';
    }
    if (scaleType === "binned") {
      return 'Colorsteps guide by default for binned color. Use guide helpers or guide: "none" to suppress.';
    }
    return 'Legend guide for discrete/manual/identity color. Set guide: "none" to hide.';
  }
  return 'Legend guide for the mapped style channel. Set guide: "none" to hide.';
}

export function withLimits(base: ScaleParamDoc[]): ScaleParamDoc[] {
  return [
    sugarParam(
      "limits",
      "DomainValue[]",
      "Pin the scale to [min, max] in source units (authoring sugar for domain). Supplying both limits and domain throws.",
    ),
    ...base,
  ];
}

export function withValues(
  base: ScaleParamDoc[],
  typeSummary: string,
  description: string,
): ScaleParamDoc[] {
  return [...base, sugarParam("values", typeSummary, description, true)];
}

export function withPaletteDirection(base: ScaleParamDoc[]): ScaleParamDoc[] {
  return [
    ...base,
    sugarParam(
      "palette",
      "string",
      "Named palette (ColorBrewer / distiller / fermenter family). Maps onto scheme.",
    ),
    sugarParam("direction", "1 | -1", "Palette direction: 1 (default) or -1 (reverse)."),
  ];
}

export function withGradientStops(
  base: ScaleParamDoc[],
  kind: "2" | "n" | "steps" | "steps2" | "stepsn",
): ScaleParamDoc[] {
  const extra: ScaleParamDoc[] = [];
  if (kind === "2" || kind === "steps2") {
    extra.push(
      sugarParam("low", "string", "Low-end #rgb/#rrggbb color."),
      sugarParam("mid", "string", "Midpoint #rgb/#rrggbb color."),
      sugarParam("high", "string", "High-end #rgb/#rrggbb color."),
      sugarParam(
        "midpoint",
        "number",
        "Data value mapped to mid (default 0 for diverging helpers).",
      ),
    );
  } else if (kind === "n" || kind === "stepsn") {
    extra.push(
      sugarParam(
        "colours",
        "string[]",
        "Ordered #rgb/#rrggbb stops (British spelling alias of colors).",
      ),
      sugarParam("colors", "string[]", "Ordered #rgb/#rrggbb stops."),
      sugarParam(
        "values",
        "number[]",
        "Optional stop positions in [0, 1] (or data units for some helpers).",
      ),
    );
  } else {
    extra.push(
      sugarParam("low", "string", "Low-end #rgb/#rrggbb color."),
      sugarParam("high", "string", "High-end #rgb/#rrggbb color."),
    );
  }
  return [...base.filter((p) => p.name !== "scheme" && p.name !== "range"), ...extra];
}

export function withViridisOption(base: ScaleParamDoc[]): ScaleParamDoc[] {
  return [
    sugarParam(
      "option",
      '"viridis" | "plasma" | "inferno" | "cividis" | "turbo"',
      "Viridis family option (default viridis).",
    ),
    ...base.filter((p) => p.name !== "scheme"),
  ];
}

export function withHueGrey(base: ScaleParamDoc[], kind: "hue" | "grey"): ScaleParamDoc[] {
  if (kind === "hue") {
    return [
      ...base.filter((p) => p.name !== "scheme" && p.name !== "range"),
      sugarParam("h", "[number, number]", "Hue range in degrees (ggplot2 scale_colour_hue)."),
      sugarParam("c", "number", "Chroma."),
      sugarParam("l", "number", "Luminance."),
      sugarParam("direction", "1 | -1", "Wheel direction."),
    ];
  }
  return [
    ...base.filter((p) => p.name !== "scheme" && p.name !== "range"),
    sugarParam("start", "number", "Grey start (0–1)."),
    sugarParam("end", "number", "Grey end (0–1)."),
  ];
}
