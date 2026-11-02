/** Shared legend layout metrics, style resolution, and label presentation helpers. */
import type { TextMeasurer } from "./layout/measure.js";
import { truncateToFit } from "./layout/truncate.js";
import {
  type LegendInput,
  type ResolvedLegendAppearance,
  LegendLayoutError,
} from "./legend-build-types.js";

// Re-export so legend-build/legend keep a stable path during the domain-labels split (#841).
export { disambiguatedLabels } from "./domain-labels.js";

const FONT_SIZE = 11;
const TITLE_HEIGHT = 18;
const TITLE_DESCENDER_GAP = 7;
export const LEGEND_ROW_HEIGHT = 24;
const SWATCH_SIZE = 10;
const SWATCH_GAP = 6;
export const PADDING = 4;
export const BLOCK_GAP = 12;
const RAMP_WIDTH = 12;
const HORIZONTAL_RAMP_LENGTH = 180;

/** Ellipsis for legend entry truncation (same glyph as axis paths). */
export const LEGEND_ELLIPSIS = "…";

/** Binary-search truncation shared with axis layout, honoring guide typography. */
function truncateOrThrow(
  label: string,
  maxWidth: number,
  measurer: TextMeasurer,
  fontSize: number,
  appearance: ResolvedLegendAppearance | undefined,
  scale: string,
  detail?: string,
): string {
  const truncated = truncateToFit(label, maxWidth, measurer, fontSize, LEGEND_ELLIPSIS);
  if (appearance?.collision === "error" && truncated !== label)
    throw new LegendLayoutError(scale, label, detail);
  return truncated;
}

/** Greedy, lossless wrapping. Over-wide tokens are split instead of ellipsized. */
function wrapLegendLabel(
  label: string,
  maxWidth: number,
  measurer: TextMeasurer,
  fontSize: number,
): string[] {
  const words = label.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  const flush = () => {
    if (current !== "") lines.push(current);
    current = "";
  };
  for (const word of words) {
    const trial = current === "" ? word : `${current} ${word}`;
    if (measurer.measureWidth(trial, fontSize) <= maxWidth) {
      current = trial;
      continue;
    }
    flush();
    let chunk = "";
    for (const character of word) {
      const next = `${chunk}${character}`;
      if (chunk !== "" && measurer.measureWidth(next, fontSize) > maxWidth) {
        lines.push(chunk);
        chunk = character;
      } else {
        chunk = next;
      }
    }
    current = chunk;
  }
  flush();
  return lines;
}

export interface PresentedDiscreteLabel {
  label: string;
  lines?: string[];
  width: number;
  height: number;
  lineHeight: number;
}

export function presentedDiscreteLabel(
  fullLabel: string,
  maxWidth: number,
  measurer: TextMeasurer,
  fontSize: number,
  appearance: ResolvedLegendAppearance | undefined,
  scale: string,
): PresentedDiscreteLabel {
  const lineHeight = measurer.measureHeight(fontSize);
  if (appearance?.collision === "wrap") {
    const lines = wrapLegendLabel(fullLabel, maxWidth, measurer, fontSize);
    return {
      label: lines.join(" "),
      lines,
      width: Math.max(0, ...lines.map((line) => measurer.measureWidth(line, fontSize))),
      height: lines.length * lineHeight,
      lineHeight,
    };
  }
  const label = truncateOrThrow(fullLabel, maxWidth, measurer, fontSize, appearance, scale);
  return {
    label,
    width: measurer.measureWidth(label, fontSize),
    height: lineHeight,
    lineHeight,
  };
}

export function legendTitleHeight(title: string, titleSize: number): number {
  return title === "" ? 0 : Math.max(TITLE_HEIGHT, titleSize + TITLE_DESCENDER_GAP);
}

/** Display title for side slots; `title` stays the full semantic string. */
export function presentedLegendTitle(
  title: string,
  maxWidth: number,
  measurer: TextMeasurer,
  fontSize: number,
  appearance: ResolvedLegendAppearance | undefined,
  scale: string,
): string {
  return truncateOrThrow(
    title,
    maxWidth,
    measurer,
    fontSize,
    appearance,
    scale,
    `The ${scale} guide title "${title}" cannot fit without truncation.`,
  );
}

/** Resolved guide layout settings shared by the legend builders. */
export interface LegendSettings {
  appearance: ResolvedLegendAppearance | undefined;
  position: "right" | "bottom";
  direction: "vertical" | "horizontal";
  titlePosition: "top" | "bottom" | "left" | "right" | undefined;
  title: string;
  titleSize: number;
  labelSize: number;
  keySize: number;
  keyGap: number;
  rowGap: number;
  blockGap: number;
  rampThickness: number;
  rampLength: number;
}

type LegendMetrics = Omit<
  LegendSettings,
  "appearance" | "position" | "direction" | "titlePosition"
>;

function legendMetrics(input: LegendInput): LegendMetrics {
  const appearance = input.appearance;
  const theme = appearance?.theme;
  return {
    title: appearance?.title ?? input.title,
    titleSize: theme?.titleSize ?? FONT_SIZE,
    labelSize: theme?.labelSize ?? FONT_SIZE,
    keySize: appearance?.keySize ?? SWATCH_SIZE,
    keyGap: theme?.keyGap ?? SWATCH_GAP,
    rowGap: theme?.rowGap ?? 0,
    blockGap: theme?.blockGap ?? BLOCK_GAP,
    rampThickness: theme?.colorbarThickness ?? RAMP_WIDTH,
    rampLength: theme?.colorbarLength ?? HORIZONTAL_RAMP_LENGTH,
  };
}

export function settings(input: LegendInput, position: "right" | "bottom"): LegendSettings {
  const appearance = input.appearance;
  const direction =
    appearance?.direction === undefined || appearance.direction === "auto"
      ? position === "bottom"
        ? "horizontal"
        : "vertical"
      : appearance.direction;
  return {
    appearance,
    position,
    direction,
    titlePosition: appearance?.titlePosition,
    ...legendMetrics(input),
  };
}

export function presentedContinuousLabel(input: {
  fullLabel: string;
  availableWidth: number;
  measurer: TextMeasurer;
  fontSize: number;
  appearance: ResolvedLegendAppearance | undefined;
  show: boolean;
  scale: string;
}): string {
  if (!input.show) return "";
  return truncateOrThrow(
    input.fullLabel,
    input.availableWidth,
    input.measurer,
    input.fontSize,
    input.appearance,
    input.scale,
  );
}
