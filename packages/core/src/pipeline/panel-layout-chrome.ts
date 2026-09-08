/**
 * Panel layout chrome: labs, axis titles (coord flip), formatters, legends.
 */
import type { PortableSpec, TemporalPrecision, TemporalScaleKind } from "@ggts-sh/spec";

import { humanizeFieldTitle } from "../humanize-field.js";
import { FONT_METRICS } from "../layout/font-metrics.js";
import type { LayoutTheme, TickFormatter } from "../layout/layout.js";
import { DEFAULT_LAYOUT_THEME } from "../layout/layout.js";
import type { TextMeasurer } from "../layout/measure.js";
import { MetricsTableMeasurer } from "../layout/measure.js";
import { buildLegends, LegendLayoutError, type LegendInput, type LegendOrder } from "../legend.js";
import type { PositionScale } from "../scales/train.js";
import type { ThemeTokens } from "../theme.js";

import {
  AXIS_TITLE_BAND,
  CAPTION_BAND,
  makeAxisFormatter,
  SUBTITLE_BAND,
  TITLE_BAND,
} from "./layout-helpers.js";
import type { DisplayBandFn, DisplayTemporalFn } from "./panel-layout-types.js";
import { positionConversionContext, positionValuesToNumeric } from "./temporal-position.js";
import { PipelineError, type LayerFrame, type PipelineWarning, type RunOptions } from "./types.js";

export interface PanelLayoutChrome {
  flip: boolean;
  scalesConfig: import("@ggts-sh/spec").Scales;
  title: string;
  subtitle: string;
  caption: string;
  xTitle: string;
  yTitle: string;
  hTitle: string;
  vTitle: string;
  topBand: number;
  bottomBand: number;
  axisTitleBand: number;
  layoutHeight: number;
  formatX: TickFormatter | undefined;
  formatY: TickFormatter | undefined;
  formatH: TickFormatter | undefined;
  formatV: TickFormatter | undefined;
  hBreaks: readonly (number | string)[] | undefined;
  vBreaks: readonly (number | string)[] | undefined;
  freeH: boolean;
  freeV: boolean;
  displayScales: (p: number) => { h: PositionScale; v: PositionScale };
  displayTemporal: DisplayTemporalFn;
  displayBand: DisplayBandFn;
  measurer: TextMeasurer;
  layoutTheme: LayoutTheme;
  legendBlock: ReturnType<typeof buildLegends>;
}

export interface PanelLayoutChromeInput {
  flip: boolean;
  freeX: boolean;
  freeY: boolean;
  panelScales: readonly { x: PositionScale; y: PositionScale }[];
  allFrames: readonly LayerFrame[];
  labs: NonNullable<PortableSpec["labs"]>;
  scalesConfig: NonNullable<PortableSpec["scales"]>;
  xScale: PositionScale;
  yScale: PositionScale;
  xTemporalKind: TemporalScaleKind | null;
  yTemporalKind: TemporalScaleKind | null;
  xTemporalPrecision: TemporalPrecision | null;
  yTemporalPrecision: TemporalPrecision | null;
  legendInputs: readonly LegendInput[];
  legendOrder: LegendOrder;
  theme: ThemeTokens;
  layoutAxisTitleSize: number;
  layoutAxisTextSize: number;
  options: Pick<RunOptions, "width" | "height" | "measureText">;
  warnings: PipelineWarning[];
}

interface PanelLayoutDisplay {
  hTitle: string;
  vTitle: string;
  formatX: TickFormatter | undefined;
  formatY: TickFormatter | undefined;
  formatH: TickFormatter | undefined;
  formatV: TickFormatter | undefined;
  hBreaks: readonly (number | string)[] | undefined;
  vBreaks: readonly (number | string)[] | undefined;
  freeH: boolean;
  freeV: boolean;
  displayScales: (p: number) => { h: PositionScale; v: PositionScale };
  displayTemporal: DisplayTemporalFn;
  displayBand: DisplayBandFn;
}

interface PanelLayoutLabs {
  title: string;
  subtitle: string;
  caption: string;
  xTitle: string;
  yTitle: string;
  topBand: number;
  bottomBand: number;
  axisTitleBand: number;
}

