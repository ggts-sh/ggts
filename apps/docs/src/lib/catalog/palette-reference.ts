/**
 * Palette → scale helper mapping for /reference/palettes.
 *
 * Scheme names come from the PortableSpec registries. Scale children pass
 * `scheme` into color/fill scales (or use a family-specific shell).
 */
import { CATEGORICAL_SCHEME_NAMES, SEQUENTIAL_SCHEME_NAMES } from "@ggts-sh/spec";

export type PaletteFamily = "categorical" | "sequential";

export interface PaletteSchemeRef {
  readonly name: string;
  readonly family: PaletteFamily;
  /** Primary Svelte shells that accept this scheme (or set it by construction). */
  readonly helpers: readonly string[];
  readonly notes?: string;
}

/** Shared discrete color/fill shells for named categorical schemes. */
const DISCRETE_HELPERS = [
  "ScaleColorDiscrete",
  "ScaleFillDiscrete",
  "ScaleColorOrdinal",
  "ScaleFillOrdinal",
] as const;

/** Shared continuous color/fill shells for named sequential schemes. */
const CONTINUOUS_HELPERS = [
  "ScaleColorContinuous",
  "ScaleFillContinuous",
  "ScaleColorBinned",
  "ScaleFillBinned",
] as const;

const COLORBREWER_QUALITATIVE = new Set(["Dark2"]);

const VIRIDIS_FAMILY = new Set(["viridis", "magma", "plasma", "inferno", "cividis", "turbo"]);

const COLORBREWER_SEQUENTIAL = new Set([
  "Blues",
  "Greens",
  "Reds",
  "Oranges",
  "Purples",
  "Greys",
  "YlOrRd",
  "YlGnBu",
  "BuPu",
  "RdYlBu",
  "RdBu",
  "BrBG",
  "Spectral",
  "PuOr",
]);

const CRAMERI_CYCLIC = new Set(["bamO", "brocO", "corkO", "romaO", "vikO"]);

const CRAMERI_SEQUENTIAL = new Set([
  "acton",
  "bamako",
  "batlow",
  "batlowW",
  "batlowK",
  "bilbao",
  "buda",
  "davos",
  "devon",
  "glasgow",
  "grayC",
  "hawaii",
  "imola",
  "lajolla",
  "lapaz",
  "lipari",
  "navia",
  "naviaW",
  "nuuk",
  "oslo",
  "tokyo",
  "turku",
  "bam",
  "berlin",
  "broc",
  "cork",
  "lisbon",
  "managua",
  "roma",
  "tofino",
  "vanimo",
  "vik",
  "bukavu",
  "fes",
  "oleron",
]);

function categoricalHelpers(name: string): readonly string[] {
  if (name === "hue") {
    return ["ScaleColorHue", "ScaleFillHue", ...DISCRETE_HELPERS];
  }
  if (COLORBREWER_QUALITATIVE.has(name)) {
    return ["ScaleColorBrewer", "ScaleFillBrewer", ...DISCRETE_HELPERS];
  }
  return DISCRETE_HELPERS;
}

function categoricalNotes(name: string): string | undefined {
  if (name === "hue") return 'Default discrete path; also scheme="hue" on ordinal scales.';
  if (COLORBREWER_QUALITATIVE.has(name)) {
    return `ColorBrewer qualitative — prefer <ScaleColorBrewer palette="${name}" /> (maps to scheme).`;
  }
  if (name === "observable10") return "Default categorical scheme when none is set.";
  if (name.endsWith("S") && name !== "wsj_rgby") {
    return "Crameri categorical (v8.0.1) — 10-class unordered prefix of the official *S table.";
  }
  return undefined;
}

