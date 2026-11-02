/**
 * Legend SVG for pure export: discrete keys/labels, steps, continuous ramp.
 * Used only by sceneToSVGString (render-svg-scene.ts).
 */
import type { SceneLegend, SceneLegendEntry } from "./scene.js";
import { LEGEND_ROW_HEIGHT } from "./legend.js";
import type { ThemeTokens } from "./theme.js";
import { themeVar } from "./theme.js";
import { linetypeDash } from "./mark-style.js";
import { escapeXML, px } from "./render-svg-format.js";
import { pointShape } from "./render-svg-marks.js";

function renderDiscreteLegendKey(
  entry: SceneLegendEntry,
  x: number,
  y: number,
  size: number,
  ink: string,
): string {
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const opacity =
    entry.alpha === undefined || entry.alpha === 1 ? "" : ` opacity="${px(entry.alpha)}"`;
  const styleKey =
    entry.shape !== undefined ||
    entry.size !== undefined ||
    entry.linetype !== undefined ||
    entry.linewidth !== undefined;
  const keyColor =
    styleKey && entry.color === "#999999" && entry.hasPaint !== true ? ink : entry.color;
  if (entry.shape !== undefined || entry.size !== undefined) {
    const shape = entry.shape ?? "circle";
    const radius = Math.min(size / 2, entry.size ?? size / 2);
    return `<g class="gg-legend-key"${opacity}>${pointShape(shape, centerX, centerY, radius, keyColor)}</g>`;
  }
  if (entry.linetype !== undefined || entry.linewidth !== undefined) {
    const linetype = entry.linetype ?? "solid";
    const dash = linetypeDash(linetype);
    const dashAttr = dash.length === 0 ? "" : ` stroke-dasharray="${dash.join(" ")}"`;
    return `<line class="gg-legend-key" x1="${px(x)}" y1="${px(centerY)}" x2="${px(x + size)}" y2="${px(centerY)}" stroke="${keyColor}" stroke-width="${px(entry.linewidth ?? 1.5)}"${dashAttr}${opacity}/>`;
  }
  return `<rect class="gg-legend-swatch" x="${px(x)}" y="${px(y)}" width="${px(size)}" height="${px(size)}" fill="${entry.color}"${opacity}/>`;
}

function renderDiscreteLegendLabel(
  entry: SceneLegendEntry,
  x: number,
  rowHeight: number,
  labelSize: number,
  ink: string,
): string {
  const lines = entry.lines;
  if (lines === undefined || lines.length <= 1) {
    return `<text class="gg-legend-label" x="${px(x)}" y="${px(entry.y + rowHeight / 2)}" dy="0.32em" font-size="${px(labelSize)}" fill="${ink}">${escapeXML(entry.label)}${entry.fullLabel !== undefined && entry.fullLabel !== entry.label ? `<title>${escapeXML(entry.fullLabel)}</title>` : ""}</text>`;
  }
  const lineHeight = entry.lineHeight ?? labelSize * 1.2;
  const firstY = entry.y + (rowHeight - lines.length * lineHeight) / 2 + lineHeight / 2;
  const tspans = lines
    .map(
      (line, index) =>
        `<tspan x="${px(x)}"${index === 0 ? "" : ` dy="${px(lineHeight)}"`}>${escapeXML(line)}</tspan>`,
    )
    .join("");
  return `<text class="gg-legend-label" x="${px(x)}" y="${px(firstY)}" dy="0.32em" font-size="${px(labelSize)}" fill="${ink}">${tspans}</text>`;
}

export function renderLegend(legend: SceneLegend, theme: ThemeTokens, gradientId: string): string {
  const ink = themeVar("ink", theme);
  const horizontal = legend.direction === "horizontal";
  const titleSize = legend.titleSize ?? 11;
  const labelSize = legend.labelSize ?? 11;
  const parts: string[] = [
    `<g class="gg-legend gg-legend-${legend.scale} gg-legend-${legend.position ?? "right"} gg-legend-${legend.direction ?? "vertical"}" transform="translate(${px(legend.x)},${px(legend.y)})">`,
  ];
  const contentTop = legend.title === "" ? 0 : (legend.titleHeight ?? 18);
  const titleX = legend.type === "discrete" ? (legend.titleX ?? 4) : 4;
  const titleY =
    legend.type === "discrete"
      ? (legend.titleY ?? Math.max(11, contentTop - 7))
      : Math.max(11, contentTop - 7);
  if (legend.title !== "") {
    const displayTitle =
      legend.type === "discrete" ? (legend.titleLabel ?? legend.title) : legend.title;
    const fullTitle =
      displayTitle === legend.title ? "" : `<title>${escapeXML(legend.title)}</title>`;
    parts.push(
      `<text class="gg-legend-title" x="${px(titleX)}" y="${px(titleY)}" font-size="${px(titleSize)}" font-weight="bold" fill="${ink}">${escapeXML(displayTitle)}${fullTitle}</text>`,
    );
  }
  if (legend.type === "discrete") {
    parts.push(...renderDiscreteLegendEntries(legend, labelSize, ink));
  } else if (legend.type === "steps") {
    parts.push(...renderStepLegendEntries(legend, contentTop, horizontal, labelSize, ink));
  } else {
    parts.push(
      ...renderContinuousLegend(legend, contentTop, horizontal, labelSize, ink, gradientId),
    );
  }
  parts.push("</g>");
  return parts.join("");
}

