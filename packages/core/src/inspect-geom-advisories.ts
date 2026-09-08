/**
 * Inspect-mode × geom advisories: pure collectors shared by the host
 * (plot-engine → ondiagnostic) and the headless CLI (`--inspect MODE`).
 *
 * Axis guides that fight bar/col geometry or bisect on-mark value labels;
 * freescrolling guides through distribution/interval geoms on discrete bands
 * (#1528); plus high-cardinality discrete color/fill + inspect (#1274).
 *
 * Host inspect mode is intentionally not a PortableSpec field. Agents declare
 * the host's intended mode via `ggts render --inspect <mode>` so the same
 * codes reach the CLI/agent JSONL loop (#1531).
 *
 * Auto/exact modes never fire the axis-guide codes: auto already picks exact
 * for bar/col and for violin/boxplot/interval geoms (candidateAutoMode).
 */
// @lifecycle experimental

import { GEOM_ALIASES } from "@ggts-sh/spec";

/** Codes owned by this pure collector surface (subset of host interaction codes). */
export type InspectGeomAdvisoryCode =
  | "INTERACTION_INSPECT_X_ON_COL"
  | "INTERACTION_INSPECT_X_ON_BAR"
  | "INTERACTION_INSPECT_X_BISECTS_COL_LABELS"
  | "INTERACTION_INSPECT_X_BISECTS_BAR_LABELS"
  | "INTERACTION_INSPECT_AXIS_ON_VIOLIN"
  | "INTERACTION_INSPECT_AXIS_ON_BOXPLOT"
  | "INTERACTION_INSPECT_AXIS_ON_ERRORBAR"
  | "INTERACTION_INSPECT_AXIS_ON_LINERANGE"
  | "INTERACTION_INSPECT_AXIS_ON_POINTRANGE"
  | "INTERACTION_INSPECT_AXIS_ON_CROSSBAR"
  | "INTERACTION_INSPECT_HIGH_CARDINALITY_DISCRETE";

export interface InspectGeomAdvisory {
  readonly severity: "error" | "warning" | "advisory";
  readonly code: InspectGeomAdvisoryCode;
  readonly message: string;
  readonly prop: string;
  readonly actual?: unknown;
  readonly suggestions: ReadonlyArray<string>;
  readonly docUrl: string;
}

/**
 * Catalog slice for inspect×geom advisories. Host INTERACTION_DIAGNOSTIC_CATALOG
 * re-exports these entries so messages stay single-sourced.
 */
export const INSPECT_GEOM_DIAGNOSTIC_CATALOG: Readonly<
  Record<InspectGeomAdvisoryCode, Omit<InspectGeomAdvisory, "actual">>
