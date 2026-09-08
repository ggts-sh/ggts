import type { CellValue } from "@ggsvelte/core";
import type {
  InspectOptions as CoreInspectOptions,
  PlotInspectionChange,
  ResolvedInteractionConfig as CoreResolvedInteractionConfig,
} from "@ggsvelte/core/interaction";
import type { ReactNode } from "react";
export type * from "@ggsvelte/core/interaction";
export { createPlotInteraction } from "@ggsvelte/core/interaction";

export type InspectOptions<Row = Record<string, CellValue>, Key = PropertyKey> = CoreInspectOptions<
  Row,
  Key,
  (inspection: PlotInspectionChange<Row, Key>) => ReactNode
>;
export type InspectInput<Row = Record<string, CellValue>, Key = PropertyKey> =
  | boolean
  | InspectOptions<Row, Key>;
export type ResolvedInteractionConfig = CoreResolvedInteractionConfig<
  Record<string, CellValue>,
  PropertyKey,
  (inspection: PlotInspectionChange<Record<string, CellValue>, PropertyKey>) => ReactNode
>;
