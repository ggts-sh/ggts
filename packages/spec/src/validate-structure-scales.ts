/**
 * Data-free structural checks for named color/fill schemes vs scale family.
 * Layer grammar: validate-structure-layers.ts (+ layer-rule/ribbon/computed-y). Facet: validate-structure-facet.ts.
 */
import type { SpecError } from "./errors.js";
import {
  CATEGORICAL_SCHEME_NAMES,
  CYCLIC_SCHEME_NAMES,
  SEQUENTIAL_SCHEME_NAMES,
} from "./schema-names.js";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const CATEGORICAL_SCHEMES = new Set<string>(CATEGORICAL_SCHEME_NAMES);
const SEQUENTIAL_SCHEMES = new Set<string>(SEQUENTIAL_SCHEME_NAMES);
const CYCLIC_SCHEMES = new Set<string>(CYCLIC_SCHEME_NAMES);

/** Named color schemes must match the configured color scale family. */
const GUIDE_AESTHETICS = [
  "x",
  "y",
  "color",
  "fill",
  "size",
  "linewidth",
  "alpha",
  "shape",
  "linetype",
] as const;

/** Guide variants are constrained by aesthetic and explicit scale family. */
export function guideStructuralErrors(
  guides: Record<string, unknown>,
  scales: Record<string, unknown> | undefined,
): SpecError[] {
  const errors: SpecError[] = [];
  const check = (aesthetic: (typeof GUIDE_AESTHETICS)[number], guide: unknown, path: string) => {
    if (!isRecord(guide) || typeof guide["type"] !== "string") return;
    const type = guide["type"];
    if (type === "none") return;
    const scale = isRecord(scales?.[aesthetic]) ? scales?.[aesthetic] : undefined;
    const scaleType = scale?.["type"];
    if (guideIsValid(aesthetic, type, scaleType)) return;
    errors.push({
      code: "guide-aesthetic-incompatible",
      path,
      message: `The ${type} guide is incompatible with the ${aesthetic} aesthetic${typeof scaleType === "string" ? ` using a ${scaleType} scale` : ""}.`,
      fix: {
        description: guideFixDescription(aesthetic),
      },
    });
  };
  for (const aesthetic of GUIDE_AESTHETICS) {
    const top = guides[aesthetic];
    check(aesthetic, top, `/guides/${aesthetic}`);
    const scale = scales?.[aesthetic];
    if (top === undefined && isRecord(scale))
      check(aesthetic, scale["guide"], `/scales/${aesthetic}/guide`);
  }
  return errors;
}

function guideIsValid(aesthetic: string, type: string, scaleType: unknown): boolean {
  if (aesthetic === "x" || aesthetic === "y") return type === "axis";
  if (aesthetic !== "color" && aesthetic !== "fill") return type === "legend";
  if (type === "legend") return scaleType !== "sequential" && scaleType !== "binned";
  if (type === "colorbar") return scaleType === undefined || scaleType === "sequential";
  return type === "colorsteps" && scaleType === "binned";
}

function guideFixDescription(aesthetic: string): string {
  if (aesthetic === "x" || aesthetic === "y") {
    return 'Use { type: "axis" } or { type: "none" } for positional aesthetics.';
  }
  if (aesthetic === "color" || aesthetic === "fill") {
    return "Use legend for discrete colors, colorbar for sequential colors, colorsteps for binned colors, or none.";
  }
  return 'Use { type: "legend" } or { type: "none" } for mapped style aesthetics.';
}

