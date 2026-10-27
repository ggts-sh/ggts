import type { AxisTicks, DeriveTicksContext } from "./layout-derive-ticks.js";
import type { TextMeasurer } from "./measure.js";
import type { LayoutInput, LayoutTheme } from "./layout-types.js";

export interface LayoutVisibility {
  xVisible: boolean;
  yVisible: boolean;
  xLabelsVisible: boolean;
  yLabelsVisible: boolean;
  xTicksVisible: boolean;
  yTicksVisible: boolean;
  xPreserve: boolean;
  yPreserve: boolean;
  yBandCollision: "auto" | "ellipsis" | "preserve" | undefined;
}

export interface LayoutCaps {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface LayoutAxisWork {
  axis: AxisTicks;
  count: number;
  every: number;
  context: DeriveTicksContext;
  truncated: boolean;
}

export interface LayoutPassWork {
  input: LayoutInput;
  theme: LayoutTheme;
  measurer: TextMeasurer;
  innerW: number;
  innerH: number;
  visibility: LayoutVisibility;
  caps: LayoutCaps;
  degradations: string[];
  x: LayoutAxisWork;
  y: LayoutAxisWork;
  labelH: number;
  leftFixed: number;
  bottomFixed: number;
  yLabelW: number;
  firstXLabelW: number;
  lastXLabelW: number;
}