> = Object.freeze({
  INTERACTION_INSPECT_X_ON_COL: {
    severity: "advisory",
    code: "INTERACTION_INSPECT_X_ON_COL",
    message:
      "inspect.mode x/xy draws a crosshair on the x (band) axis through column marks; columns already encode x as a filled band, so the guide cuts the bar body and rarely adds information. Under coord_flip the guide is horizontal but still tracks the band.",
    prop: "inspect.mode",
    suggestions: [
      'Use inspect={{ mode: "exact" }} (or leave mode as "auto") for GeomCol',
      "Prefer muteSiblings for sibling de-emphasis instead of an axis guide",
    ],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-inspect-x-on-col",
  },
  INTERACTION_INSPECT_X_ON_BAR: {
    severity: "advisory",
    code: "INTERACTION_INSPECT_X_ON_BAR",
    message:
      "inspect.mode x/xy draws a crosshair through bar marks; bars are filled regions on the band axis, so the guide cuts the bar body and rarely adds information. Under coord_flip the guide orientation swaps with the axes but still fights the marks.",
    prop: "inspect.mode",
    suggestions: [
      'Use inspect={{ mode: "exact" }} (or leave mode as "auto") for GeomBar',
      "Prefer muteSiblings for sibling de-emphasis instead of an axis guide",
    ],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-inspect-x-on-bar",
  },
  INTERACTION_INSPECT_X_BISECTS_COL_LABELS: {
    severity: "warning",
    code: "INTERACTION_INSPECT_X_BISECTS_COL_LABELS",
    message:
      "inspect.mode x/xy draws a crosshair through GeomCol marks that also carry GeomText/GeomLabel values; the guide bisects the on-bar totals and makes them hard to read (including under coord_flip, when the guide is horizontal).",
    prop: "inspect.mode",
    suggestions: [
      'Use inspect={{ mode: "exact" }} (or leave mode as "auto") when columns have value labels',
      "Keep value labels; drop the x/xy guide rather than dropping the labels",
    ],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-inspect-x-bisects-col-labels",
  },
  INTERACTION_INSPECT_X_BISECTS_BAR_LABELS: {
    severity: "warning",
    code: "INTERACTION_INSPECT_X_BISECTS_BAR_LABELS",
    message:
      "inspect.mode x/xy draws a crosshair through GeomBar marks that also carry GeomText/GeomLabel values; the guide bisects the on-bar totals and makes them hard to read (including under coord_flip).",
    prop: "inspect.mode",
    suggestions: [
      'Use inspect={{ mode: "exact" }} (or leave mode as "auto") when bars have value labels',
      "Keep value labels; drop the x/xy guide rather than dropping the labels",
    ],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-inspect-x-bisects-bar-labels",
  },
  INTERACTION_INSPECT_AXIS_ON_VIOLIN: {
    severity: "advisory",
    code: "INTERACTION_INSPECT_AXIS_ON_VIOLIN",
    message:
      "inspect.mode draws an axis guide through violin marks; violins sit on a discrete band, so freescrolling x/y/xy guides cut the density body and often leave the band tooltip row blank.",
    prop: "inspect.mode",
    suggestions: [
      'Use inspect={{ mode: "exact" }} (or leave mode as "auto") for GeomViolin',
      "Prefer muteSiblings for sibling de-emphasis instead of an axis guide",
    ],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-inspect-axis-on-violin",
  },
  INTERACTION_INSPECT_AXIS_ON_BOXPLOT: {
    severity: "advisory",
    code: "INTERACTION_INSPECT_AXIS_ON_BOXPLOT",
    message:
      "inspect.mode draws an axis guide through boxplot marks; boxes sit on a discrete band, so freescrolling x/y/xy guides cut the box body and rarely add information.",
    prop: "inspect.mode",
    suggestions: [
      'Use inspect={{ mode: "exact" }} (or leave mode as "auto") for GeomBoxplot',
      "Prefer muteSiblings for sibling de-emphasis instead of an axis guide",
    ],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-inspect-axis-on-boxplot",
  },
  INTERACTION_INSPECT_AXIS_ON_ERRORBAR: {
    severity: "advisory",
    code: "INTERACTION_INSPECT_AXIS_ON_ERRORBAR",
    message:
      "inspect.mode draws an axis guide through errorbar marks; interval geoms on a discrete band are better inspected on the mark itself than via a freescrolling guide.",
    prop: "inspect.mode",
    suggestions: [
      'Use inspect={{ mode: "exact" }} (or leave mode as "auto") for GeomErrorbar',
      "Prefer muteSiblings for sibling de-emphasis instead of an axis guide",
    ],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-inspect-axis-on-errorbar",
  },
  INTERACTION_INSPECT_AXIS_ON_LINERANGE: {
    severity: "advisory",
    code: "INTERACTION_INSPECT_AXIS_ON_LINERANGE",
    message:
      "inspect.mode draws an axis guide through linerange marks; interval geoms on a discrete band are better inspected on the mark itself than via a freescrolling guide.",
    prop: "inspect.mode",
    suggestions: [
      'Use inspect={{ mode: "exact" }} (or leave mode as "auto") for GeomLinerange',
      "Prefer muteSiblings for sibling de-emphasis instead of an axis guide",
    ],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-inspect-axis-on-linerange",
  },
  INTERACTION_INSPECT_AXIS_ON_POINTRANGE: {
    severity: "advisory",
    code: "INTERACTION_INSPECT_AXIS_ON_POINTRANGE",
    message:
      "inspect.mode draws an axis guide through pointrange marks; interval geoms on a discrete band are better inspected on the mark itself than via a freescrolling guide.",
    prop: "inspect.mode",
    suggestions: [
      'Use inspect={{ mode: "exact" }} (or leave mode as "auto") for GeomPointrange',
      "Prefer muteSiblings for sibling de-emphasis instead of an axis guide",
    ],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-inspect-axis-on-pointrange",
  },
  INTERACTION_INSPECT_AXIS_ON_CROSSBAR: {
    severity: "advisory",
    code: "INTERACTION_INSPECT_AXIS_ON_CROSSBAR",
    message:
      "inspect.mode draws an axis guide through crossbar marks; even when hits pin to a category, freescrolling x/y/xy guides rarely add information beyond exact mark focus.",
    prop: "inspect.mode",
    suggestions: [
      'Use inspect={{ mode: "exact" }} (or leave mode as "auto") for GeomCrossbar',
      "Prefer muteSiblings for sibling de-emphasis instead of an axis guide",
    ],
    docUrl: "https://ggts.sh/guide/interaction-reference#interaction-inspect-axis-on-crossbar",
  },
  INTERACTION_INSPECT_HIGH_CARDINALITY_DISCRETE: {
    severity: "advisory",
    code: "INTERACTION_INSPECT_HIGH_CARDINALITY_DISCRETE",
    message:
      "Inspect is enabled with a high-cardinality discrete color/fill domain; the default tooltip shows the focused series, the largest contributors at that x (or y), a stack total, and an overflow line — not every series.",
    prop: "inspect",
    suggestions: [
      "Prep top-n data before plotting if only the largest series matter",
      "Pass a custom content snippet on <Inspect content={…} /> for a full multi-series listing",
      "Pin the tooltip to scroll the full group when every series must be readable",
    ],
    docUrl:
      "https://ggts.sh/guide/interaction-reference#interaction-inspect-high-cardinality-discrete",
  },
});

