/** Discrete (categorical) legend scene builder. */
import type { TextMeasurer } from "./layout/measure.js";
import { DEFAULT_MISSING_COLOR } from "./scales/engine.js";
import { encodeKey } from "./scales/state.js";
import { bandKey } from "./scales/train.js";
import type { SceneLegend, SceneLegendEntry } from "./scene.js";
import { disambiguatedLabels } from "./domain-labels.js";
import {
  LEGEND_ROW_HEIGHT,
  legendTitleHeight,
  PADDING,
  presentedDiscreteLabel,
  presentedLegendTitle,
  settings,
  type LegendSettings,
  type PresentedDiscreteLabel,
} from "./legend-build-shared.js";
import type { DiscreteLegendInput, LegendKeyStyle, LegendOrder } from "./legend-build-types.js";
import {
  legendTitleSpan,
  MIN_INTERACTIVE_KEY_LABEL_WIDTH,
  placeLegendTitle,
  type LegendTitleSpan,
  type TitlePosition,
} from "./legend-title-layout.js";

const UNKNOWN_COLOR = DEFAULT_MISSING_COLOR;

function orderedValues(input: DiscreteLegendInput, order: LegendOrder): unknown[] {
  switch (order) {
    case "present-first-seen": {
      const domainKeys = new Set(input.domain.map((value) => encodeKey(value)));
      const seen = new Set<string>();
      const out: unknown[] = [];
      for (const value of input.firstSeen) {
        const key = encodeKey(value);
        if (!domainKeys.has(key) || seen.has(key)) continue;
        seen.add(key);
        out.push(value);
      }
      return out;
    }
    case "sorted":
      return [...input.domain].toSorted((a, b) => bandKey(a).localeCompare(bandKey(b), "en"));
    default:
      return [...input.domain];
  }
}

function discreteEntry(input: {
  value: unknown;
  fullLabel: string;
  presented: PresentedDiscreteLabel;
  key: LegendKeyStyle;
  paint: string | undefined;
  x: number;
  y: number;
  height: number;
}): SceneLegendEntry {
  const { value, fullLabel, presented, key, paint, x, y, height } = input;
  return {
    value,
    label: presented.label,
    fullLabel,
    ...(presented.lines !== undefined && {
      lines: presented.lines,
      lineHeight: presented.lineHeight,
    }),
    ...key,
    color: paint ?? key.color ?? UNKNOWN_COLOR,
    ...((paint !== undefined || key.color !== undefined) && { hasPaint: true }),
    x,
    y,
    ...(height !== LEGEND_ROW_HEIGHT && { height }),
  };
}

/** Outer box of the laid-out keys plus the title's claim on that box. */
function contentBox(input: {
  vertical: boolean;
  empty: boolean;
  title: LegendTitleSpan;
  titlePosition: TitlePosition;
  maxWidth: number;
  keyGap: number;
  blockWidth: number;
  rowHeight: number;
  cursorY: number;
  rightMinX: number;
}): { width: number; contentBottom: number; rightTitleX: number } {
  const {
    vertical,
    empty,
    title,
    titlePosition,
    maxWidth,
    keyGap,
    blockWidth,
    rowHeight,
    cursorY,
    rightMinX,
  } = input;
  const pad = vertical ? PADDING * 2 : 0;
  const inlinePad = PADDING * 2 - pad;
  const rightOffset = vertical ? PADDING + keyGap : keyGap - PADDING;
  // Keep the interactive key/label target clear of a right-hand title.
  const titleBlock =
    title.show && title.side && titlePosition === "right"
      ? Math.max(blockWidth, rightMinX - rightOffset)
      : blockWidth;
  const sideWidth = empty
    ? title.width + inlinePad
    : titleBlock + (vertical || titlePosition === "right" ? title.alloc : 0);
  const plainWidth = Math.max(blockWidth, title.show ? Math.ceil(title.width) + inlinePad : 0);
  const contentWidth = title.show && title.side ? sideWidth : plainWidth;
  return {
    width: Math.min(maxWidth, pad + contentWidth),
    contentBottom: vertical ? cursorY : cursorY + (empty ? 0 : rowHeight),
    rightTitleX: titleBlock + rightOffset,
  };
}

/** Left edge a right-hand title must clear so every row-end target stays whole. */
function rightTitleMinX(entries: SceneLegendEntry[], vertical: boolean): number {
  let minimum = 0;
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index]!;
    const next = entries[index + 1];
    if (!vertical && next !== undefined && next.y === entry.y) continue;
    minimum = Math.max(minimum, (entry.x ?? 0) + MIN_INTERACTIVE_KEY_LABEL_WIDTH);
  }
  return minimum;
}

