import type { AxisGuidePlan } from "./guide-plan-types.js";
import { BAND_THIN_MIN_CATEGORIES, MIN_BAND_LABEL_GAP_PX } from "./band-label-layout.js";
import { deriveTicks, type AxisTicks, type DeriveTicksContext } from "./layout-derive-ticks.js";
import type { TextMeasurer } from "./measure.js";
import { truncateToFit } from "./truncate.js";
import type { LayoutInput, LayoutTheme, Margins, PassResult } from "./layout-types.js";
import type {
  LayoutCaps as Caps,
  LayoutPassWork as LayoutWork,
  LayoutVisibility as Visibility,
} from "./layout-pass-types.js";

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

function quantizeUp(px: number, quantum: number): number {
  if (quantum <= 0) return px;
  return Math.ceil(px / quantum - 1e-9) * quantum;
}

function resolveVisibility(input: LayoutInput): Visibility {
  const xPresentation = input.axis?.x;
  const yPresentation = input.axis?.y;
  const xVisible = xPresentation?.visible !== false;
  const yVisible = yPresentation?.visible !== false;
  const xLabelsVisible = xVisible && xPresentation?.showLabels !== false;
  const yLabelsVisible = yVisible && yPresentation?.showLabels !== false;
  return {
    xVisible,
    yVisible,
    xLabelsVisible,
    yLabelsVisible,
    xTicksVisible: xVisible && xPresentation?.showTicks !== false,
    yTicksVisible: yVisible && yPresentation?.showTicks !== false,
    xPreserve: xLabelsVisible && xPresentation?.collision === "preserve",
    yPreserve: yLabelsVisible && yPresentation?.collision === "preserve",
    yBandCollision: yLabelsVisible ? yPresentation?.collision : undefined,
  };
}

function resolveCaps(input: LayoutInput, theme: LayoutTheme): Caps {
  const capify = (cap: number) =>
    theme.quantum > 0 ? Math.floor(cap / theme.quantum) * theme.quantum : cap;
  return {
    left: capify(theme.maxMarginFraction * input.width),
    right: capify(theme.maxMarginFraction * input.width),
    top: capify(theme.maxMarginFraction * input.height),
    bottom: capify(theme.maxMarginFraction * input.height),
  };
}

function maxLabeledWidth(axis: AxisTicks, measurer: TextMeasurer, fontSize: number): number {
  let max = 0;
  for (const tick of axis.ticks) {
    if (!tick.labeled) continue;
    const width = measurer.measureWidth(tick.label, fontSize);
    if (width > max) max = width;
  }
  return max;
}

function applyBandLabelEvery(axis: AxisTicks, every: number): void {
  for (let index = 0; index < axis.ticks.length; index++) {
    axis.ticks[index]!.labeled = index % every === 0;
  }
}

function thinBandForWidth(
  axis: AxisTicks,
  every: number,
  currentWidth: number,
  measurer: TextMeasurer,
  fontSize: number,
): { every: number; width: number; improved: boolean } {
  if (every * 2 >= axis.ticks.length) {
    return { every, width: currentWidth, improved: false };
  }
  let probe = every * 2;
  for (;;) {
    applyBandLabelEvery(axis, probe);
    const nextWidth = maxLabeledWidth(axis, measurer, fontSize);
    if (nextWidth < currentWidth) {
      return { every: probe, width: nextWidth, improved: true };
    }
    if (probe * 2 >= axis.ticks.length) break;
    probe *= 2;
  }
  applyBandLabelEvery(axis, every);
  return { every, width: currentWidth, improved: false };
}

function presentForLayout(axis: AxisTicks, preserve: boolean): AxisTicks {
  if (!preserve) return axis;
  return {
    ...axis,
    ticks: axis.ticks.map((tick) => {
      const { angle: _angle, lines: _lines, ...rest } = tick;
      return { ...rest, label: tick.fullLabel ?? tick.label, labeled: true };
    }),
  };
}

function hideLabelPresentation(plan: AxisGuidePlan): AxisGuidePlan {
  const {
    bandLabelMode: _mode,
    bandLabelAngle: _angle,
    bandLabelBandHeight: _height,
    bandLabelAuthorPinned: _pinned,
    ...semantic
  } = plan;
  return Object.freeze({
    ...semantic,
    overlap: false,
    marginOverflow: false,
    degraded: Object.freeze([]),
  });
}

const yOrthogonalChromePx = (theme: LayoutTheme, visibility: Visibility): number =>
  visibility.yTicksVisible
    ? theme.tickLength + (visibility.yLabelsVisible ? theme.tickLabelGap : 0)
    : 0;
const axisHasTruncatedTick = (axis: AxisTicks): boolean =>
  axis.ticks.some(
    (tick) => tick.labeled && tick.fullLabel !== undefined && tick.label !== tick.fullLabel,
  );