/**
 * Discrete color/fill domain size that triggers the default-tooltip content
 * policy advisory when inspect is enabled (#1274).
 */
export const HIGH_CARDINALITY_DISCRETE_THRESHOLD = 16;

/**
 * Inspect modes that draw a crosshair on the data-x (band) axis for bar/col.
 * Screen orientation swaps under coord_flip (InteractionOverlay remaps x/y to
 * horizontal/vertical), but the guide still tracks the filled band — so these
 * advisories fire for x/xy regardless of flip (#1409 product decision).
 */
const X_BAND_GUIDE_MODES = new Set(["x", "xy"]);

/** Modes that freescroll any axis guide (vertical, horizontal, or both). */
const AXIS_GUIDE_MODES = new Set(["x", "y", "xy"]);

const VALUE_LABEL_GEOMS = new Set(["text", "label", "sf_text", "sf_label"]);

/**
 * Always-band distribution geoms (discrete category axis by construction).
 * Freescrolling x/y/xy guides never help; advisories fire without scale info.
 */
const ALWAYS_BAND_GEOM_CODES = {
  violin: "INTERACTION_INSPECT_AXIS_ON_VIOLIN",
  boxplot: "INTERACTION_INSPECT_AXIS_ON_BOXPLOT",
} as const satisfies Record<string, InspectGeomAdvisoryCode>;

/**
 * Interval geoms that are often discrete-band but also appear on continuous
 * shared-x series (line + errorbar). Advisories only when the caller confirms
 * a discrete band axis — otherwise continuous mode="x" is a false positive.
 */
const INTERVAL_GEOM_CODES = {
  errorbar: "INTERACTION_INSPECT_AXIS_ON_ERRORBAR",
  linerange: "INTERACTION_INSPECT_AXIS_ON_LINERANGE",
  pointrange: "INTERACTION_INSPECT_AXIS_ON_POINTRANGE",
  crossbar: "INTERACTION_INSPECT_AXIS_ON_CROSSBAR",
} as const satisfies Record<string, InspectGeomAdvisoryCode>;

