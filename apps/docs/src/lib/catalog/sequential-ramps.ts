/**
 * Sequential ramp strips for /palettes/ramps.
 *
 * Bundle isolation (guarded by scripts/docs-chart-stack-isolation.test.ts):
 * - The deep core source imports below match the higher-priority
 *   ggsvelte-palette-tables codeSplitting group, so only the pure hex tables
 *   ship — not the core pipeline/render mega-chunk.
 * - SEQUENTIAL_SCHEME_NAMES is mirrored by hand instead of value-importing
 *   the @ggts-sh/spec barrel (which would drag the TypeBox schema
 *   mega-chunk). apps/docs/tests/sequential-ramps.test.ts checks the mirror
 *   against the registry, so drift fails CI.
 */
import { colorBrewerStops } from "../../../../../packages/core/src/scales/colorbrewer-palettes.js";
import { crameriRampStops } from "../../../../../packages/core/src/scales/crameri-ramps.js";
import { sequentialSchemeRamp } from "../../../../../packages/core/src/scales/sequential-schemes.js";

/** Mirrors SEQUENTIAL_SCHEME_NAMES in @ggts-sh/spec (registry order). */
const SEQUENTIAL_SCHEME_NAME_LIST = [
  "viridis",
  "magma",
  "plasma",
  "inferno",
  "cividis",
  "turbo",
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
  "bamO",
  "brocO",
  "corkO",
  "romaO",
  "vikO",
] as const;

export interface SequentialRampRow {
  readonly name: string;
  readonly colors: readonly string[];
}

/** Same resolution chain as the core scale engine (engine.ts). */
const rampStops = (name: string): readonly string[] | undefined =>
  sequentialSchemeRamp(name) ?? colorBrewerStops(name) ?? crameriRampStops(name);

export const SEQUENTIAL_RAMP_ROWS: readonly SequentialRampRow[] = SEQUENTIAL_SCHEME_NAME_LIST.map(
  (name) => {
    const ramp = rampStops(name);
    if (ramp === undefined) {
      throw new Error(`Missing sequential ramp for scheme "${name}"`);
    }
    return { name, colors: ramp };
  },
);
