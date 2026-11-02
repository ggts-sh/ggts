/** Legend title measuring and positioning shared by legend builders. */
import { FONT_METRICS } from "./layout/font-metrics.js";
import type { TextMeasurer } from "./layout/measure.js";
import type { SceneLegendEntry } from "./scene.js";
import {
  LEGEND_ELLIPSIS,
  LEGEND_ROW_HEIGHT,
  PADDING,
  presentedLegendTitle,
} from "./legend-build-shared.js";
import type { ResolvedLegendAppearance } from "./legend-build-types.js";

export type TitlePosition = "top" | "bottom" | "left" | "right";

/** Baseline of a top/bottom title band, matching the historical top-title offset. */
function bandBaseline(titleBand: number): number {
  return Math.max(11, titleBand - 7);
}

/**
 * The canonical metrics table fixes the ascent share of the measured line box.
 * Side titles share the first key baseline.
 */
const TITLE_ASCENT_SHARE = FONT_METRICS.ascent / (FONT_METRICS.ascent + FONT_METRICS.descent);

/** Smallest interactive key/label block a side title must leave untouched. */
export const MIN_INTERACTIVE_KEY_LABEL_WIDTH = 24;

/** Widths and reserves a guide title claims before its keys are laid out. */
export interface LegendTitleSpan {
  show: boolean;
  side: boolean;
  display?: string;
  width: number;
  alloc: number;
  topBand: number;
  labelReserve: number;
}

export function legendTitleSpan(input: {
  title: string;
  titleSize: number;
  labelSize: number;
  keySize: number;
  keyGap: number;
  maxWidth: number;
  position: TitlePosition;
  band: number;
  hasEntries: boolean;
  /** Widest full label before truncation, when entries exist. */
  labelRequirement?: number;
  /** Right titles decide collision errors after their key row is laid out. */
  deferTitleError?: boolean;
  measurer: TextMeasurer;
  appearance: ResolvedLegendAppearance | undefined;
  scale: string;
}): LegendTitleSpan {
  const {
    title,
    titleSize,
    labelSize,
    keySize,
    keyGap,
    maxWidth,
    position,
    band,
    hasEntries,
    labelRequirement,
    deferTitleError,
    measurer,
    appearance,
    scale,
  } = input;
  if (title === "") {
    return { show: false, side: false, width: 0, alloc: 0, topBand: 0, labelReserve: 1 };
  }
  const side = position === "left" || position === "right";
  let display: string | undefined;
  let width: number;
  let labelReserve = 1;
  if (side) {
    const inner = Math.max(0, maxWidth - PADDING * 2);
    // A truncated label bottoms out at the ellipsis, so that is the real
    // minimum the key row can occupy.
    const minimumLabelWidth = Math.max(1, measurer.measureWidth(LEGEND_ELLIPSIS, labelSize));
    // Reserve what the labels actually need, but never more than a truncatable
    // ellipsis: shorter labels leave more room for a complete title.
    const labelWidth =
      labelRequirement === undefined
        ? minimumLabelWidth
        : Math.min(minimumLabelWidth, labelRequirement);
    const keyLabelWidth =
      position === "right"
        ? Math.max(keySize + keyGap + labelWidth, MIN_INTERACTIVE_KEY_LABEL_WIDTH)
        : keySize + keyGap + labelWidth;
    const available = hasEntries ? Math.max(0, inner - keyLabelWidth - keyGap) : inner;
    display = presentedLegendTitle(
      title,
      available,
      measurer,
      titleSize,
      deferTitleError === true ? undefined : appearance,
      scale,
    );
    width = measurer.measureWidth(display, titleSize);
    labelReserve = minimumLabelWidth;
  } else {
    width = measurer.measureWidth(title, titleSize);
  }
  return {
    show: true,
    side,
    ...(display !== undefined && display !== title && { display }),
    width,
    alloc: side ? width + keyGap : 0,
    topBand: position === "top" ? band : 0,
    labelReserve,
  };
}

/**
 * Place a title around a laid-out key block.
 * `contentBottom` is the bottom of the key content before legend padding;
 * side titles shift the entries and share the first key baseline, while
 * bottom titles sit below `contentBottom` and top titles above it.
 */
export function placeLegendTitle(input: {
  show: boolean;
  titleSize: number;
  labelSize: number;
  position: TitlePosition;
  band: number;
  measurer: TextMeasurer;
  entries: SceneLegendEntry[];
  contentBottom: number;
  rightTitleX: number;
  display?: string;
}): { titleX?: number; titleY?: number; titleLabel?: string; height: number } {
  const {
    show,
    titleSize,
    labelSize,
    position,
    band,
    measurer,
    entries,
    contentBottom,
    rightTitleX,
    display,
  } = input;
  if (!show) return { height: contentBottom + PADDING };
  if (position === "left" || position === "right") {
    const first = entries[0];
    const lineHeight = measurer.measureHeight(titleSize);
    const ascent = lineHeight * TITLE_ASCENT_SHARE;
    const baseline =
      first === undefined ? 0 : (first.height ?? LEGEND_ROW_HEIGHT) / 2 + labelSize * 0.32;
    // Shift rows down so the shared baseline still fits the title ascent.
    const shift = first === undefined ? 0 : Math.max(0, ascent - baseline);
    if (shift !== 0) for (const entry of entries) entry.y += shift;
    const titleY = first === undefined ? bandBaseline(band) : first.y + baseline;
    return {
      titleX: position === "right" && first !== undefined ? rightTitleX : PADDING,
      titleY,
      height: Math.max(
        contentBottom + shift + PADDING,
        titleY + lineHeight - ascent + PADDING,
        first === undefined ? band + PADDING : 0,
      ),
      ...(display !== undefined && { titleLabel: display }),
    };
  }
  if (position === "bottom") {
    return {
      titleX: PADDING,
      titleY: contentBottom + bandBaseline(band),
      height: contentBottom + band + PADDING,
    };
  }
  return { titleX: PADDING, titleY: bandBaseline(band), height: contentBottom + PADDING };
}