/** Named color schemes must match the configured color scale family. */
export function colorScaleStructuralErrors(scales: Record<string, unknown>): SpecError[] {
  const errors: SpecError[] = [];
  for (const channel of ["color", "fill"] as const) {
    const scale = scales[channel];
    if (!isRecord(scale)) continue;
    const type = scale["type"];
    const scheme = scale["scheme"];
    addBasicColorScaleErrors(errors, scale, channel, type);

    addCyclicScaleErrors(errors, scale, channel, type, scheme);

    if (
      (type === "sequential" || type === "binned") &&
      typeof scheme === "string" &&
      CATEGORICAL_SCHEMES.has(scheme)
    ) {
      errors.push({
        code: "scale-scheme-type",
        path: `/scales/${channel}/scheme`,
        message: `The categorical scheme "${scheme}" cannot be used with a ${type} color scale.`,
        fix: {
          description: 'Use "viridis" or provide a sequential range of #rgb/#rrggbb stops.',
          example: "viridis",
        },
      });
    } else if (type === "manual" && typeof scheme === "string" && SEQUENTIAL_SCHEMES.has(scheme)) {
      // Ordinal may use sequential-family schemes (scale_*_viridis_d samples the
      // ramp across the trained domain). Manual still rejects named schemes.
      errors.push({
        code: "scale-scheme-type",
        path: `/scales/${channel}/scheme`,
        message: `The sequential scheme "${scheme}" cannot be used with a manual color scale.`,
        fix: {
          description: "Use a categorical scheme or provide an ordinal range of CSS colors.",
          example: "observable10",
        },
      });
    }

    const transform = scale["transform"];
    const temporal = scale["temporalKind"] !== undefined || scale["parse"] !== undefined;
    const describedType = typeof type === "string" ? type : "inferred";
    if (
      typeof transform === "string" &&
      transform !== "identity" &&
      (temporal || type === "ordinal" || type === "manual" || type === "identity")
    ) {
      errors.push({
        code: "scale-type-transform-conflict",
        path: `/scales/${channel}/transform`,
        message: `The ${describedType} ${channel} scale cannot apply the ${transform} transform${temporal ? " to temporal values" : ""}.`,
        fix: {
          description:
            "Remove the transform, or use a non-temporal sequential/binned quantitative scale.",
          example: "identity",
        },
      });
    }

    addColorRangeErrors(errors, scale, channel, type);
  }
  return errors;
}

function addBasicColorScaleErrors(
  errors: SpecError[],
  scale: Record<string, unknown>,
  channel: "color" | "fill",
  type: unknown,
): void {
  if ("range" in scale && scale["range"] !== undefined && !Array.isArray(scale["range"])) {
    errors.push({
      code: "invalid-type",
      path: `/scales/${channel}/range`,
      message: `scales.${channel}.range must be an array of colors (got ${typeof scale["range"]}).`,
      fix: {
        description: "Provide range as a JSON array of #rgb/#rrggbb colors.",
        example: ["#f00", "#0f0", "#00f"],
      },
    });
  }
  if (type === "binned" && scale["oob"] === "wrap") {
    errors.push({
      code: "scale-scheme-oob",
      path: `/scales/${channel}/oob`,
      message: `The binned ${channel} scale cannot use wrap out-of-bounds.`,
      fix: {
        description: 'Use "censor" or "squish" on binned color scales.',
        example: "censor",
      },
    });
  }
}

