/**
 * Pure plot-root layout chrome: inline size/theme style, responsive
 * breakpoint helpers, tooltip viewport clamp, and legend clear-control
 * anchor lookup. Hosts own class bindings and tool-rail visibility.
 */

const NARROW_TOOLS_MAX_WIDTH_PX = 560;
const DOCKED_TOOLTIP_MAX_WIDTH_PX = 480;
/**
 * Pre-measure fallback for container-width plots (SSR and collapsed hosts).
 * 52rem at the common 16px root — matches docs `.plot-panel` max width so a
 * typical laptop does not paint a skinny chart and then jump wider after
 * ResizeObserver. Not a phone-first size; phones are not the design target.
 */
const DEFAULT_PLOT_WIDTH_PX = 832;
const DEFAULT_PLOT_HEIGHT_PX = 400;

export type ResolvePlotSizeInput = {
  /** Host width prop: fixed px, `"container"`, or omitted (container mode). */
  readonly width: number | "container" | undefined;
  readonly height: number | undefined;
  /** ResizeObserver content width when in container mode; null before first measure. */
  readonly containerWidth: number | null;
  /** Assembled spec width fallback. */
  readonly assembledWidth: number | undefined;
  /** Assembled spec height fallback. */
  readonly assembledHeight: number | undefined;
};

/**
 * True when the width prop is omitted or `"container"` (responsive layout).
 * Shared by resolvePlotSize, paint readiness widthMode, root class, ResizeObserver
 * install, and plotRootInlineStyle containerWidth flag.
 * Type predicate so fixed-mode branches narrow to `number`.
 */
export function isContainerWidthProp(
  width: number | "container" | undefined,
): width is "container" | undefined {
  return width === undefined || width === "container";
}

/**
 * Resolved plot pixel size for the pipeline and root style.
 * Container mode: measured container width, then assembled, then
 * DEFAULT_PLOT_WIDTH_PX (832). Fixed mode: the numeric width prop (assembled
 * fallback is unused once fixed). Height: height prop, then assembled, then 400.
 */
export function resolvePlotSize(input: ResolvePlotSizeInput): {
  readonly width: number;
  readonly height: number;
} {
  const width = isContainerWidthProp(input.width)
    ? (input.containerWidth ?? input.assembledWidth ?? DEFAULT_PLOT_WIDTH_PX)
    : input.width;
  const height = input.height ?? input.assembledHeight ?? DEFAULT_PLOT_HEIGHT_PX;
  return { width, height };
}

/** True when the tool rail should use the narrow layout (width < 560). */
export function isNarrowToolsWidth(widthPx: number): boolean {
  return widthPx < NARROW_TOOLS_MAX_WIDTH_PX;
}

/**
 * True when a pinned tooltip should dock (width < 480).
 * Prefer `isTooltipDocked` at call sites that also gate on pin state.
 */
export function isDockedTooltipWidth(widthPx: number): boolean {
  return widthPx < DOCKED_TOOLTIP_MAX_WIDTH_PX;
}

/**
 * Whether the inspection tooltip (and root docked chrome class) should dock.
 * Unifies root class and Tooltip `docked` prop (both used pinned + width).
 */
export function isTooltipDocked(input: {
  readonly inspectionState: "transient" | "pinned" | "none" | null | undefined;
  readonly widthPx: number;
}): boolean {
  return input.inspectionState === "pinned" && isDockedTooltipWidth(input.widthPx);
}

/** Stable DOM id for the plot's inspection tooltip element. */
export function plotTooltipDomId(plotId: string): string {
  return `${plotId}-tooltip`;
}

/**
 * Capture-surface `aria-controls` when a pinned interactive tooltip is up.
 * Undefined otherwise (attribute omitted).
 *
 * Takes domain state (not pre-derived booleans) so hosts pass `inspection?.state`
 * and inspect `contentMode` directly — same shape as `isTooltipDocked`.
 */
export function resolveCaptureAriaControls(input: {
  readonly inspectionState: "transient" | "pinned" | "none" | null | undefined;
  readonly contentMode: "interactive" | "informational" | undefined;
  readonly plotId: string;
}): string | undefined {
  if (input.inspectionState !== "pinned" || input.contentMode !== "interactive") return undefined;
  return plotTooltipDomId(input.plotId);
}

export type TooltipViewportSizeInput = {
  readonly sceneWidth: number;
  readonly sceneHeight: number;
  /** Host: `root?.clientWidth` — nullish falls back to scene; 0 is kept. */
  readonly clientWidth: number | null | undefined;
  /** Host: `root?.clientHeight` — nullish falls back to scene; 0 is kept. */
  readonly clientHeight: number | null | undefined;
};

/**
 * Tooltip layout box: min(scene, client) per axis.
 * Uses nullish coalesce so a laid-out zero client size does not fall back
 * to the scene (matches historical `root?.clientWidth ?? sceneWidth`).
 */
export function tooltipViewportSize(input: TooltipViewportSizeInput): {
  readonly width: number;
  readonly height: number;
} {
  return {
    width: Math.min(input.sceneWidth, input.clientWidth ?? input.sceneWidth),
    height: Math.min(input.sceneHeight, input.clientHeight ?? input.sceneHeight),
  };
}

export type PlotRootStyleInput = {
  /**
   * When true, emit width/height CSS before theme tokens.
   * Host: hasCanvas || interactive || emphasis || selection.
   */
  readonly needsSizedBox: boolean;
  /** True when the width prop is undefined or `"container"`. */
  readonly containerWidth: boolean;
  /** Fixed-width CSS uses scene dimensions (model scene with resolved fallback). */
  readonly sceneWidth: number;
  readonly sceneHeight: number;
  readonly themeStyle: string;
};

/**
 * Root `style` attribute value.
 * Sized box: `width:…;height:…;` then raw `themeStyle` (no extra separator).
 * Empty concatenation → `undefined` (matches host `… || undefined`).
 */
export function plotRootInlineStyle(input: PlotRootStyleInput): string | undefined {
  const sizeCss = input.needsSizedBox
    ? `width:${input.containerWidth ? "100%" : `${input.sceneWidth}px`};height:${input.sceneHeight}px;`
    : "";
  return `${sizeCss}${input.themeStyle}` || undefined;
}

export {
  CLEAR_CONTROL_GAP_PX,
  CLEAR_CONTROL_HEIGHT_PX,
  resolveClearControlLayout,
  type ClearControlLayout,
} from "@ggts-sh/core/interaction";

/** Grace period after pointer leaves legend chrome before Clear fades for screenshots. */
export const CLEAR_HIDE_DELAY_MS = 2500;

/**
 * Whether the Clear control should paint (opacity / pointer-events) while a
 * series remains pressed. Host owns the hide timer; this pure gate only
 * combines pressed + chrome hover/focus + elapsed hide.
 */
export function shouldRevealClearControl(input: {
  readonly pressed: boolean;
  /** Pointer over legend targets/clear, or focus within that chrome. */
  readonly chromeActive: boolean;
  /** True once the post-leave hide delay has elapsed without re-entry. */
  readonly hideElapsed: boolean;
}): boolean {
  if (!input.pressed) return false;
  if (input.chromeActive) return true;
  return !input.hideElapsed;
}
