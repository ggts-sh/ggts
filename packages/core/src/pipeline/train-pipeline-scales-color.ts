/**
 * Resolve global color and fill scales for a pipeline run.
 */
import type { PortableSpec } from "@ggts-sh/spec";

import type { EditionDefaults } from "../editions.js";
import { humanizeFieldTitle } from "../humanize-field.js";
import type { ColumnTable } from "../table.js";

import { resolveColorScale } from "./scale-color.js";
import type { Advisory, LayerBinding, LayerFrame, PipelineWarning, RunOptions } from "./types.js";

export function trainPipelineColorScales(input: {
  scalesConfig: NonNullable<PortableSpec["scales"]>;
  labs: NonNullable<PortableSpec["labs"]>;
  allFrames: readonly LayerFrame[];
  bindings: readonly LayerBinding[];
  table: ColumnTable;
  /** Unfiltered bound table; supplies the stable color/fill value catalog. */
  sourceTable: ColumnTable;
  options: Pick<RunOptions, "prevScales">;
  editionDefaults: EditionDefaults;
  warnings: PipelineWarning[];
  advisories: Advisory[];
}): {
  colorResolution: ReturnType<typeof resolveColorScale>;
  fillResolution: ReturnType<typeof resolveColorScale>;
} {
  const {
    scalesConfig,
    labs,
    allFrames,
    bindings,
    table,
    sourceTable,
    options,
    editionDefaults,
    warnings,
    advisories,
  } = input;

  // Frames vanish when runtime filters remove every row, but the bindings
  // still name the mapped fields — the recovery legend needs its heading.
  const firstColorField =
    allFrames.find((f) => f.binding.color.field !== null)?.binding.color.field ??
    bindings.find((binding) => binding.color.field !== null)?.color.field;
  const firstFillField =
    allFrames.find((f) => f.binding.fill.field !== null)?.binding.fill.field ??
    bindings.find((binding) => binding.fill.field !== null)?.fill.field;
  const colorResolution = resolveColorScale(
    "color",
    allFrames,
    bindings,
    table,
    sourceTable,
    scalesConfig.color,
    options.prevScales?.["color"] ?? null,
    labs.color ?? humanizeFieldTitle(firstColorField ?? ""),
    warnings,
    advisories,
    editionDefaults,
  );
  const fillResolution = resolveColorScale(
    "fill",
    allFrames,
    bindings,
    table,
    sourceTable,
    scalesConfig.fill,
    options.prevScales?.["fill"] ?? null,
    labs.fill ?? humanizeFieldTitle(firstFillField ?? ""),
    warnings,
    advisories,
    editionDefaults,
  );

  return { colorResolution, fillResolution };
}
