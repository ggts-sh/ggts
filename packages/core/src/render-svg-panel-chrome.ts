/**
 * Panel chrome SVG for pure export: axes, grid, facet strips, axis titles.
 * Used only by sceneToSVGString (render-svg-scene.ts).
 */
import type { Scene, ScenePanel } from "./scene.js";
import { STRIP_BAND } from "./scene.js";
import type { ThemeTokens } from "./theme.js";
import { themeVar } from "./theme.js";
import { escapeXML, px } from "./render-svg-format.js";

/** End-anchored rotated band label; multi-line via tspan dy (wrap-then−45°, #637). */
function rotatedBandLabelSvg(
  tick: { label: string; lines?: string[]; angle: number },
  yOff: number,
  labelSize: number,
  font: string,
): string {
  const transform = `transform="translate(0,${px(yOff)}) rotate(${tick.angle})"`;
  const attrs = `${transform} text-anchor="end" dominant-baseline="central" ${font}`;
  if (tick.lines !== undefined && tick.lines.length > 1) {
    const lineH = labelSize * 1.15;
    const tspans = tick.lines
      .map((line, i) => `<tspan x="0" dy="${i === 0 ? "0" : px(lineH)}">${escapeXML(line)}</tspan>`)
      .join("");
    return `<text ${attrs}>${tspans}</text>`;
  }
  return `<text ${attrs}>${escapeXML(tick.label)}</text>`;
}

export function renderPanelAxes(panel: ScenePanel, theme: ThemeTokens): string {
  const parts: string[] = [];
  if (panel.axisX !== null) parts.push(renderXAxis(panel, theme));
  if (panel.axisY !== null) parts.push(renderYAxis(panel, theme));
  return parts.join("");
}

function renderXAxis(panel: ScenePanel, theme: ThemeTokens): string {
  const axisText = themeVar("axisText", theme);
  const axisLine = themeVar("axisLine", theme);
  const tickColor = themeVar("tickColor", theme);
  const parts = [
    `<g class="gg-axis gg-axis-x" transform="translate(${px(panel.x)},${px(panel.y + panel.height)})">`,
  ];
  if (theme.axisLineX) {
    parts.push(
      `<line class="gg-axis-line" x1="0" y1="0" x2="${px(panel.width)}" y2="0" stroke="${axisLine}" stroke-width="${px(theme.axisLineWidth)}" vector-effect="non-scaling-stroke"/>`,
    );
  }
  for (const tick of panel.axisX!) parts.push(renderXAxisTick(tick, theme, axisText, tickColor));
  parts.push("</g>");
  return parts.join("");
}

function renderXAxisTick(
  tick: NonNullable<ScenePanel["axisX"]>[number],
  theme: ThemeTokens,
  axisText: string,
  tickColor: string,
): string {
  const minor = tick.kind === "minor";
  const parts = [
    `<g class="gg-tick${minor ? " gg-tick-minor" : ""}" transform="translate(${px(tick.pos)},0)">`,
  ];
  if (!minor) parts.push(`<title>${escapeXML(tick.fullLabel ?? tick.label)}</title>`);
  if (theme.ticksX && tick.showTick !== false) {
    parts.push(
      `<line y2="${px(minor ? theme.tickLength / 2 : theme.tickLength)}" stroke="${tickColor}" stroke-width="${px(theme.tickWidth)}"${minor ? ' opacity="0.5"' : ""} vector-effect="non-scaling-stroke"/>`,
    );
  }
  if (tick.label !== "" && tick.showLabel !== false) {
    const yOff = (theme.ticksX && tick.showTick !== false ? theme.tickLength : 0) + 3;
    const labelSize = tick.labelSize ?? theme.axisTextSize;
    const font = `fill="${axisText}" font-size="${px(labelSize)}" font-weight="${theme.fontWeight}"`;
    parts.push(renderXAxisLabel(tick, yOff, labelSize, font));
  }
  parts.push("</g>");
  return parts.join("");
}

function renderXAxisLabel(
  tick: NonNullable<ScenePanel["axisX"]>[number],
  yOff: number,
  labelSize: number,
  font: string,
): string {
  if (tick.angle !== undefined && tick.angle !== 0) {
    return rotatedBandLabelSvg({ ...tick, angle: tick.angle }, yOff, labelSize, font);
  }
  if (tick.lines !== undefined && tick.lines.length > 1) {
    const lineH = labelSize * 1.15;
    const tspans = tick.lines
      .map(
        (line, i) =>
          `<tspan x="0" dy="${i === 0 ? "0.71em" : px(lineH)}">${escapeXML(line)}</tspan>`,
      )
      .join("");
    return `<text y="${px(yOff)}" text-anchor="middle" ${font}>${tspans}</text>`;
  }
  return `<text y="${px(yOff)}" dy="0.71em" text-anchor="middle" ${font}>${escapeXML(tick.label)}</text>`;
}