function flipDisplayTitles(
  flip: boolean,
  xTitle: string,
  yTitle: string,
): { hTitle: string; vTitle: string } {
  return flip ? { hTitle: yTitle, vTitle: xTitle } : { hTitle: xTitle, vTitle: yTitle };
}

function flipDisplayFormatters(
  flip: boolean,
  formatX: TickFormatter | undefined,
  formatY: TickFormatter | undefined,
): { formatH: TickFormatter | undefined; formatV: TickFormatter | undefined } {
  return flip ? { formatH: formatY, formatV: formatX } : { formatH: formatX, formatV: formatY };
}

function flipDisplayBreaks(
  flip: boolean,
  xBreaks: readonly (number | string)[] | undefined,
  yBreaks: readonly (number | string)[] | undefined,
): {
  hBreaks: readonly (number | string)[] | undefined;
  vBreaks: readonly (number | string)[] | undefined;
} {
  return flip ? { hBreaks: yBreaks, vBreaks: xBreaks } : { hBreaks: xBreaks, vBreaks: yBreaks };
}

function flipDisplayFreeFlags(
  flip: boolean,
  freeX: boolean,
  freeY: boolean,
): { freeH: boolean; freeV: boolean } {
  return flip ? { freeH: freeY, freeV: freeX } : { freeH: freeX, freeV: freeY };
}

function makeDisplayScalesFn(
  flip: boolean,
  panelScales: readonly { x: PositionScale; y: PositionScale }[],
): (p: number) => { h: PositionScale; v: PositionScale } {
  return (p: number) => {
    const s = panelScales[p]!;
    return flip ? { h: s.y, v: s.x } : { h: s.x, v: s.y };
  };
}

function temporalDisplayAxis(
  aesthetic: "x" | "y",
  scale: PositionScale,
  kind: TemporalScaleKind | null,
  config: NonNullable<PortableSpec["scales"]>["x"],
  panelIndex: number,
) {
  return scale.type === "time" && kind !== null
    ? {
        aesthetic,
        panelIndex,
        kind,
        config: config ?? {},
        ...(config?.breaks !== undefined && { sourceBreaks: config.breaks }),
      }
    : undefined;
}

function makeDisplayTemporalFn(input: {
  flip: boolean;
  xScale: PositionScale;
  yScale: PositionScale;
  scalesConfig: NonNullable<PortableSpec["scales"]>;
  xTemporalKind: TemporalScaleKind | null;
  yTemporalKind: TemporalScaleKind | null;
}): DisplayTemporalFn {
  return (panelIndex: number) => {
    const xKind = input.xTemporalKind ?? input.scalesConfig.x?.temporalKind ?? null;
    const yKind = input.yTemporalKind ?? input.scalesConfig.y?.temporalKind ?? null;
    const x = temporalDisplayAxis("x", input.xScale, xKind, input.scalesConfig.x, panelIndex);
    const y = temporalDisplayAxis("y", input.yScale, yKind, input.scalesConfig.y, panelIndex);
    return input.flip
      ? { ...(y !== undefined && { h: y }), ...(x !== undefined && { v: x }) }
      : { ...(x !== undefined && { h: x }), ...(y !== undefined && { v: y }) };
  };
}

function makeDisplayBandFn(
  flip: boolean,
  xScale: PositionScale,
  yScale: PositionScale,
  scalesConfig: NonNullable<PortableSpec["scales"]>,
): DisplayBandFn {
  return (panelIndex: number) => {
    const x =
      xScale.type === "band"
        ? { aesthetic: "x" as const, panelIndex, config: scalesConfig.x ?? {} }
        : undefined;
    const y =
      yScale.type === "band"
        ? { aesthetic: "y" as const, panelIndex, config: scalesConfig.y ?? {} }
        : undefined;
    return flip
      ? { ...(y !== undefined && { h: y }), ...(x !== undefined && { v: x }) }
      : { ...(x !== undefined && { h: x }), ...(y !== undefined && { v: y }) };
  };
}