function renderDiscreteLegendEntries(
  legend: Extract<SceneLegend, { type: "discrete" }>,
  labelSize: number,
  ink: string,
): string[] {
  const parts: string[] = [];
  for (const entry of legend.entries) {
    const baseX = (entry.x ?? 0) + 4;
    const rowHeight = entry.height ?? LEGEND_ROW_HEIGHT;
    const swatchY = entry.y + (rowHeight - legend.swatchSize) / 2;
    parts.push(
      renderDiscreteLegendKey(entry, baseX, swatchY, legend.swatchSize, ink),
      renderDiscreteLegendLabel(
        entry,
        baseX + legend.swatchSize + (legend.keyGap ?? 6),
        rowHeight,
        labelSize,
        ink,
      ),
    );
  }
  return parts;
}

function renderStepLegendEntries(
  legend: Extract<SceneLegend, { type: "steps" }>,
  contentTop: number,
  horizontal: boolean,
  labelSize: number,
  ink: string,
): string[] {
  const parts: string[] = [];
  for (const entry of legend.entries) {
    const entryX = 4 + (entry.x ?? 0);
    const entryY = contentTop + entry.y;
    parts.push(
      `<rect class="gg-legend-step" x="${px(entryX)}" y="${px(entryY)}" width="${px(legend.stepWidth)}" height="${px(legend.stepHeight)}" fill="${entry.color}"/>`,
      entry.label === ""
        ? ""
        : `<text class="gg-legend-label" x="${px(horizontal ? entryX + legend.stepWidth / 2 : entryX + legend.stepWidth + 6)}" y="${px(horizontal ? entryY + legend.stepHeight + 12 : entryY + legend.stepHeight / 2)}" text-anchor="${horizontal ? "middle" : "start"}" dy="0.32em" font-size="${px(labelSize)}" fill="${ink}">${escapeXML(entry.label)}${entry.fullLabel !== undefined && entry.fullLabel !== entry.label ? `<title>${escapeXML(entry.fullLabel)}</title>` : ""}</text>`,
    );
  }
  return parts;
}

function renderContinuousLegend(
  legend: Extract<SceneLegend, { type: "ramp" }>,
  contentTop: number,
  horizontal: boolean,
  labelSize: number,
  ink: string,
  gradientId: string,
): string[] {
  const rampX = horizontal ? (legend.rampX ?? 4) : 4;
  const stops = legend.stops
    .map(([offset, color]) => `<stop offset="${px(offset * 100)}%" stop-color="${color}"/>`)
    .join("");
  const parts = [
    `<defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="${horizontal ? "1" : "0"}" y2="${horizontal ? "0" : "1"}">${stops}</linearGradient></defs>`,
    `<rect class="gg-legend-ramp" x="${px(rampX)}" y="${px(contentTop)}" width="${px(legend.rampWidth)}" height="${px(legend.rampHeight)}" fill="url(#${gradientId})"/>`,
  ];
  for (const tick of legend.ticks) {
    const pos = tick.pos ?? tick.y ?? 0;
    if (legend.showTicks !== false) {
      parts.push(
        horizontal
          ? `<line class="gg-legend-tick" x1="${px(rampX + pos)}" y1="${px(contentTop + legend.rampHeight)}" x2="${px(rampX + pos)}" y2="${px(contentTop + legend.rampHeight + 4)}" stroke="${ink}"/>`
          : `<line class="gg-legend-tick" x1="${px(rampX + legend.rampWidth)}" y1="${px(contentTop + pos)}" x2="${px(rampX + legend.rampWidth + 4)}" y2="${px(contentTop + pos)}" stroke="${ink}"/>`,
      );
    }
    if (tick.label === "") continue;
    parts.push(
      `<text class="gg-legend-label" x="${px(horizontal ? rampX + pos : rampX + legend.rampWidth + 6)}" y="${px(horizontal ? contentTop + legend.rampHeight + 12 : contentTop + pos)}" text-anchor="${horizontal ? "middle" : "start"}" dy="0.32em" font-size="${px(labelSize)}" fill="${ink}">${escapeXML(tick.label)}${tick.fullLabel !== undefined && tick.fullLabel !== tick.label ? `<title>${escapeXML(tick.fullLabel)}</title>` : ""}</text>`,
    );
  }
  return parts;
}
