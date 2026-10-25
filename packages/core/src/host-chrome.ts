import type { ResolvedInspectMode } from "./interaction-types.js";

export type InspectGuideAxes = {
  readonly vertical: boolean;
  readonly horizontal: boolean;
};

/** Which screen-space crosshairs an inspect mode paints. */
export function inspectGuideAxes(mode: ResolvedInspectMode, flipped: boolean): InspectGuideAxes {
  switch (mode) {
    case "exact":
      return { vertical: false, horizontal: false };
    case "xy":
      return { vertical: true, horizontal: true };
    case "x":
      return flipped
        ? { vertical: false, horizontal: true }
        : { vertical: true, horizontal: false };
    case "y":
      return flipped
        ? { vertical: true, horizontal: false }
        : { vertical: false, horizontal: true };
    default: {
      const unexpected: never = mode;
      throw new TypeError(`unexpected inspect mode ${String(unexpected)}`);
    }
  }
}

export type TooltipPinHintInput = {
  readonly pin: boolean;
  readonly tooltipBorder: string;
};

/** True when boxed tooltip chrome should advertise pinning. */
export function shouldShowTooltipPinHint(input: TooltipPinHintInput): boolean {
  if (!input.pin) return false;
  const border = input.tooltipBorder.trim().toLowerCase();
  return border !== "transparent" && border !== "none";
}

export type ShowToolRailInput = {
  readonly interactive: boolean;
  readonly availableToolCount: number;
  readonly canPublishPointSelection: boolean;
  readonly selectedKeyCount: number;
  readonly hasIntervalSelection: boolean;
  readonly hasZoomDomains: boolean;
};

/** Multi-tool mode, or a visible recovery control, requires the tool rail. */
export function shouldShowToolRail(input: ShowToolRailInput): boolean {
  return (
    input.interactive &&
    (input.availableToolCount > 1 ||
      (input.canPublishPointSelection && input.selectedKeyCount > 0) ||
      input.hasIntervalSelection ||
      input.hasZoomDomains)
  );
}

export const CLEAR_CONTROL_GAP_PX = 4;
export const CLEAR_CONTROL_HEIGHT_PX = 24;
const CLEAR_CONTROL_WIDTH_PX = 44;

export type ClearControlLayoutInput = {
  readonly legendFocusEnabled: boolean;
  readonly pressedScale: string | null;
  readonly legends: readonly {
    readonly scale: string;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly position?: "right" | "bottom";
    readonly direction?: "vertical" | "horizontal";
  }[];
  readonly sceneWidth: number;
  readonly sceneHeight: number;
};

export type ClearControlLayout = {
  readonly left: number;
  readonly top: number;
};

/** Scene-local, collision-safe position for a pressed legend's Clear control. */
export function resolveClearControlLayout(
  input: ClearControlLayoutInput,
): ClearControlLayout | null {
  if (!input.legendFocusEnabled || input.pressedScale === null) return null;
  const legend = input.legends.find((entry) => entry.scale === input.pressedScale);
  if (legend === undefined) return null;

  const position = legend.position ?? "right";
  const direction = legend.direction ?? (position === "bottom" ? "horizontal" : "vertical");
  const gap = CLEAR_CONTROL_GAP_PX;
  const btnW = CLEAR_CONTROL_WIDTH_PX;
  const btnH = CLEAR_CONTROL_HEIGHT_PX;
  const maxLeft = Math.max(gap, input.sceneWidth - btnW - gap);
  const maxTop = Math.max(gap, input.sceneHeight - btnH - gap);
  const clamp = (left: number, top: number): ClearControlLayout => ({
    left: Math.min(Math.max(gap, left), maxLeft),
    top: Math.min(Math.max(gap, top), maxTop),
  });
  const overlapsLegend = (layout: ClearControlLayout): boolean => {
    const right = layout.left + btnW;
    const bottom = layout.top + btnH;
    const legRight = legend.x + legend.width;
    const legBottom = legend.y + legend.height;
    return !(
      right <= legend.x ||
      layout.left >= legRight ||
      bottom <= legend.y ||
      layout.top >= legBottom
    );
  };
  const candidates: ClearControlLayout[] =
    position === "bottom" || direction === "horizontal"
      ? [
          clamp(legend.x + legend.width + gap, legend.y + Math.max(0, (legend.height - btnH) / 2)),
          clamp(legend.x, legend.y + legend.height + gap),
          clamp(legend.x, legend.y - gap - btnH),
        ]
      : [
          clamp(legend.x, legend.y + legend.height + gap),
          clamp(legend.x, legend.y - gap - btnH),
          clamp(legend.x - gap - btnW, legend.y),
        ];

  for (const candidate of candidates) {
    if (!overlapsLegend(candidate)) return candidate;
  }
  return candidates[0] ?? null;
}

export type PlotThemeCssTokens = {
  readonly interactionInk: string | number;
  readonly interactionMuted: string | number;
  readonly focusRing: string | number;
  readonly crosshair: string | number;
  readonly selectionFill: string | number;
  readonly selectionStroke: string | number;
  readonly tooltipPaper: string | number;
  readonly tooltipInk: string | number;
  readonly tooltipBorder: string | number;
  readonly toolActive: string | number;
};

const THEME_ROLES = [
  "interactionInk",
  "interactionMuted",
  "focusRing",
  "crosshair",
  "selectionFill",
  "selectionStroke",
  "tooltipPaper",
  "tooltipInk",
  "tooltipBorder",
  "toolActive",
] as const satisfies readonly (keyof PlotThemeCssTokens)[];

/** Theme custom properties for framework-owned HTML and SVG chrome. */
export function themeTokensToCssVars(tokens: PlotThemeCssTokens): Record<string, string> {
  return Object.fromEntries(
    THEME_ROLES.map((role) => [`--gg-theme-${role}`, String(tokens[role])]),
  );
}

/** Stable role-order CSS custom property string for Svelte's style attribute. */
export function themeTokensToCss(tokens: PlotThemeCssTokens): string {
  return THEME_ROLES.map((role) => `--gg-theme-${role}:${tokens[role]}`).join(";");
}
