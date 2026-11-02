/**
 * Named sequential / diverging-ish continuous color schemes (viridis family).
 *
 * 10-stop tables are public-domain / CC0 matplotlib-style samples of the
 * viridis, plasma, inferno, and cividis maps (clean-room hex tables — not
 * ggplot2 R source). Turbo is Google's colormap (Apache-2.0); see NOTICE.
 *
 * {@link VIRIDIS_RAMP_10} is re-exported as the `viridis` entry so edition
 * identity checks (`=== VIRIDIS_RAMP_10`) remain valid.
 */
import { VIRIDIS_RAMP_10 } from "./viridis-ramp.js";

const PLASMA_RAMP_10: readonly string[] = [
  "#0d0887",
  "#46039f",
  "#7201a8",
  "#9c179e",
  "#bd3786",
  "#d8576b",
  "#ed7953",
  "#fb9f3a",
  "#fdca26",
  "#f0f921",
];

const INFERNO_RAMP_10: readonly string[] = [
  "#000004",
  "#1b0c41",
  "#4a0c6b",
  "#781c6d",
  "#a52c60",
  "#cf4446",
  "#ed6925",
  "#fb9a07",
  "#f7d13d",
  "#fcffa4",
];

const CIVIDIS_RAMP_10: readonly string[] = [
  "#00224e",
  "#123570",
  "#3b496c",
  "#575d6d",
  "#707173",
  "#8a8678",
  "#a59c74",
  "#c3b369",
  "#e1cc55",
  "#fee838",
];

/** Google turbo (Apache-2.0) — see repo NOTICE. */
const TURBO_RAMP_10: readonly string[] = [
  "#30123b",
  "#4662d7",
  "#36aaf9",
  "#1ae4b6",
  "#72fe5e",
  "#c8ef34",
  "#faba39",
  "#f66b19",
  "#ca2a04",
  "#7a0403",
];

/**
 * Registry keyed by portable scheme name. `viridis` is the same array
 * reference as {@link VIRIDIS_RAMP_10}. Public consumers resolve via
 * {@link sequentialSchemeRamp}; named tables stay module-private.
 */
const SEQUENTIAL_SCHEME_RAMPS = {
  viridis: VIRIDIS_RAMP_10,
  plasma: PLASMA_RAMP_10,
  inferno: INFERNO_RAMP_10,
  cividis: CIVIDIS_RAMP_10,
  turbo: TURBO_RAMP_10,
} as const;

type SequentialSchemeName = keyof typeof SEQUENTIAL_SCHEME_RAMPS;

function isSequentialSchemeName(name: string): name is SequentialSchemeName {
  return Object.hasOwn(SEQUENTIAL_SCHEME_RAMPS, name);
}

/** Resolve a portable scheme name to its 10-stop ramp, or undefined. */
export function sequentialSchemeRamp(name: string | undefined): readonly string[] | undefined {
  if (name === undefined) return undefined;
  return isSequentialSchemeName(name) ? SEQUENTIAL_SCHEME_RAMPS[name] : undefined;
}