function resolvePanelLayoutLabs(input: {
  allFrames: readonly LayerFrame[];
  labs: NonNullable<PortableSpec["labs"]>;
  theme: ThemeTokens;
  axisTitleSize: number;
  height: number;
}): PanelLayoutLabs & { layoutHeight: number } {
  const { allFrames, labs, theme, axisTitleSize, height } = input;

  const title = labs.title ?? "";
  const subtitle = labs.subtitle ?? "";
  const caption = labs.caption ?? "";
  const xField = allFrames.find((f) => f.binding.xField !== null)?.binding.xField ?? "";
  const yField =
    allFrames.find((f) => f.binding.yField !== null)?.binding.yField ??
    allFrames.find((f) => f.binding.yStatColumn !== null)?.binding.yStatColumn ??
    "";
  const xTitle = labs.x ?? humanizeFieldTitle(xField);
  const yTitle = labs.y ?? humanizeFieldTitle(yField);
  const titleBand = Math.max(TITLE_BAND, theme.titleSize + 7);
  const subtitleBand = Math.max(SUBTITLE_BAND, theme.subtitleSize + 4);
  const captionBand = Math.max(CAPTION_BAND, theme.captionSize + 5);
  const axisTitleBand = Math.max(AXIS_TITLE_BAND, axisTitleSize + 9);
  const topBand = (title === "" ? 0 : titleBand) + (subtitle === "" ? 0 : subtitleBand);
  const bottomBand = caption === "" ? 0 : captionBand;
  const layoutHeight = Math.max(40, height - topBand - bottomBand);

  return {
    title,
    subtitle,
    caption,
    xTitle,
    yTitle,
    topBand,
    bottomBand,
    axisTitleBand,
    layoutHeight,
  };
}

function resolvePanelLayoutDisplay(input: {
  flip: boolean;
  freeX: boolean;
  freeY: boolean;
  panelScales: readonly { x: PositionScale; y: PositionScale }[];
  scalesConfig: NonNullable<PortableSpec["scales"]>;
  xScale: PositionScale;
  yScale: PositionScale;
  xTemporalKind: TemporalScaleKind | null;
  yTemporalKind: TemporalScaleKind | null;
  xTemporalPrecision: TemporalPrecision | null;
  yTemporalPrecision: TemporalPrecision | null;
  xTitle: string;
  yTitle: string;
  warnings: PipelineWarning[];
}): PanelLayoutDisplay {
  const {
    flip,
    freeX,
    freeY,
    panelScales,
    scalesConfig,
    xScale,
    yScale,
    xTitle,
    yTitle,
    warnings,
  } = input;

  const formatX = makeAxisFormatter(
    "x",
    xScale,
    scalesConfig.x,
    warnings,
    input.xTemporalKind,
    input.xTemporalPrecision,
  );
  const formatY = makeAxisFormatter(
    "y",
    yScale,
    scalesConfig.y,
    warnings,
    input.yTemporalKind,
    input.yTemporalPrecision,
  );
  const { hTitle, vTitle } = flipDisplayTitles(flip, xTitle, yTitle);
  const { formatH, formatV } = flipDisplayFormatters(flip, formatX, formatY);
  const convertedBreaks = (axis: "x" | "y"): (number | string)[] | undefined => {
    const config = scalesConfig[axis];
    let breaks: (number | string)[] | undefined;
    if (config?.breaks !== undefined) {
      const scale = axis === "x" ? xScale : yScale;
      if (scale.type === "band") return [...config.breaks];
      const converted = positionValuesToNumeric(
        config.breaks,
        positionConversionContext(config),
      ).values;
      if ([...converted].some((value) => !Number.isFinite(value))) {
        throw new PipelineError(
          "invalid-scale-breaks",
          `/scales/${axis}/breaks`,
          `One or more ${axis} breaks do not match the scale's numeric or temporal parser.`,
        );
      }
      breaks = [...converted];
    }
    return breaks;
  };
  const { hBreaks, vBreaks } = flipDisplayBreaks(flip, convertedBreaks("x"), convertedBreaks("y"));
  const { freeH, freeV } = flipDisplayFreeFlags(flip, freeX, freeY);
  const displayScales = makeDisplayScalesFn(flip, panelScales);
  const displayTemporal = makeDisplayTemporalFn(input);
  const displayBand = makeDisplayBandFn(flip, xScale, yScale, scalesConfig);

  return {
    hTitle,
    vTitle,
    formatX,
    formatY,
    formatH,
    formatV,
    hBreaks,
    vBreaks,
    freeH,
    freeV,
    displayScales,
    displayTemporal,
    displayBand,
  };
}