export type InspectAxisOnDistributionOptions = {
  /**
   * When true, also advise on errorbar / linerange / pointrange / crossbar.
   * Default false: only violin / boxplot (always discrete-band).
   */
  readonly discreteBandAxis?: boolean;
};

/** Host inspect modes accepted by `ggts render --inspect`. */
export const INSPECT_INTENT_MODES = ["auto", "exact", "x", "y", "xy"] as const;
export type InspectIntentMode = (typeof INSPECT_INTENT_MODES)[number];

export function isInspectIntentMode(value: string): value is InspectIntentMode {
  return (INSPECT_INTENT_MODES as readonly string[]).includes(value);
}

/**
 * Advisories when inspect.mode x/xy draws a band-axis crosshair through bar/col
 * marks. Labels present → stronger bisect warning replaces the plain-geom advisory.
 *
 * #1409: coord_flip does **not** suppress these. Mode x still tracks data-x
 * (the col band); under flip the guide is horizontal and still bisects the
 * filled mark. Mode y alone never fires here (value-axis guide, not band).
 */
export function inspectAxisOnBarColDiagnostics(
  inspectMode: string | null | undefined,
  geoms: readonly string[],
): InspectGeomAdvisory[] {
  if (inspectMode === null || inspectMode === undefined || !X_BAND_GUIDE_MODES.has(inspectMode)) {
    return [];
  }

  let hasCol = false;
  let hasBar = false;
  let hasValueLabels = false;
  for (const geom of geoms) {
    if (geom === "col") hasCol = true;
    else if (geom === "bar") hasBar = true;
    if (VALUE_LABEL_GEOMS.has(geom)) hasValueLabels = true;
  }
  if (!hasCol && !hasBar) return [];

  const list: InspectGeomAdvisory[] = [];
  if (hasCol) {
    list.push({
      ...(hasValueLabels
        ? INSPECT_GEOM_DIAGNOSTIC_CATALOG.INTERACTION_INSPECT_X_BISECTS_COL_LABELS
        : INSPECT_GEOM_DIAGNOSTIC_CATALOG.INTERACTION_INSPECT_X_ON_COL),
      actual: inspectMode,
    });
  }
  if (hasBar) {
    list.push({
      ...(hasValueLabels
        ? INSPECT_GEOM_DIAGNOSTIC_CATALOG.INTERACTION_INSPECT_X_BISECTS_BAR_LABELS
        : INSPECT_GEOM_DIAGNOSTIC_CATALOG.INTERACTION_INSPECT_X_ON_BAR),
      actual: inspectMode,
    });
  }
  return list;
}

/**
 * Advisories when inspect.mode draws a freescrolling axis guide through
 * violin / boxplot (always) and interval geoms when the band axis is discrete
 * (#1528). Fires for mode x, y, or xy; auto and exact stay silent.
 *
 * Interval geoms (errorbar / linerange / pointrange / crossbar) require
 * `discreteBandAxis: true` so continuous shared-x series with a legitimate
 * mode="x" guide do not get a false positive.
 */
export function inspectAxisOnDistributionDiagnostics(
  inspectMode: string | null | undefined,
  geoms: readonly string[],
  options?: InspectAxisOnDistributionOptions,
): InspectGeomAdvisory[] {
  if (inspectMode === null || inspectMode === undefined || !AXIS_GUIDE_MODES.has(inspectMode)) {
    return [];
  }

  const includeInterval = options?.discreteBandAxis === true;
  const list: InspectGeomAdvisory[] = [];
  const seen = new Set<string>();
  for (const geom of geoms) {
    if (seen.has(geom)) continue;
    const always = ALWAYS_BAND_GEOM_CODES[geom as keyof typeof ALWAYS_BAND_GEOM_CODES];
    const interval = includeInterval
      ? INTERVAL_GEOM_CODES[geom as keyof typeof INTERVAL_GEOM_CODES]
      : undefined;
    const code = always ?? interval;
    if (code === undefined) continue;
    seen.add(geom);
    list.push({
      ...INSPECT_GEOM_DIAGNOSTIC_CATALOG[code],
      actual: inspectMode,
    });
  }
  return list;
}

