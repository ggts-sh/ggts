/**
 * Scale-children shell ledger + completeness helpers for
 * scripts/gen-scale-children.ts.
 *
 * Manifest-driven: `optionsType` is declared per helper (capabilities.ts
 * carries no type info). Wrong optionsTypes re-open props the helper
 * deliberately removed (e.g. scaleXReverse must emit the Omit expression).
 *
 * Completeness helpers reconcile this ledger against SCALE_CAPABILITIES
 * (tests + CLI banner). Emission / FS generate stay in gen-scale-children.ts.
 */
import { SCALE_CAPABILITIES, scaleCapabilityCamelHelpers } from "@ggts-sh/spec";

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

export interface ShellSpec {
  /** PascalCase component name, e.g. "ScaleXContinuous". */
  component: string;
  /** camelCase helper, e.g. "scaleXContinuous". */
  helper: string;
  /** Must match a SCALE_CAPABILITIES family. */
  family: string;
  /** Full type expression emitted into the shell's `$props()` annotation. */
  optionsType: string;
  /** Named type imports needed from @ggts-sh/spec (verbatimModuleSyntax-safe). */
  typeImports: string[];
  /** Index-only re-exports (e.g. ScaleColourContinuous → ScaleColorContinuous.svelte). */
  aliases?: string[];
}

function shell(
  helper: string,
  family: string,
  optionsType: string,
  typeImports: string[],
  aliases?: string[],
): ShellSpec {
  const component = "S" + helper.slice(1);
  return {
    component,
    helper,
    family,
    optionsType,
    typeImports,
    ...(aliases === undefined ? {} : { aliases }),
  };
}

/** Colour aliases point at the Color component file (no ScaleColour*.svelte). */
function colourAliases(stem: string): string[] {
  return [`ScaleColour${stem}`];
}

/**
 * Complete shell ledger. Cardinality (asserted in tests):
 *   position-continuous  8
 *   position-binned      2
 *   position-temporal    8  (date/datetime/time/monthDay × x/y)
 *   position-discrete    2
 *   color-fill          48
 *   numeric-style       24  (21 base + size area/radius family #830)
 *   finite-style         8
 *   ----------------------
 *   100 component files + 28 aliases
 *     (24 Colour + 4 Size/Linewidth/Alpha/Shape Ordinal re-exports, #830/#832)
 */