interface DiscreteLayoutInput {
  source: DiscreteLegendInput;
  values: unknown[];
  fullLabels: string[];
  keys: LegendKeyStyle[];
  style: LegendSettings;
  measurer: TextMeasurer;
  maxWidth: number;
  titlePosition: TitlePosition;
  titleBand: number;
  keySize: number;
}

/** Size the title before the key loop; a left/right title may claim a label width. */
function initialTitle(input: DiscreteLayoutInput): LegendTitleSpan {
  const {
    source,
    values,
    fullLabels,
    style,
    measurer,
    maxWidth,
    titlePosition,
    titleBand,
    keySize,
  } = input;
  const labelRequirement =
    values.length === 0 ||
    style.title === "" ||
    (titlePosition !== "left" && titlePosition !== "right")
      ? undefined
      : fullLabels.reduce(
          (max, label) => Math.max(max, measurer.measureWidth(label, style.labelSize)),
          0,
        );
  return legendTitleSpan({
    title: style.title,
    titleSize: style.titleSize,
    labelSize: style.labelSize,
    keySize,
    keyGap: style.keyGap,
    maxWidth,
    position: titlePosition,
    band: titleBand,
    hasEntries: values.length > 0,
    ...(labelRequirement !== undefined && { labelRequirement }),
    deferTitleError: titlePosition === "right" && values.length > 0,
    measurer,
    appearance: style.appearance,
    scale: source.scale,
  });
}

/** Refit a right-hand title once row-end targets are known; returns the min clear X. */
function fitRightTitle(
  input: DiscreteLayoutInput,
  entries: SceneLegendEntry[],
  title: LegendTitleSpan,
  vertical: boolean,
  blockWidth: number,
): { title: LegendTitleSpan; rightMinX: number } {
  const { source, style, measurer, maxWidth, titlePosition } = input;
  const rightMinX =
    title.show && title.side && titlePosition === "right" ? rightTitleMinX(entries, vertical) : 0;
  if (rightMinX === 0) return { title, rightMinX };
  const rightOffset = vertical ? PADDING + style.keyGap : style.keyGap - PADDING;
  const titleBlock = Math.max(blockWidth, rightMinX - rightOffset);
  const available = Math.max(0, maxWidth - (titleBlock + rightOffset));
  const display = presentedLegendTitle(
    style.title,
    available,
    measurer,
    style.titleSize,
    style.appearance,
    source.scale,
  );
  const width = measurer.measureWidth(display, style.titleSize);
  return {
    title: {
      show: title.show,
      side: title.side,
      ...(display !== style.title && { display }),
      width,
      alloc: width + style.keyGap,
      topBand: title.topBand,
      labelReserve: title.labelReserve,
    },
    rightMinX,
  };
}

function buildDiscreteLayout(input: DiscreteLayoutInput): {
  entries: SceneLegendEntry[];
  width: number;
  height: number;
  titleX?: number;
  titleY?: number;
  titleLabel?: string;
} {
  const { source, values, fullLabels, keys, style, measurer, maxWidth, titlePosition, keySize } =
    input;
  const vertical = style.direction === "vertical";
  let title = initialTitle(input);
  const startX = (vertical ? 0 : PADDING) + (titlePosition === "left" ? title.alloc : 0);
  const rowLimit =
    titlePosition === "right" ? Math.max(startX + 1, maxWidth - title.alloc) : maxWidth;
  const maxLabelWidth = Math.max(
    title.labelReserve,
    (vertical ? maxWidth : rowLimit) -
      PADDING * 2 -
      keySize -
      style.keyGap -
      (vertical || titlePosition === "left" ? title.alloc : 0),
  );
  const entries: SceneLegendEntry[] = [];
  let cursorX = startX;
  let cursorY = title.topBand;
  let rowHeight = 0;
  let rowWidth = 0;
  let labelWidth = 0;
  for (let index = 0; index < values.length; index++) {
    const fullLabel = fullLabels[index]!;
    const presented = presentedDiscreteLabel(
      fullLabel,
      maxLabelWidth,
      measurer,
      style.labelSize,
      style.appearance,
      source.scale,
    );
    const entryHeight = Math.max(LEGEND_ROW_HEIGHT, keySize, presented.height);
    let x: number;
    if (vertical) {
      labelWidth = Math.max(labelWidth, presented.width);
      x = startX;
    } else {
      const itemWidth = keySize + style.keyGap + presented.width + PADDING * 2;
      if (cursorX > startX && cursorX + itemWidth > rowLimit) {
        cursorX = startX;
        cursorY += rowHeight + style.rowGap;
        rowHeight = 0;
      }
      x = cursorX - PADDING;
      cursorX += itemWidth;
      rowHeight = Math.max(rowHeight, entryHeight);
      rowWidth = Math.max(rowWidth, cursorX);
    }
    entries.push(
      discreteEntry({
        value: values[index],
        fullLabel,
        presented,
        key: keys[index]!,
        paint: source.colorOf?.(values[index]),
        x,
        y: cursorY,
        height: entryHeight,
      }),
    );
    if (vertical) cursorY += entryHeight + (index + 1 < values.length ? style.rowGap : 0);
  }
  const empty = entries.length === 0;
  const blockWidth = vertical
    ? empty
      ? 0
      : keySize + style.keyGap + Math.ceil(labelWidth)
    : rowWidth;
  const fit = fitRightTitle(input, entries, title, vertical, blockWidth);
  title = fit.title;
  const { rightMinX } = fit;
  const box = contentBox({
    vertical,
    empty,
    title,
    titlePosition,
    maxWidth,
    keyGap: style.keyGap,
    blockWidth,
    rowHeight,
    cursorY,
    rightMinX,
  });
  return {
    entries,
    width: box.width,
    ...placeLegendTitle({
      show: title.show,
      titleSize: style.titleSize,
      labelSize: style.labelSize,
      position: titlePosition,
      band: input.titleBand,
      measurer,
      entries,
      contentBottom: box.contentBottom,
      rightTitleX: box.rightTitleX,
      ...(title.display !== undefined && { display: title.display }),
    }),
  };
}