function deriveInitialAxes(
  input: LayoutInput,
  theme: LayoutTheme,
  innerW: number,
  innerH: number,
  visibility: Visibility,
  caps: Caps,
  degradations: string[],
): { x: LayoutWork["x"]; y: LayoutWork["y"] } {
  const xCount = clamp(Math.round(innerW / theme.targetPxPerTickX), 2, theme.maxTicks);
  const yCount = clamp(Math.round(innerH / theme.targetPxPerTickY), 2, theme.maxTicks);
  const xContext: DeriveTicksContext = {
    orient: "horizontal",
    extentPx: innerW,
    measurer: input.measurer,
    fontSize: theme.fontSize,
    marginCapPx: caps.right,
    orthogonalMarginCapPx: caps.bottom,
    orthogonalChromePx: theme.tickLength + theme.tickLabelGap,
    quantum: theme.quantum,
    ellipsis: theme.ellipsis,
    ...(input.axis?.x?.collision === "ellipsis" && { bandCollision: "ellipsis" as const }),
    ...(visibility.xPreserve && { bandCollision: "preserve" as const }),
    ...(input.previousGuidePlans?.x !== undefined && {
      previousGuidePlan: input.previousGuidePlans.x,
    }),
  };
  const yContext: DeriveTicksContext = {
    orient: "vertical",
    extentPx: innerH,
    measurer: input.measurer,
    fontSize: theme.fontSize,
    marginCapPx: caps.left,
    orthogonalMarginCapPx: caps.top,
    orthogonalChromePx: yOrthogonalChromePx(theme, visibility),
    quantum: theme.quantum,
    ellipsis: theme.ellipsis,
    ...(visibility.yBandCollision !== undefined && { bandCollision: visibility.yBandCollision }),
    ...(input.previousGuidePlans?.y !== undefined && {
      previousGuidePlan: input.previousGuidePlans.y,
    }),
  };
  const xAxis = presentForLayout(
    deriveTicks(input.x, xCount, input.formatX, 1, xContext),
    visibility.xPreserve,
  );
  const yAxis = presentForLayout(
    deriveTicks(input.y, yCount, input.formatY, 1, yContext),
    visibility.yPreserve,
  );
  if (xAxis.empty) degradations.push("x:empty-domain");
  if (yAxis.empty) degradations.push("y:empty-domain");
  if (visibility.xLabelsVisible && !visibility.xPreserve && xAxis.guidePlan !== undefined) {
    degradations.push(...xAxis.guidePlan.degraded);
  }
  if (visibility.yLabelsVisible && !visibility.yPreserve && yAxis.guidePlan !== undefined) {
    degradations.push(...yAxis.guidePlan.degraded);
  }
  return {
    x: {
      axis: xAxis,
      count: xCount,
      every: xAxis.bandLabelEvery ?? 1,
      context: xContext,
      truncated: false,
    },
    y: {
      axis: yAxis,
      count: yCount,
      every: yAxis.bandLabelEvery ?? 1,
      context: yContext,
      truncated: axisHasTruncatedTick(yAxis),
    },
  };
}

function createLayoutWork(margins: Margins, input: LayoutInput, theme: LayoutTheme): LayoutWork {
  const innerW = Math.max(1, input.width - margins.left - margins.right);
  const innerH = Math.max(1, input.height - margins.top - margins.bottom);
  const visibility = resolveVisibility(input);
  const caps = resolveCaps(input, theme);
  const degradations: string[] = [];
  const axes = deriveInitialAxes(input, theme, innerW, innerH, visibility, caps, degradations);
  const labelH = input.measurer.measureHeight(theme.fontSize);
  const leftFixed =
    (visibility.yTicksVisible ? theme.tickLength : 0) +
    (visibility.yTicksVisible && visibility.yLabelsVisible ? theme.tickLabelGap : 0);
  const bottomFixed =
    (visibility.xTicksVisible ? theme.tickLength : 0) +
    (visibility.xTicksVisible && visibility.xLabelsVisible ? theme.tickLabelGap : 0);
  return {
    input,
    theme,
    measurer: input.measurer,
    innerW,
    innerH,
    visibility,
    caps,
    degradations,
    x: axes.x,
    y: axes.y,
    labelH,
    leftFixed,
    bottomFixed,
    yLabelW: visibility.yLabelsVisible
      ? maxLabeledWidth(axes.y.axis, input.measurer, theme.fontSize)
      : 0,
    firstXLabelW: 0,
    lastXLabelW: 0,
  };
}