export const SHELL_MANIFEST: readonly ShellSpec[] = [
  // --- position-continuous (8) ---------------------------------------------
  shell("scaleXContinuous", "position-continuous", "ContinuousPositionScaleOptions", [
    "ContinuousPositionScaleOptions",
  ]),
  shell("scaleYContinuous", "position-continuous", "ContinuousPositionScaleOptions", [
    "ContinuousPositionScaleOptions",
  ]),
  shell("scaleXLog10", "position-continuous", "TransformedPositionScaleOptions", [
    "TransformedPositionScaleOptions",
  ]),
  shell("scaleYLog10", "position-continuous", "TransformedPositionScaleOptions", [
    "TransformedPositionScaleOptions",
  ]),
  shell("scaleXSqrt", "position-continuous", "TransformedPositionScaleOptions", [
    "TransformedPositionScaleOptions",
  ]),
  shell("scaleYSqrt", "position-continuous", "TransformedPositionScaleOptions", [
    "TransformedPositionScaleOptions",
  ]),
  // Inline Omit — there is no exported named type. Do NOT widen.
  shell(
    "scaleXReverse",
    "position-continuous",
    'Omit<ContinuousPositionScaleOptions, "transform" | "reverse">',
    ["ContinuousPositionScaleOptions"],
  ),
  shell(
    "scaleYReverse",
    "position-continuous",
    'Omit<ContinuousPositionScaleOptions, "transform" | "reverse">',
    ["ContinuousPositionScaleOptions"],
  ),

  // --- position-binned (2) -------------------------------------------------
  shell("scaleXBinned", "position-binned", "ContinuousPositionScaleOptions", [
    "ContinuousPositionScaleOptions",
  ]),
  shell("scaleYBinned", "position-binned", "ContinuousPositionScaleOptions", [
    "ContinuousPositionScaleOptions",
  ]),

  // --- position-temporal (8) -----------------------------------------------
  shell("scaleXDate", "position-temporal", "TemporalScaleOptions", ["TemporalScaleOptions"]),
  shell("scaleXDatetime", "position-temporal", "TemporalScaleOptions", ["TemporalScaleOptions"]),
  shell("scaleXTime", "position-temporal", "TemporalScaleOptions", ["TemporalScaleOptions"]),
  shell("scaleYDate", "position-temporal", "TemporalScaleOptions", ["TemporalScaleOptions"]),
  shell("scaleYDatetime", "position-temporal", "TemporalScaleOptions", ["TemporalScaleOptions"]),
  shell("scaleYTime", "position-temporal", "TemporalScaleOptions", ["TemporalScaleOptions"]),
  shell("scaleXMonthDay", "position-temporal", "TemporalScaleOptions", ["TemporalScaleOptions"]),
  shell("scaleYMonthDay", "position-temporal", "TemporalScaleOptions", ["TemporalScaleOptions"]),

  // --- position-discrete (2) -----------------------------------------------
  shell("scaleXDiscrete", "position-discrete", "DiscretePositionScaleOptions", [
    "DiscretePositionScaleOptions",
  ]),
  shell("scaleYDiscrete", "position-discrete", "DiscretePositionScaleOptions", [
    "DiscretePositionScaleOptions",
  ]),

  // --- color-fill (48 components + 24 Colour aliases) ----------------------
  // optionsTypes match the slice-3 hand-written shells exactly.
  shell(
    "scaleColorContinuous",
    "color-fill",
    "SequentialColorScaleOptions",
    ["SequentialColorScaleOptions"],
    colourAliases("Continuous"),
  ),
  shell(
    "scaleColorDiscrete",
    "color-fill",
    "DiscreteColorScaleOptions",
    ["DiscreteColorScaleOptions"],
    colourAliases("Discrete"),
  ),
  shell(
    "scaleColorBinned",
    "color-fill",
    "BinnedColorScaleOptions",
    ["BinnedColorScaleOptions"],
    colourAliases("Binned"),
  ),
  shell(
    "scaleColorBrewer",
    "color-fill",
    "ColorBrewerScaleOptions",
    ["ColorBrewerScaleOptions"],
    colourAliases("Brewer"),
  ),
  shell(
    "scaleColorDistiller",
    "color-fill",
    "ColorDistillerScaleOptions",
    ["ColorDistillerScaleOptions"],
    colourAliases("Distiller"),
  ),
  shell(
    "scaleColorFermenter",
    "color-fill",
    "ColorFermenterScaleOptions",
    ["ColorFermenterScaleOptions"],
    colourAliases("Fermenter"),
  ),
  shell(
    "scaleColorSteps",
    "color-fill",
    "StepsScaleOptions",
    ["StepsScaleOptions"],
    colourAliases("Steps"),
  ),
  shell(
    "scaleColorSteps2",
    "color-fill",
    "Steps2ScaleOptions",
    ["Steps2ScaleOptions"],
    colourAliases("Steps2"),
  ),
  shell(
    "scaleColorStepsn",
    "color-fill",
    "StepsnScaleOptions",
    ["StepsnScaleOptions"],
    colourAliases("Stepsn"),
  ),
  shell(
    "scaleColorGradient",
    "color-fill",
    "GradientScaleOptions",
    ["GradientScaleOptions"],
    colourAliases("Gradient"),
  ),
  shell(
    "scaleColorGradient2",
    "color-fill",
    "Gradient2ScaleOptions",
    ["Gradient2ScaleOptions"],
    colourAliases("Gradient2"),
  ),
  shell(
    "scaleColorGradientn",
    "color-fill",
    "GradientnScaleOptions",
    ["GradientnScaleOptions"],
    colourAliases("Gradientn"),
  ),
  shell(
    "scaleColorHue",
    "color-fill",
    "HueScaleOptions",
    ["HueScaleOptions"],
    colourAliases("Hue"),
  ),
  shell(
    "scaleColorGrey",
    "color-fill",
    "GreyScaleOptions",
    ["GreyScaleOptions"],
    colourAliases("Grey"),
  ),
  shell(
    "scaleColorOrdinal",
    "color-fill",
    "OrdinalColorScaleOptions",
    ["OrdinalColorScaleOptions"],
    colourAliases("Ordinal"),
  ),
  shell(
    "scaleColorLog10",
    "color-fill",
    "TransformedColorScaleOptions",
    ["TransformedColorScaleOptions"],
    colourAliases("Log10"),
  ),
  shell(
    "scaleColorSqrt",
    "color-fill",
    "TransformedColorScaleOptions",
    ["TransformedColorScaleOptions"],
    colourAliases("Sqrt"),
  ),
  shell(
    "scaleColorDate",
    "color-fill",
    "TemporalColorScaleOptions",
    ["TemporalColorScaleOptions"],
    colourAliases("Date"),
  ),
  shell(
    "scaleColorDatetime",
    "color-fill",
    "TemporalColorScaleOptions",
    ["TemporalColorScaleOptions"],
    colourAliases("Datetime"),
  ),
  shell(
    "scaleColorManual",
    "color-fill",
    "ManualColorScaleOptions",
    ["ManualColorScaleOptions"],
    colourAliases("Manual"),
  ),
  shell(
    "scaleColorIdentity",
    "color-fill",
    "IdentityColorScaleOptions",
    ["IdentityColorScaleOptions"],
    colourAliases("Identity"),
  ),
  shell("scaleFillContinuous", "color-fill", "SequentialColorScaleOptions", [
    "SequentialColorScaleOptions",
  ]),
  shell("scaleFillDiscrete", "color-fill", "DiscreteColorScaleOptions", [
    "DiscreteColorScaleOptions",
  ]),
  shell("scaleFillBinned", "color-fill", "BinnedColorScaleOptions", ["BinnedColorScaleOptions"]),
  shell("scaleFillSteps", "color-fill", "StepsScaleOptions", ["StepsScaleOptions"]),
  shell("scaleFillSteps2", "color-fill", "Steps2ScaleOptions", ["Steps2ScaleOptions"]),
  shell("scaleFillStepsn", "color-fill", "StepsnScaleOptions", ["StepsnScaleOptions"]),
  shell("scaleFillGradient", "color-fill", "GradientScaleOptions", ["GradientScaleOptions"]),
  shell("scaleFillGradient2", "color-fill", "Gradient2ScaleOptions", ["Gradient2ScaleOptions"]),
  shell("scaleFillGradientn", "color-fill", "GradientnScaleOptions", ["GradientnScaleOptions"]),
  shell("scaleFillHue", "color-fill", "HueScaleOptions", ["HueScaleOptions"]),
  shell("scaleFillGrey", "color-fill", "GreyScaleOptions", ["GreyScaleOptions"]),
  shell("scaleFillOrdinal", "color-fill", "OrdinalColorScaleOptions", ["OrdinalColorScaleOptions"]),
  shell("scaleFillLog10", "color-fill", "TransformedColorScaleOptions", [
    "TransformedColorScaleOptions",
  ]),
  shell("scaleFillSqrt", "color-fill", "TransformedColorScaleOptions", [
    "TransformedColorScaleOptions",
  ]),
  shell("scaleFillDate", "color-fill", "TemporalColorScaleOptions", ["TemporalColorScaleOptions"]),
  shell("scaleFillDatetime", "color-fill", "TemporalColorScaleOptions", [
    "TemporalColorScaleOptions",
  ]),
  shell("scaleFillManual", "color-fill", "ManualColorScaleOptions", ["ManualColorScaleOptions"]),
  shell("scaleFillIdentity", "color-fill", "IdentityColorScaleOptions", [
    "IdentityColorScaleOptions",
  ]),
  shell("scaleFillBrewer", "color-fill", "ColorBrewerScaleOptions", ["ColorBrewerScaleOptions"]),
  shell("scaleFillDistiller", "color-fill", "ColorDistillerScaleOptions", [
    "ColorDistillerScaleOptions",
  ]),
  shell("scaleFillFermenter", "color-fill", "ColorFermenterScaleOptions", [
    "ColorFermenterScaleOptions",
  ]),
  shell(
    "scaleColorViridisC",
    "color-fill",
    "ViridisScaleOptions",
    ["ViridisScaleOptions"],
    colourAliases("ViridisC"),
  ),
  shell(
    "scaleColorViridisD",
    "color-fill",
    "ViridisScaleOptions",
    ["ViridisScaleOptions"],
    colourAliases("ViridisD"),
  ),
  shell(
    "scaleColorViridisB",
    "color-fill",
    "ViridisScaleOptions",
    ["ViridisScaleOptions"],
    colourAliases("ViridisB"),
  ),
  shell("scaleFillViridisC", "color-fill", "ViridisScaleOptions", ["ViridisScaleOptions"]),
  shell("scaleFillViridisD", "color-fill", "ViridisScaleOptions", ["ViridisScaleOptions"]),
  shell("scaleFillViridisB", "color-fill", "ViridisScaleOptions", ["ViridisScaleOptions"]),

  // --- numeric-style (24: 21 base + size area/radius #830; Discrete shells
  // re-export Ordinal component names for ggplot2 scale_*_ordinal, #830/#832)
  ...(["Size", "Linewidth", "Alpha"] as const).flatMap((aes) => {
    const base = `scale${aes}`;
    const discreteAliases =
      aes === "Size"
        ? (["ScaleSizeOrdinal"] as const)
        : aes === "Linewidth"
          ? (["ScaleLinewidthOrdinal"] as const)
          : aes === "Alpha"
            ? (["ScaleAlphaOrdinal"] as const)
            : undefined;
    return [
      shell(`${base}Continuous`, "numeric-style", "SequentialStyleScaleOptions", [
        "SequentialStyleScaleOptions",
      ]),
      shell(
        `${base}Discrete`,
        "numeric-style",
        "DiscreteNumericStyleScaleOptions",
        ["DiscreteNumericStyleScaleOptions"],
        discreteAliases === undefined ? undefined : [...discreteAliases],
      ),
      shell(`${base}Binned`, "numeric-style", "SequentialStyleScaleOptions", [
        "SequentialStyleScaleOptions",
      ]),
      shell(`${base}Date`, "numeric-style", "TemporalNumericStyleScaleOptions", [
        "TemporalNumericStyleScaleOptions",
      ]),
      shell(`${base}Datetime`, "numeric-style", "TemporalNumericStyleScaleOptions", [
        "TemporalNumericStyleScaleOptions",
      ]),
      shell(`${base}Manual`, "numeric-style", "ManualNumericStyleScaleOptions", [
        "ManualNumericStyleScaleOptions",
      ]),
      shell(`${base}Identity`, "numeric-style", "IdentityNumericStyleScaleOptions", [
        "IdentityNumericStyleScaleOptions",
      ]),
    ];
  }),
  // size area / radius family (#830)
  shell("scaleSizeArea", "numeric-style", "SizeAreaScaleOptions", ["SizeAreaScaleOptions"]),
  shell("scaleSizeBinnedArea", "numeric-style", "SizeAreaScaleOptions", ["SizeAreaScaleOptions"]),
  shell("scaleRadius", "numeric-style", "SequentialStyleScaleOptions", [
    "SequentialStyleScaleOptions",
  ]),

  // --- finite-style (8) — generics MUST be pinned to the aesthetic ----------
  // Ordinal shells re-export Discrete (ggplot2 scale_*_ordinal; #832).
  shell(
    "scaleShapeDiscrete",
    "finite-style",
    "DiscreteFiniteStyleScaleOptions<PointShapeName>",
    ["DiscreteFiniteStyleScaleOptions", "PointShapeName"],
    ["ScaleShapeOrdinal"],
  ),
  shell("scaleShapeBinned", "finite-style", "BinnedFiniteStyleScaleOptions<PointShapeName>", [
    "BinnedFiniteStyleScaleOptions",
    "PointShapeName",
  ]),
  shell("scaleShapeManual", "finite-style", "ManualFiniteStyleScaleOptions<PointShapeName>", [
    "ManualFiniteStyleScaleOptions",
    "PointShapeName",
  ]),
  shell("scaleShapeIdentity", "finite-style", "IdentityFiniteStyleScaleOptions<PointShapeName>", [
    "IdentityFiniteStyleScaleOptions",
    "PointShapeName",
  ]),
  shell("scaleLinetypeDiscrete", "finite-style", "DiscreteFiniteStyleScaleOptions<LinetypeName>", [
    "DiscreteFiniteStyleScaleOptions",
    "LinetypeName",
  ]),
  shell("scaleLinetypeBinned", "finite-style", "BinnedFiniteStyleScaleOptions<LinetypeName>", [
    "BinnedFiniteStyleScaleOptions",
    "LinetypeName",
  ]),
  shell("scaleLinetypeManual", "finite-style", "ManualFiniteStyleScaleOptions<LinetypeName>", [
    "ManualFiniteStyleScaleOptions",
    "LinetypeName",
  ]),
  shell("scaleLinetypeIdentity", "finite-style", "IdentityFiniteStyleScaleOptions<LinetypeName>", [
    "IdentityFiniteStyleScaleOptions",
    "LinetypeName",
  ]),
];

// ---------------------------------------------------------------------------
// Completeness helpers (exported for tests)
// ---------------------------------------------------------------------------

/** CamelCase helpers across all families, excluding Colour spellings. */
export function expectedCamelHelpers(): Set<string> {
  // Single source: packages/spec capabilities ledger (#1081 PR B).
  return new Set(scaleCapabilityCamelHelpers());
}

/** Colour-spelled camelCase helpers → component alias names. */
export function expectedColourAliases(): Set<string> {
  const out = new Set<string>();
  for (const cap of SCALE_CAPABILITIES) {
    for (const h of cap.helpers) {
      if (h.includes("_")) continue;
      if (!h.includes("Colour")) continue;
      out.add("S" + h.slice(1));
    }
  }
  return out;
}

export function manifestHelpers(): Set<string> {
  return new Set(SHELL_MANIFEST.map((s) => s.helper));
}

export function manifestAliases(): Set<string> {
  const out = new Set<string>();
  for (const s of SHELL_MANIFEST) {
    for (const a of s.aliases ?? []) out.add(a);
  }
  return out;
}