/**
 * Horizontal guides keep the title on the key row only when the title plus
 * every untruncated entry fits that row; otherwise they keep a top title band.
 * Vertical guides always keep the title above.
 */
function adaptiveTitlePosition(input: {
  style: LegendSettings;
  fullLabels: readonly string[];
  measurer: TextMeasurer;
  maxWidth: number;
  keySize: number;
}): TitlePosition {
  const { style, fullLabels, measurer, maxWidth, keySize } = input;
  if (style.direction === "vertical" || style.title === "") return "top";
  const titleAlloc = measurer.measureWidth(style.title, style.titleSize) + style.keyGap;
  const maxLabelWidth = maxWidth - PADDING * 2 - titleAlloc - keySize - style.keyGap;
  if (maxLabelWidth < 1) return "top";
  let rowWidth = PADDING + titleAlloc;
  for (const fullLabel of fullLabels) {
    const labelWidth = measurer.measureWidth(fullLabel, style.labelSize);
    if (labelWidth > maxLabelWidth) return "top";
    rowWidth += keySize + style.keyGap + labelWidth + PADDING * 2;
  }
  return rowWidth <= maxWidth ? "left" : "top";
}

export function buildDiscrete(
  input: DiscreteLegendInput,
  order: LegendOrder,
  measurer: TextMeasurer,
  maxWidth: number,
  position: "right" | "bottom",
): SceneLegend {
  const style = settings(input, position);
  const values = orderedValues(input, order);
  const fullLabels =
    input.labelOf === undefined
      ? disambiguatedLabels(values)
      : values.map((value) => input.labelOf?.(value) ?? "");
  const titleBand = legendTitleHeight(style.title, style.titleSize);
  const keys = values.map((value) => input.keyOf?.(value) ?? {});
  // Renderers cap point radii at half the swatch edge. Grow the key box so
  // mapped size keys remain visually distinct instead of collapsing at that cap.
  const maxKeyRadius = keys.reduce((max, key) => Math.max(max, key.size ?? 0), 0);
  const keySize = Math.max(style.keySize, Math.ceil(maxKeyRadius * 2));
  const titlePosition =
    style.titlePosition ??
    adaptiveTitlePosition({ style, fullLabels, measurer, maxWidth, keySize });
  const layout = buildDiscreteLayout({
    source: input,
    values,
    fullLabels,
    keys,
    style,
    measurer,
    maxWidth,
    titlePosition,
    titleBand,
    keySize,
  });
  return {
    type: "discrete",
    scale: input.scale,
    aesthetics: input.aesthetics ?? [input.scale],
    interactive: input.interactive ?? true,
    title: style.title,
    position,
    direction: style.direction,
    titleSize: style.titleSize,
    titleHeight: style.title === "" || titlePosition !== "top" ? 0 : titleBand,
    ...(layout.titleLabel !== undefined && { titleLabel: layout.titleLabel }),
    ...(layout.titleX !== undefined && { titleX: layout.titleX }),
    ...(layout.titleY !== undefined && { titleY: layout.titleY }),
    labelSize: style.labelSize,
    keyGap: style.keyGap,
    x: 0,
    y: 0,
    width: layout.width,
    height: layout.height,
    entries: layout.entries,
    swatchSize: keySize,
  };
}
