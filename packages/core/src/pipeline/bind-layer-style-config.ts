/** Attach authored family intent used by pre-stat default grouping. */
import type { PortableSpec } from "@ggts-sh/spec";

import type { ColumnTable } from "../table.js";

import { styleBinExtent } from "./frame-group-columns.js";
import type { LayerBinding } from "./types.js";

const STYLE_AESTHETICS = ["size", "linewidth", "alpha", "shape", "linetype"] as const;
type StyleAesthetic = (typeof STYLE_AESTHETICS)[number];
type StyleScaleConfig = NonNullable<NonNullable<PortableSpec["scales"]>[StyleAesthetic]>;
const TEMPORAL_CONFIG_KEYS = ["temporalKind", "parse", "timezone", "disambiguation"] as const;

function configureTemporalStyle(
  style: LayerBinding[StyleAesthetic],
  config: StyleScaleConfig & {
    temporalKind?: unknown;
    parse?: LayerBinding[StyleAesthetic]["binParse"];
    timezone?: LayerBinding[StyleAesthetic]["binTimezone"];
    disambiguation?: LayerBinding[StyleAesthetic]["binDisambiguation"];
  },
): void {
  style.binTemporal = TEMPORAL_CONFIG_KEYS.some((key) => config[key] !== undefined);
  if (config.parse !== undefined) style.binParse = config.parse;
  if (config.timezone !== undefined) style.binTimezone = config.timezone;
  if (config.disambiguation !== undefined) style.binDisambiguation = config.disambiguation;
}

function configureBinnedStyle(
  style: LayerBinding[StyleAesthetic],
  aesthetic: StyleAesthetic,
  config: StyleScaleConfig,
  table: ColumnTable | undefined,
): void {
  if (aesthetic === "shape" || aesthetic === "linetype") {
    style.binCount = Math.min(config.range?.length ?? (aesthetic === "shape" ? 6 : 5), 5);
  }
  if (config.breaks !== undefined || config.domain !== undefined || table === undefined) return;
  const extent = styleBinExtent(style, table);
  if (extent !== undefined) style.binExtent = extent;
}

export function configureStyleBindings(
  binding: LayerBinding,
  scales: PortableSpec["scales"] | undefined,
  table?: ColumnTable,
): void {
  for (const aesthetic of STYLE_AESTHETICS) {
    const config = scales?.[aesthetic];
    const type = config?.type;
    const style = binding[aesthetic];
    const discreteAesthetic = aesthetic === "shape" || aesthetic === "linetype";
    style.forcedDiscrete =
      discreteAesthetic || type === "ordinal" || type === "manual" || type === "binned";
    style.forcedContinuous = !discreteAesthetic && (type === "sequential" || type === "identity");
    style.binned = type === "binned";
    if (config === undefined) continue;
    if (config.breaks !== undefined) style.binBreaks = config.breaks;
    if (config.domain !== undefined) style.binDomain = config.domain;
    if (TEMPORAL_CONFIG_KEYS.some((key) => key in config)) configureTemporalStyle(style, config);
    if ("oob" in config && config.oob !== undefined) style.binOob = config.oob;
    if (config.type === "binned") configureBinnedStyle(style, aesthetic, config, table);
  }
}