function renderYAxis(panel: ScenePanel, theme: ThemeTokens): string {
  const axisText = themeVar("axisText", theme);
  const axisLine = themeVar("axisLine", theme);
  const tickColor = themeVar("tickColor", theme);
  const parts = [
    `<g class="gg-axis gg-axis-y" transform="translate(${px(panel.x)},${px(panel.y)})">`,
  ];
  if (theme.axisLineY) {
    parts.push(
      `<line class="gg-axis-line" x1="0" y1="0" x2="0" y2="${px(panel.height)}" stroke="${axisLine}" stroke-width="${px(theme.axisLineWidth)}" vector-effect="non-scaling-stroke"/>`,
    );
  }
  for (const tick of panel.axisY!) parts.push(renderYAxisTick(tick, theme, axisText, tickColor));
  parts.push("</g>");
  return parts.join("");
}

function renderYAxisTick(
  tick: NonNullable<ScenePanel["axisY"]>[number],
  theme: ThemeTokens,
  axisText: string,
  tickColor: string,
): string {
  const minor = tick.kind === "minor";
  const parts = [
    `<g class="gg-tick${minor ? " gg-tick-minor" : ""}" transform="translate(0,${px(tick.pos)})">`,
  ];
  if (!minor) parts.push(`<title>${escapeXML(tick.fullLabel ?? tick.label)}</title>`);
  if (theme.ticksY && tick.showTick !== false) {
    parts.push(
      `<line x2="-${px(minor ? theme.tickLength / 2 : theme.tickLength)}" stroke="${tickColor}" stroke-width="${px(theme.tickWidth)}"${minor ? ' opacity="0.5"' : ""} vector-effect="non-scaling-stroke"/>`,
    );
  }
  if (tick.label !== "" && tick.showLabel !== false) {
    parts.push(
      `<text x="-${px((theme.ticksY && tick.showTick !== false ? theme.tickLength : 0) + 3)}" dy="0.32em" text-anchor="end" fill="${axisText}" font-size="${px(tick.labelSize ?? theme.axisTextSize)}" font-weight="${theme.fontWeight}">${escapeXML(tick.label)}</text>`,
    );
  }
  parts.push("</g>");
  return parts.join("");
}

/** Facet strip: band + centered label on the authored side of the panel. */
export function renderStrip(
  panel: ScenePanel,
  scene: Scene,
  panelIndex: number,
  scope = "",
): string {
  if (panel.strip === "" || panel.showStrip === false) return "";
  const band = panel.stripBand ?? STRIP_BAND;
  if (band <= 0) return "";
  const position = panel.stripPosition ?? "top";
  const ink = themeVar("ink", scene.theme);
  const stripFill = themeVar("grid", scene.theme);
  const bandDraw = Math.max(1, band - 2);
  let originX = panel.x;
  let originY = panel.y;
  let rectW = panel.width;
  let rectH = bandDraw;
  let textX = panel.width / 2;
  let textY = bandDraw / 2;
  let textTransform = "";
  let sideClip = false;

  // Layout reserves strip outside the axis margin band (see
  // panel-layout-facet-geometry). Renderers place chrome in that reserved
  // region so strip text does not collide with tick labels.
  if (position === "top") {
    originY = panel.y - band;
  } else if (position === "bottom") {
    // Below the panel content box; axis ticks/labels sit in the bottom margin
    // immediately under the panel, then the strip band follows.
    const axisBand = panel.axisX === null ? 0 : 28;
    originY = panel.y + panel.height + axisBand;
  } else if (position === "left") {
    // Left of the y-axis margin so strip sits outside tick labels.
    const axisBand = panel.axisY === null ? 0 : 36;
    originX = panel.x - axisBand - band;
    rectW = bandDraw;
    rectH = panel.height;
    textX = bandDraw / 2;
    textY = panel.height / 2;
    textTransform = ` transform="rotate(-90 ${px(textX)} ${px(textY)})"`;
    // Rotated advance is vertical — clip to the panel-height band so a long
    // label cannot paint into the row above/below (#611).
    sideClip = true;
  } else {
    originX = panel.x + panel.width;
    rectW = bandDraw;
    rectH = panel.height;
    textX = bandDraw / 2;
    textY = panel.height / 2;
    textTransform = ` transform="rotate(90 ${px(textX)} ${px(textY)})"`;
    sideClip = true;
  }

  const clipId = `${scope}gg-strip-clip-${panelIndex}`;
  const clipAttr = sideClip ? ` clip-path="url(#${clipId})"` : "";
  const clipDef = sideClip
    ? `<clipPath id="${clipId}"><rect width="${px(rectW)}" height="${px(rectH)}"/></clipPath>`
    : "";

  return (
    `<g class="gg-strip" transform="translate(${px(originX)},${px(originY)})"${clipAttr}>` +
    clipDef +
    `<rect width="${px(rectW)}" height="${px(rectH)}" fill="${stripFill}"/>` +
    `<text x="${px(textX)}" y="${px(textY)}" dy="0.32em" text-anchor="middle" fill="${ink}" font-size="${px(scene.theme.stripSize)}" font-weight="${scene.theme.stripWeight}"${textTransform}>${escapeXML(panel.strip)}</text>` +
    "</g>"
  );
}