function fitYWidth(work: LayoutWork): void {
  const { input, theme, visibility, caps, measurer } = work;
  if (
    !visibility.yLabelsVisible ||
    visibility.yPreserve ||
    work.y.axis.empty ||
    work.y.axis.guidePlan !== undefined ||
    work.yLabelW + work.leftFixed <= caps.left
  ) {
    return;
  }
  while (work.yLabelW + work.leftFixed > caps.left) {
    if (input.y.type === "band") {
      const thinned = thinBandForWidth(
        work.y.axis,
        work.y.every,
        work.yLabelW,
        measurer,
        theme.fontSize,
      );
      if (!thinned.improved) break;
      work.y.every = thinned.every;
      work.yLabelW = thinned.width;
    } else {
      if (work.y.count <= 2) break;
      work.y.count = Math.max(2, Math.floor(work.y.count / 2));
      work.y.axis = presentForLayout(
        deriveTicks(input.y, work.y.count, input.formatY, work.y.every, work.y.context),
        visibility.yPreserve,
      );
      work.yLabelW = maxLabeledWidth(work.y.axis, measurer, theme.fontSize);
    }
    work.degradations.push("y:thin");
  }
  if (work.yLabelW + work.leftFixed <= caps.left) return;
  const available = Math.max(1, caps.left - work.leftFixed);
  for (const tick of work.y.axis.ticks) {
    const truncated = truncateToFit(
      tick.label,
      available,
      measurer,
      theme.fontSize,
      theme.ellipsis,
    );
    if (truncated === tick.label) continue;
    tick.label = truncated;
    work.y.truncated = true;
  }
  work.degradations.push("y:truncate");
  work.yLabelW = maxLabeledWidth(work.y.axis, measurer, theme.fontSize);
}

function minimumBandIndexGap(axis: AxisTicks): number {
  if (axis.ticks.length < 2 || !axis.ticks.every((tick) => tick.domainIndex !== undefined))
    return 1;
  const indices = axis.ticks.map((tick) => tick.domainIndex!).toSorted((a, b) => a - b);
  let minimum = Infinity;
  for (let index = 1; index < indices.length; index++) {
    const gap = indices[index]! - indices[index - 1]!;
    if (gap > 0 && gap < minimum) minimum = gap;
  }
  return Number.isFinite(minimum) && minimum >= 1 ? minimum : 1;
}

function fitYDensity(work: LayoutWork): void {
  const { input, visibility } = work;
  if (
    !visibility.yLabelsVisible ||
    visibility.yPreserve ||
    work.y.axis.empty ||
    input.y.type !== "band" ||
    work.y.axis.guidePlan !== undefined
  ) {
    return;
  }
  const count = work.y.axis.ticks.length;
  const bandUnit = work.innerH / Math.max(1, input.y.categories.length);
  const displayStep = bandUnit * minimumBandIndexGap(work.y.axis);
  const minimumStep = work.labelH + MIN_BAND_LABEL_GAP_PX;
  if (work.y.every * displayStep >= minimumStep) return;
  work.degradations.push("band-label-overlap");
  if (count < BAND_THIN_MIN_CATEGORIES) return;
  let thinned = false;
  while (work.y.every * displayStep < minimumStep) {
    if (work.y.every * 2 >= count) break;
    work.y.every *= 2;
    applyBandLabelEvery(work.y.axis, work.y.every);
    work.degradations.push("y:thin");
    thinned = true;
  }
  if (thinned) {
    work.yLabelW = maxLabeledWidth(work.y.axis, work.measurer, work.theme.fontSize);
  }
}

function computeXEndWidths(work: LayoutWork): void {
  if (!work.visibility.xLabelsVisible) {
    work.firstXLabelW = 0;
    work.lastXLabelW = 0;
    return;
  }
  const labeled = work.x.axis.ticks.filter((tick) => tick.labeled);
  work.firstXLabelW =
    labeled.length === 0
      ? 0
      : work.measurer.measureWidth(labeled[0]!.label, work.theme.fontSize) / 2;
  work.lastXLabelW =
    labeled.length === 0
      ? 0
      : work.measurer.measureWidth(labeled.at(-1)!.label, work.theme.fontSize) / 2;
}

function thinXAxis(work: LayoutWork): boolean {
  if (work.input.x.type === "band") {
    if (work.x.every * 2 >= work.x.axis.ticks.length) return false;
    work.x.every *= 2;
    applyBandLabelEvery(work.x.axis, work.x.every);
    return true;
  }
  if (work.x.count <= 2) return false;
  work.x.count = Math.max(2, Math.floor(work.x.count / 2));
  work.x.axis = presentForLayout(
    deriveTicks(work.input.x, work.x.count, work.input.formatX, work.x.every, work.x.context),
    work.visibility.xPreserve,
  );
  return true;
}

