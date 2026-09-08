import type { CellValue } from "@ggts-sh/core";
import type {
  InspectOptions as CoreInspectOptions,
  PlotInspectionChange,
  ResolvedInteractionConfig as CoreResolvedInteractionConfig,
} from "@ggts-sh/core/interaction";
import type { ReactNode } from "react";
export type * from "@ggts-sh/core/interaction";
export { createPlotInteraction } from "@ggts-sh/core/interaction";

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
