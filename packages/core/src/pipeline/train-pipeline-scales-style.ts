/** Resolve all mapped non-color style scales for one pipeline run. */
import type { PortableSpec, StyleAesthetic } from "@ggts-sh/spec";

import { humanizeFieldTitle } from "../humanize-field.js";
import type { ColumnTable } from "../table.js";

import { resolveStyleScale } from "./scale-style.js";
import type { Advisory, LayerBinding, LayerFrame, PipelineWarning, RunOptions } from "./types.js";

const STYLE_AESTHETICS = ["size", "linewidth", "alpha", "shape", "linetype"] as const;

export function trainPipelineStyleScales(input: {
  scalesConfig: NonNullable<PortableSpec["scales"]>;
  labs: NonNullable<PortableSpec["labs"]>;
  allFrames: readonly LayerFrame[];
  bindings: readonly LayerBinding[];
  table: ColumnTable;
  sourceTable: ColumnTable;
  options: Pick<RunOptions, "prevScales">;
  warnings: PipelineWarning[];
  advisories: Advisory[];
}) {
  const { scalesConfig, labs, allFrames, bindings, table, sourceTable, options, warnings } = input;
  const styleResolutions = {} as Record<StyleAesthetic, ReturnType<typeof resolveStyleScale>>;
  for (const aesthetic of STYLE_AESTHETICS) {
    const firstField =
      allFrames.find((frame) => frame.binding[aesthetic].field !== null)?.binding[aesthetic]
        .field ??
      bindings.find((binding) => binding[aesthetic].field !== null)?.[aesthetic].field ??
      "";
    styleResolutions[aesthetic] = resolveStyleScale({
      aesthetic,
      frames: allFrames,
      bindings,
      table,
      sourceTable,
      config: scalesConfig[aesthetic],
      prevState: options.prevScales?.[aesthetic] ?? null,
      title: labs[aesthetic] ?? humanizeFieldTitle(firstField),
      warnings,
    });
  }
  return { styleResolutions };
}