function addCyclicScaleErrors(
  errors: SpecError[],
  scale: Record<string, unknown>,
  channel: "color" | "fill",
  type: unknown,
  scheme: unknown,
): void {
  if (typeof scheme !== "string" || !CYCLIC_SCHEMES.has(scheme)) return;
  if (type !== undefined && type !== "sequential") {
    const typeLabel = typeof type === "string" ? type : "this";
    errors.push({
      code: "scale-scheme-type",
      path: `/scales/${channel}/scheme`,
      message: `The cyclic scheme "${scheme}" cannot be used with a ${typeLabel} color scale.`,
      fix: {
        description: 'Use type "sequential" with an explicit domain period and oob "wrap".',
        example: "sequential",
      },
    });
  }
  if (scale["oob"] === "censor" || scale["oob"] === "squish") {
    errors.push({
      code: "scale-scheme-oob",
      path: `/scales/${channel}/oob`,
      message: `The cyclic scheme "${scheme}" requires wrap out-of-bounds.`,
      fix: {
        description: 'Set oob to "wrap", or omit it (cyclic schemes default to wrap).',
        example: "wrap",
      },
    });
  }
  if (!Array.isArray(scale["domain"]) || scale["domain"].length !== 2) {
    errors.push({
      code: "scale-cyclic-domain",
      path: `/scales/${channel}/domain`,
      message: `The cyclic scheme "${scheme}" requires an explicit two-value domain period.`,
      fix: {
        description: "Set domain to one period, for example [0, 360] for degrees.",
        example: [0, 360],
      },
    });
  }
  if (scale["range"] !== undefined) {
    errors.push({
      code: "scale-scheme-type",
      path: `/scales/${channel}/range`,
      message: `The cyclic scheme "${scheme}" cannot be combined with an explicit range.`,
      fix: { description: "Remove range and keep the named cyclic scheme, or drop the scheme." },
    });
  }
  const transform = scale["transform"];
  const temporal = scale["temporalKind"] !== undefined || scale["parse"] !== undefined;
  if ((typeof transform === "string" && transform !== "identity") || temporal) {
    errors.push({
      code: "scale-type-transform-conflict",
      path: `/scales/${channel}/transform`,
      message: `The cyclic scheme "${scheme}" cannot apply a transform or temporal parser.`,
      fix: {
        description: "Remove transform and temporal options. Wrap in semantic space only.",
        example: "identity",
      },
    });
  }
}

function addColorRangeErrors(
  errors: SpecError[],
  scale: Record<string, unknown>,
  channel: "color" | "fill",
  type: unknown,
): void {
  const range = scale["range"];
  const domain = scale["domain"];
  if (
    type === "manual" &&
    Array.isArray(domain) &&
    Array.isArray(range) &&
    domain.length !== range.length
  ) {
    errors.push({
      code: "color-manual-domain-range",
      path: `/scales/${channel}`,
      message: `The manual ${channel} scale has ${String(domain.length)} domain values but ${String(range.length)} range colors.`,
      fix: { description: "Provide exactly one range color for each explicit domain value." },
    });
  }
  if (!Array.isArray(range)) return;
  for (let index = 0; index < range.length; index++) {
    const color: unknown = range[index];
    if (typeof color !== "string" || /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) continue;
    errors.push({
      code: "scale-range-color",
      path: `/scales/${channel}/range/${index}`,
      message: `The color stop "${color}" is not a supported hex color.`,
      fix: {
        description: "Use #rgb or #rrggbb syntax for custom color ranges.",
        example: "#ff0000",
      },
    });
  }
}

/** An array of position-scale labels names each explicit break, so the lengths must match. */
export function positionLabelsStructuralErrors(scales: Record<string, unknown>): SpecError[] {
  const errors: SpecError[] = [];
  for (const axis of ["x", "y"] as const) {
    const scale = scales[axis];
    if (typeof scale !== "object" || scale === null || Array.isArray(scale)) continue;
    const labels = (scale as Record<string, unknown>)["labels"];
    if (!Array.isArray(labels)) continue;
    const breaks = (scale as Record<string, unknown>)["breaks"];
    const breakCount = Array.isArray(breaks) ? breaks.length : 0;
    if (breakCount === labels.length) continue;
    errors.push({
      code: "scale-labels-breaks-length",
      path: `/scales/${axis}/labels`,
      message: Array.isArray(breaks)
        ? `scales.${axis} has ${String(breakCount)} breaks but ${String(labels.length)} labels.`
        : `scales.${axis}.labels is an array, but scales.${axis}.breaks is not an explicit array.`,
      fix: {
        description: "Give exactly one label for each explicit break, in the same order.",
        example: { breaks: [4, 14], labels: ["Group A", "Group B"] },
      },
    });
  }
  return errors;
}