/** Plot-level axis titles, positioned against the panel grid's extents. */
export function renderAxisTitles(scene: Scene): string {
  const ink = themeVar("ink", scene.theme);
  const panels = scene.panels;
  if (panels.length === 0) return "";
  const gridLeft = Math.min(...panels.map((p) => p.x));
  const gridRight = Math.max(...panels.map((p) => p.x + p.width));
  const gridTop = Math.min(...panels.map((p) => p.y));
  const gridBottom = Math.max(...panels.map((p) => p.y + p.height));
  const parts: string[] = [];
  if (scene.axes.x.title !== "") {
    parts.push(
      `<text class="gg-axis-title" x="${px((gridLeft + gridRight) / 2)}" y="${px(gridBottom + (scene.axes.x.titleOffset ?? 32))}" text-anchor="middle" fill="${ink}" font-size="${px(scene.axes.x.titleSize ?? scene.theme.axisTitleSize)}" font-weight="${scene.theme.axisTitleWeight}">${escapeXML(scene.axes.x.title)}</text>`,
    );
  }
  if (scene.axes.y.title !== "") {
    // Mirror x-axis title placement: offset left of the panel grid past the
    // y tick-label band (default 32; scene may raise titleOffset for wide labels).
    // Hardcoding SVG x=12 left the title behind when the left margin grew (#1570).
    // Floor at half the title size: rotate(-90) + text-anchor middle extends the
    // glyph toward negative x, so a 0 clamp clips it off-canvas when the left
    // margin is only the axis-title reserve (labels hidden).
    const yTitleSize = scene.axes.y.titleSize ?? scene.theme.axisTitleSize;
    const yTitleX = Math.max(yTitleSize / 2, gridLeft - (scene.axes.y.titleOffset ?? 32));
    parts.push(
      `<text class="gg-axis-title" transform="translate(${px(yTitleX)},${px((gridTop + gridBottom) / 2)}) rotate(-90)" text-anchor="middle" fill="${ink}" font-size="${px(yTitleSize)}" font-weight="${scene.theme.axisTitleWeight}">${escapeXML(scene.axes.y.title)}</text>`,
    );
  }
  return parts.join("");
}

export function renderGrid(panel: ScenePanel, theme: ThemeTokens): string {
  const dash = theme.gridDasharray === "" ? "" : ` stroke-dasharray="${theme.gridDasharray}"`;
  const parts: string[] = [];
  const hasMinorX = theme.gridX && (panel.grid.minorX?.length ?? 0) > 0;
  const hasMinorY = theme.gridY && (panel.grid.minorY?.length ?? 0) > 0;
  if (hasMinorX || hasMinorY) {
    parts.push(
      `<g class="gg-grid gg-grid-minor" stroke="${themeVar("grid", theme)}" stroke-width="${px(theme.gridWidth)}"${dash} opacity="0.5" vector-effect="non-scaling-stroke">`,
    );
    if (hasMinorX)
      for (const gx of panel.grid.minorX ?? []) {
        parts.push(`<line x1="${px(gx)}" y1="0" x2="${px(gx)}" y2="${px(panel.height)}"/>`);
      }
    if (hasMinorY)
      for (const gy of panel.grid.minorY ?? []) {
        parts.push(`<line x1="0" y1="${px(gy)}" x2="${px(panel.width)}" y2="${px(gy)}"/>`);
      }
    parts.push("</g>");
  }
  parts.push(
    `<g class="gg-grid" stroke="${themeVar("grid", theme)}" stroke-width="${px(theme.gridWidth)}"${dash} vector-effect="non-scaling-stroke">`,
  );
  if (theme.gridX)
    for (const gx of panel.grid.x) {
      parts.push(`<line x1="${px(gx)}" y1="0" x2="${px(gx)}" y2="${px(panel.height)}"/>`);
    }
  if (theme.gridY)
    for (const gy of panel.grid.y) {
      parts.push(`<line x1="0" y1="${px(gy)}" x2="${px(panel.width)}" y2="${px(gy)}"/>`);
    }
  parts.push("</g>");
  return parts.join("");
}