function resolvePanelLayoutLegends(input: {
  legendInputs: readonly LegendInput[];
  legendOrder: LegendOrder;
  theme: ThemeTokens;
  layoutAxisTextSize: number;
  options: Pick<RunOptions, "width" | "height" | "measureText">;
}): {
  measurer: TextMeasurer;
  layoutTheme: LayoutTheme;
  legendBlock: ReturnType<typeof buildLegends>;
} {
  const { theme, options } = input;
  const measurer = options.measureText ?? new MetricsTableMeasurer(FONT_METRICS);
  const layoutTheme = {
    ...DEFAULT_LAYOUT_THEME,
    fontSize: input.layoutAxisTextSize,
    tickLength: theme.ticksX || theme.ticksY ? theme.tickLength : 0,
    tickLabelGap: theme.ticksX || theme.ticksY ? 3 : 5,
  };
  const legendInputs = input.legendInputs.map((legend) => ({
    ...legend,
    appearance: {
      type:
        legend.appearance?.type ??
        (legend.kind === "ramp" ? "colorbar" : legend.kind === "steps" ? "colorsteps" : "legend"),
      title: legend.appearance?.title ?? legend.title,
      order: legend.appearance?.order ?? 0,
      position: legend.appearance?.position ?? "auto",
      direction: legend.appearance?.direction ?? "auto",
      ...legend.appearance,
      ...(legend.kind === "discrete" && {
        keySize: legend.appearance?.keySize ?? theme.legendKeySize,
      }),
      theme: {
        titleSize: theme.guideTitleSize,
        labelSize: theme.axisTextSize,
        keyGap: theme.legendKeyGap,
        rowGap: theme.legendRowGap,
        blockGap: theme.guideBlockGap,
        colorbarThickness: theme.colorbarThickness,
        colorbarLength: theme.colorbarLengthMin,
        ...legend.appearance?.theme,
      },
    },
  })) as typeof input.legendInputs;
  try {
    const legendBlock = buildLegends(
      legendInputs,
      input.legendOrder,
      measurer,
      Math.max(48, options.width * 0.35),
      options.width,
      options.height,
    );
    return { measurer, layoutTheme, legendBlock };
  } catch (error) {
    if (error instanceof LegendLayoutError) {
      throw new PipelineError(
        "guide-layout-overflow",
        `/guides/${error.scale}`,
        `${error.message} ${error.recovery}`,
      );
    }
    throw error;
  }
}

export function resolvePanelLayoutChrome(input: PanelLayoutChromeInput): PanelLayoutChrome {
  const labsChrome = resolvePanelLayoutLabs({
    allFrames: input.allFrames,
    labs: input.labs,
    theme: input.theme,
    axisTitleSize: input.layoutAxisTitleSize,
    height: input.options.height,
  });
  const display = resolvePanelLayoutDisplay({
    flip: input.flip,
    freeX: input.freeX,
    freeY: input.freeY,
    panelScales: input.panelScales,
    scalesConfig: input.scalesConfig,
    xScale: input.xScale,
    yScale: input.yScale,
    xTemporalKind: input.xTemporalKind,
    yTemporalKind: input.yTemporalKind,
    xTemporalPrecision: input.xTemporalPrecision,
    yTemporalPrecision: input.yTemporalPrecision,
    xTitle: labsChrome.xTitle,
    yTitle: labsChrome.yTitle,
    warnings: input.warnings,
  });
  const legends = resolvePanelLayoutLegends({
    legendInputs: input.legendInputs,
    legendOrder: input.legendOrder,
    theme: input.theme,
    layoutAxisTextSize: input.layoutAxisTextSize,
    options: input.options,
  });

  return {
    flip: input.flip,
    scalesConfig: input.scalesConfig,
    ...labsChrome,
    ...display,
    ...legends,
  };
}