/**
 * Layer geom names from a PortableSpec-like layers array.
 * Alias geoms (`histogram`→`bar`, …) are rewritten to the same canonical names
 * `normalize()` stamps, so CLI host-intent lint matches host ondiagnostic
 * (assembled layers are already normalized; raw JSON layers are not).
 */
export function layerGeomsFromSpecLayers(layers: unknown): readonly string[] {
  if (!Array.isArray(layers)) return [];
  const geoms: string[] = [];
  for (const layer of layers) {
    if (layer === null || typeof layer !== "object" || Array.isArray(layer)) continue;
    const geom = (layer as { geom?: unknown }).geom;
    if (typeof geom !== "string" || geom.length === 0) continue;
    if (Object.hasOwn(GEOM_ALIASES, geom)) {
      geoms.push(GEOM_ALIASES[geom as keyof typeof GEOM_ALIASES]);
    } else {
      geoms.push(geom);
    }
  }
  return geoms;
}

/**
 * Headless entry: given PortableSpec layers + declared host inspect intent,
 * return the same inspect×geom codes the host fires via ondiagnostic.
 */
export function collectInspectIntentDiagnostics(
  layers: unknown,
  inspectMode: string | null | undefined,
  options?: InspectAxisOnDistributionOptions,
): InspectGeomAdvisory[] {
  const geoms = layerGeomsFromSpecLayers(layers);
  return [
    ...inspectAxisOnBarColDiagnostics(inspectMode, geoms),
    ...inspectAxisOnDistributionDiagnostics(inspectMode, geoms, options),
  ];
}

/**
 * Advisory when inspect is on and a discrete color/fill domain is large enough
 * that the default tooltip content policy (top-k + total + overflow) matters.
 *
 * `domainSizes` is the trained ordinal domain length per channel; continuous
 * ramps are omitted by the caller. Fires once per channel over the threshold.
 */
export function inspectHighCardinalityDiagnostics(input: {
  readonly inspectEnabled: boolean;
  readonly domainSizes: ReadonlyArray<{
    readonly channel: "color" | "fill";
    readonly size: number;
  }>;
  readonly threshold?: number;
}): InspectGeomAdvisory[] {
  if (!input.inspectEnabled) return [];
  const threshold = input.threshold ?? HIGH_CARDINALITY_DISCRETE_THRESHOLD;
  const list: InspectGeomAdvisory[] = [];
  for (const { channel, size } of input.domainSizes) {
    if (size < threshold) continue;
    list.push({
      ...INSPECT_GEOM_DIAGNOSTIC_CATALOG.INTERACTION_INSPECT_HIGH_CARDINALITY_DISCRETE,
      prop: channel,
      actual: size,
    });
  }
  return list;
}

/** Ordinal color/fill domain lengths from a TrainedScales-like bag. */
export function discreteColorFillDomainSizes(scales: {
  readonly color: { readonly kind: string; readonly scale: unknown } | null;
  readonly fill: { readonly kind: string; readonly scale: unknown } | null;
}): ReadonlyArray<{ readonly channel: "color" | "fill"; readonly size: number }> {
  const out: { channel: "color" | "fill"; size: number }[] = [];
  for (const channel of ["color", "fill"] as const) {
    const resolved = scales[channel];
    if (resolved === null || resolved.kind !== "ordinal") continue;
    const scale = resolved.scale;
    if (scale === null || typeof scale !== "object") continue;
    const domain = (scale as { readonly domain?: unknown }).domain;
    if (!Array.isArray(domain)) continue;
    out.push({ channel, size: domain.length });
  }
  return out;
}