function fitXEndLabels(work: LayoutWork): void {
  computeXEndWidths(work);
  if (
    !work.visibility.xLabelsVisible ||
    work.visibility.xPreserve ||
    work.x.axis.empty ||
    work.x.axis.guidePlan !== undefined ||
    work.lastXLabelW <= work.caps.right
  ) {
    return;
  }
  while (work.lastXLabelW > work.caps.right && thinXAxis(work)) {
    work.degradations.push("x:thin");
    computeXEndWidths(work);
  }
  if (work.lastXLabelW <= work.caps.right) return;
  const available = Math.max(1, work.caps.right * 2);
  for (const tick of work.x.axis.ticks) {
    const truncated = truncateToFit(
      tick.label,
      available,
      work.measurer,
      work.theme.fontSize,
      work.theme.ellipsis,
    );
    if (truncated === tick.label) continue;
    tick.label = truncated;
    work.x.truncated = true;
  }
  work.degradations.push("x:truncate");
  computeXEndWidths(work);
}

function rawMargins(work: LayoutWork): Margins {
  const { theme, visibility } = work;
  const bandPlanned =
    visibility.xLabelsVisible &&
    !visibility.xPreserve &&
    work.x.axis.bandLabelBandHeight !== undefined;
  const bandLeft = bandPlanned
    ? (work.x.axis.bandLeftOverhang ?? 0)
    : visibility.xPreserve
      ? work.firstXLabelW
      : 0;
  return {
    left:
      work.y.axis.empty || !visibility.yVisible
        ? Math.max(theme.minMargins.left, bandLeft)
        : Math.max(theme.minMargins.left, work.yLabelW + work.leftFixed, bandLeft),
    bottom:
      work.x.axis.empty || !visibility.xVisible
        ? theme.minMargins.bottom
        : Math.max(
            theme.minMargins.bottom,
            (visibility.xLabelsVisible ? (work.x.axis.bandLabelBandHeight ?? work.labelH) : 0) +
              work.bottomFixed,
          ),
    right:
      work.x.axis.empty || !visibility.xLabelsVisible
        ? theme.minMargins.right
        : bandPlanned
          ? Math.max(theme.minMargins.right, work.x.axis.bandAlongOverhang ?? 0)
          : Math.max(theme.minMargins.right, work.lastXLabelW),
    top:
      work.y.axis.empty || !visibility.yLabelsVisible
        ? theme.minMargins.top
        : Math.max(theme.minMargins.top, work.labelH / 2),
  };
}

function assembleMargins(work: LayoutWork): Margins {
  const raw = rawMargins(work);
  const reserve = {
    top: work.input.reserve?.top ?? 0,
    right: work.input.reserve?.right ?? 0,
    bottom: work.input.reserve?.bottom ?? 0,
    left: work.input.reserve?.left ?? 0,
  };
  const preserveLeft = work.visibility.xPreserve || work.visibility.yPreserve;
  return {
    left: quantizeUp(
      (preserveLeft ? raw.left : Math.min(raw.left, work.caps.left)) + reserve.left,
      work.theme.quantum,
    ),
    right: quantizeUp(
      (work.visibility.xPreserve ? raw.right : Math.min(raw.right, work.caps.right)) +
        reserve.right,
      work.theme.quantum,
    ),
    bottom: quantizeUp(Math.min(raw.bottom, work.caps.bottom) + reserve.bottom, work.theme.quantum),
    top: quantizeUp(Math.min(raw.top, work.caps.top) + reserve.top, work.theme.quantum),
  };
}

function visibleGuidePlan(
  plan: AxisGuidePlan | undefined,
  labelsVisible: boolean,
): AxisGuidePlan | undefined {
  if (plan === undefined) return undefined;
  return labelsVisible ? plan : hideLabelPresentation(plan);
}

function finishLayoutPass(work: LayoutWork): PassResult {
  const xGuidePlan = visibleGuidePlan(work.x.axis.guidePlan, work.visibility.xLabelsVisible);
  const yGuidePlan = visibleGuidePlan(work.y.axis.guidePlan, work.visibility.yLabelsVisible);
  return {
    margins: assembleMargins(work),
    x: {
      ticks: work.x.axis.ticks,
      labelEvery: work.x.every,
      truncated: work.x.truncated,
      ...(xGuidePlan !== undefined && { guidePlan: xGuidePlan }),
    },
    y: {
      ticks: work.y.axis.ticks,
      labelEvery: work.y.every,
      truncated: work.y.truncated,
      ...(yGuidePlan !== undefined && { guidePlan: yGuidePlan }),
    },
    degradations: [...new Set(work.degradations)],
  };
}

export function runLayoutPass(
  margins: Margins,
  input: LayoutInput,
  theme: LayoutTheme,
): PassResult {
  const work = createLayoutWork(margins, input, theme);
  fitYWidth(work);
  fitYDensity(work);
  fitXEndLabels(work);
  return finishLayoutPass(work);
}