function sequentialHelpers(name: string): readonly string[] {
  if (CRAMERI_CYCLIC.has(name)) {
    return ["ScaleColorContinuous", "ScaleFillContinuous"];
  }
  if (VIRIDIS_FAMILY.has(name)) {
    return [
      "ScaleColorViridisC",
      "ScaleColorViridisD",
      "ScaleColorViridisB",
      "ScaleFillViridisC",
      "ScaleFillViridisD",
      "ScaleFillViridisB",
      ...CONTINUOUS_HELPERS,
      "ScaleColorDiscrete",
      "ScaleFillDiscrete",
    ];
  }
  if (COLORBREWER_SEQUENTIAL.has(name)) {
    return [
      "ScaleColorDistiller",
      "ScaleFillDistiller",
      "ScaleColorFermenter",
      "ScaleFillFermenter",
      ...CONTINUOUS_HELPERS,
    ];
  }
  return CONTINUOUS_HELPERS;
}

function sequentialNotes(name: string): string | undefined {
  if (VIRIDIS_FAMILY.has(name)) {
    return `Viridis family — <ScaleColorViridisC option="${name}" /> or scheme on continuous/discrete.`;
  }
  if (COLORBREWER_SEQUENTIAL.has(name)) {
    return `ColorBrewer ramp — Distiller (continuous), Fermenter (binned), or scheme on continuous.`;
  }
  if (CRAMERI_CYCLIC.has(name)) {
    return "Crameri cyclic (v8.0.1) — periodic data only; wrap OOB; set an explicit domain period.";
  }
  if (CRAMERI_SEQUENTIAL.has(name)) {
    return "Crameri Scientific colour map (v8.0.1) — continuous, CVD-friendly.";
  }
  return undefined;
}

/** All registered categorical schemes with scale helper tips. */
export const CATEGORICAL_SCHEME_REFS: readonly PaletteSchemeRef[] = CATEGORICAL_SCHEME_NAMES.map(
  (name) => {
    const notes = categoricalNotes(name);
    return {
      name,
      family: "categorical" as const,
      helpers: categoricalHelpers(name),
      ...(notes !== undefined && { notes }),
    };
  },
);

/** All registered sequential / diverging schemes with scale helper tips. */
export const SEQUENTIAL_SCHEME_REFS: readonly PaletteSchemeRef[] = SEQUENTIAL_SCHEME_NAMES.map(
  (name) => {
    const notes = sequentialNotes(name);
    return {
      name,
      family: "sequential" as const,
      helpers: sequentialHelpers(name),
      ...(notes !== undefined && { notes }),
    };
  },
);

/** High-level helper groups for the reference index (not every shell). */
export const PALETTE_HELPER_GROUPS = [
  {
    id: "discrete",
    title: "Discrete (categorical schemes)",
    shells: [
      "ScaleColorDiscrete",
      "ScaleFillDiscrete",
      "ScaleColorOrdinal",
      "ScaleFillOrdinal",
      "ScaleColorBrewer",
      "ScaleFillBrewer",
      "ScaleColorHue",
      "ScaleFillHue",
      "ScaleColorGrey",
      "ScaleFillGrey",
      "ScaleColorManual",
      "ScaleFillManual",
    ],
    summary:
      'Pass scheme="observable10" (or another categorical name) on discrete/ordinal shells. Brewer and hue set the scheme by construction; grey bakes an explicit range.',
  },
  {
    id: "continuous",
    title: "Continuous and binned (sequential schemes)",
    shells: [
      "ScaleColorContinuous",
      "ScaleFillContinuous",
      "ScaleColorBinned",
      "ScaleFillBinned",
      "ScaleColorViridisC",
      "ScaleColorViridisD",
      "ScaleColorViridisB",
      "ScaleColorDistiller",
      "ScaleColorFermenter",
      "ScaleColorGradient",
      "ScaleColorGradient2",
      "ScaleColorGradientn",
    ],
    summary:
      'Pass scheme="viridis" (or another sequential name) on continuous/binned shells. Gradient* helpers take explicit color stops instead of a name.',
  },
] as const;
