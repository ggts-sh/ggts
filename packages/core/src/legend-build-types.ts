/** Legend builder input/output contracts and layout error type. */
import type { GuideThemeSpec, StyleAesthetic } from "@ggts-sh/spec";

import type { Linetype, PointShape } from "./scales/style.js";
import type { SceneLegend } from "./scene.js";

export type LegendOrder = "stable-domain" | "present-first-seen" | "sorted";
type GuidePosition = "auto" | "right" | "bottom";
type GuideDirection = "auto" | "vertical" | "horizontal";

export interface ResolvedLegendAppearance {
  type: "legend" | "colorbar" | "colorsteps" | "none";
  title: string;
  order: number;
  position: GuidePosition;
  direction: GuideDirection;
  keySize?: number;
  collision?: "ellipsis" | "wrap" | "error";
  force?: boolean;
  showTicks?: boolean;
  showLabels?: boolean;
  theme?: GuideThemeSpec;
}

export interface LegendKeyStyle {
  color?: string;
  size?: number;
  linewidth?: number;
  alpha?: number;
  shape?: PointShape;
  linetype?: Linetype;
}

export interface DiscreteLegendInput {
  kind: "discrete";
  scale: "color" | "fill" | StyleAesthetic;
  aesthetics?: readonly ("color" | "fill" | StyleAesthetic)[];
  appearance?: ResolvedLegendAppearance;
  title: string;
  domain: readonly unknown[];
  firstSeen: readonly unknown[];
  interactive?: boolean;
  colorOf?(value: unknown): string | undefined;
  keyOf?(value: unknown): LegendKeyStyle;
  labelOf?(value: unknown): string;
}

export interface RampLegendInput {
  kind: "ramp";
  scale: "color" | "fill";
  aesthetics?: readonly ("color" | "fill")[];
  appearance?: ResolvedLegendAppearance;
  title: string;
  domain: [number, number];
  at(t: number): string;
  format(value: number): string;
  /** Complete semantic label used for accessibility/details when display text is abbreviated. */
  formatFull?(value: number): string;
  ticks?: readonly number[];
  position?: (value: number) => number;
}

export interface StepsLegendInput {
  kind: "steps";
  scale: "color" | "fill";
  aesthetics?: readonly ("color" | "fill")[];
  appearance?: ResolvedLegendAppearance;
  title: string;
  entries: readonly Readonly<{ label: string; color: string }>[];
}

export type LegendInput = DiscreteLegendInput | RampLegendInput | StepsLegendInput;

export interface LegendBlock {
  legends: SceneLegend[];
  /** Width reserved on the right. */
  width: number;
  /** Height occupied by right-positioned blocks. */
  height: number;
  /** Height reserved below the panel for bottom-positioned blocks. */
  bottomHeight: number;
  /** True when at least one auto-positioned guide degraded from right to bottom. */
  autoMovedBottom: boolean;
}

export class LegendLayoutError extends Error {
  constructor(
    readonly scale: string,
    readonly label: string,
    detail?: string,
    readonly recovery = 'Use collision: "ellipsis", move the guide below, or shorten the label.',
  ) {
    super(detail ?? `The ${scale} guide label "${label}" cannot fit without truncation.`);
    this.name = "LegendLayoutError";
  }
}
