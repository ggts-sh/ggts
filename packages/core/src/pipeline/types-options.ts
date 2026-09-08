/**
 * Pipeline run options and named data contract.
 */
import type { PositionScaleSpec } from "@ggts-sh/spec";

import type { RuntimeRowFilterClause } from "../runtime-filter.js";
import type { ScaleState } from "../scales/state.js";
import type { Columns, Rows } from "../table.js";
import type { TextMeasurer } from "../layout/measure.js";
import type { EditionDefaults } from "../editions.js";

import type { ScaleDomainSnapshot } from "./types-model.js";

/** Named data acceptable at run time: rows, columns, or the inline forms. */
export type NamedData = Rows | Columns | { values: Rows } | { columns: Columns };

export interface RunOptions {
  /** Plot width in px (required — container sizing is the adapter's job). */
  width: number;
  /** Plot height in px. */
  height: number;
  /** Named datasets resolvable by { name } data refs. */
  data?: Record<string, NamedData>;
  /** Allow RunOptions.data to shadow spec.datasets on name collision. */
  allowOverride?: boolean;
  /** Text measurer; defaults to the canonical deterministic metrics table. */
  measureText?: TextMeasurer;
  /** Previously committed scale state (value-stable color assignments). */
  prevScales?: Record<string, ScaleState>;
  /** Mark-count threshold above which `render: "auto"` layers resolve to
   *  canvas (default 2000, benchmark-tuned; advisory `canvas-auto`). */
  canvasThreshold?: number;
  /** Defaults-edition table override (editions.ts). Run-scoped — no global
   *  registry; used by tests proving edition stability and by future
   *  edition rollouts. Defaults to EDITION_DEFAULTS. */
  editions?: Readonly<Record<number, EditionDefaults>>;
  /** Latest data-derived domains retained by an interaction controller while
   * an explicit zoom domain is effective. Omit for an unzoomed render. */
  baselineDomains?: ScaleDomainSnapshot;
  /** Unzoomed positional scale configuration. When supplied, the pipeline
   * trains the latest natural baseline from this run's data while rendering
   * with the spec's effective (typically explicit zoom) domains. Missing
   * axes mean natural default scale configuration. `baselineDomains` wins. */
  baselineScales?: Readonly<{
    x?: PositionScaleSpec;
    y?: PositionScaleSpec;
  }>;
  /** Data-changing runtime filters, applied before facets, stats, scales,
   * layout, candidates, and rendering. Source-row identity is preserved. */
  rowFilters?: readonly RuntimeRowFilterClause[];
}
