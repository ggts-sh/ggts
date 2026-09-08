/**
 * Scene-level SVG assembly: sceneLabel + sceneToSVGString.
 * Panel chrome: render-svg-panel-chrome.ts. Legend SVG: render-svg-legend.ts.
 */
import { groupBatchesByPanel } from "./group-batches-by-panel.js";
import { letterboxGutterRects } from "./letterbox-gutters.js";
import type { Scene } from "./scene.js";
import { themeVar } from "./theme.js";
import { paintDefsSvg, type ResolvedGlow, type ResolvedGradientPaint } from "./mark-paint.js";
import { escapeXML, px } from "./render-svg-format.js";
import { renderBatch, type PaintRenderMode } from "./render-svg-marks.js";
import {
  renderAxisTitles,
  renderGrid,
  renderPanelAxes,
  renderStrip,
} from "./render-svg-panel-chrome.js";
import { renderLegend } from "./render-svg-legend.js";

export function collectPaintResources(scene: Scene): {
  paints: ResolvedGradientPaint[];
  glows: ResolvedGlow[];
} {
  const paints: ResolvedGradientPaint[] = [];
  const glows: ResolvedGlow[] = [];
  const seen = new Set<string>();
  for (const batch of scene.batches) {
    if (batch.kind === "paths" || batch.kind === "rects") {
      if (batch.fillPaint !== undefined && !seen.has(batch.fillPaint.id)) {
        seen.add(batch.fillPaint.id);
        paints.push(batch.fillPaint);
      }
      if (batch.strokePaint !== undefined && !seen.has(batch.strokePaint.id)) {
        seen.add(batch.strokePaint.id);
        paints.push(batch.strokePaint);
      }
      if (batch.glow !== undefined && !seen.has(batch.glow.id)) {
        seen.add(batch.glow.id);
        glows.push(batch.glow);
      }
    } else if (batch.kind === "segments") {
      if (batch.strokePaint !== undefined && !seen.has(batch.strokePaint.id)) {
        seen.add(batch.strokePaint.id);
        paints.push(batch.strokePaint);
      }
      if (batch.glow !== undefined && !seen.has(batch.glow.id)) {
        seen.add(batch.glow.id);
        glows.push(batch.glow);
      }
    }
  }
  return { paints, glows };
}

/** Accessible name for the plot (deterministic, spec-derived). */
export function sceneLabel(scene: Scene): string {
  if (scene.title !== "") return scene.title;
  const x = scene.axes.x.title;
  const y = scene.axes.y.title;
  if (x !== "" && y !== "") return `Plot of ${y} by ${x}`;
  return "ggts plot";
}

/** Optional paint rendering controls for pure SVG export (#591). */
export interface SceneSVGOptions {
  /** Adapter compositing: chrome below/above interleaved SVG/canvas marks. */
  mode?: "full" | "chrome-bottom" | "marks" | "chrome-top";
  /** Accessible host name, otherwise derived from the scene. */
  ariaLabel?: string;
  /**
   * Within-mark paint mode. "full" emits gradients/glow; "fallback" uses solid
   * paint.fallback colors and omits glow (a11y / reduced-effects).
   */
  paintMode?: PaintRenderMode;
}

function renderScenePanels(
  scene: Scene,
  theme: Scene["theme"],
  paintMode: PaintRenderMode,
  mode: NonNullable<SceneSVGOptions["mode"]>,
): string[] {
  const parts: string[] = [];
  const { byPanel } = groupBatchesByPanel(scene.panels.length, scene.batches, false);
  for (let i = 0; i < scene.panels.length; i++) {
    const p = scene.panels[i]!;
    parts.push(
      `<g class="gg-panel" data-panel="${i}" transform="translate(${px(p.x)},${px(p.y)})">`,
      mode === "marks" || theme.panel === "none"
        ? ""
        : `<rect class="gg-panel-background" width="${px(p.width)}" height="${px(p.height)}" fill="${themeVar("panel", theme)}"/>`,
      mode === "marks" ? "" : renderGrid(p, theme),
      `<g class="gg-marks"${p.clip === false ? "" : ` clip-path="url(#gg-clip-${i})"`}>`,
    );
    if (mode !== "chrome-bottom") {
      for (const batch of byPanel[i]!) parts.push(renderBatch(batch, theme, paintMode));
    }
    parts.push("</g>");
    if (mode !== "marks" && theme.showPanelBorder) {
      parts.push(
        `<rect class="gg-panel-border" width="${px(p.width)}" height="${px(p.height)}" fill="none" stroke="${themeVar("panelBorder", theme)}" stroke-width="${px(theme.panelBorderWidth)}" vector-effect="non-scaling-stroke"/>`,
      );
    }
    parts.push("</g>");
    if (mode !== "marks") parts.push(renderStrip(p, scene, i), renderPanelAxes(p, theme));
  }
  return parts;
}

function renderHeading(scene: Scene, titleX: number, ink: string): string[] {
  const parts: string[] = [];
  if (scene.title !== "") {
    parts.push(
      `<text class="gg-title" x="${px(titleX)}" y="${px(scene.theme.titleSize)}" font-size="${px(scene.theme.titleSize)}" font-weight="${scene.theme.titleWeight}" fill="${ink}">${escapeXML(scene.title)}</text>`,
    );
  }
  if (scene.subtitle !== "") {
    const y =
      scene.title === ""
        ? scene.theme.subtitleSize
        : scene.theme.titleSize + scene.theme.subtitleSize + 3;
    parts.push(
      `<text class="gg-subtitle" x="${px(titleX)}" y="${px(y)}" font-size="${px(scene.theme.subtitleSize)}" font-weight="${scene.theme.subtitleWeight}" fill="${ink}">${escapeXML(scene.subtitle)}</text>`,
    );
  }
  return parts;
}

function renderLetterboxes(scene: Scene, theme: Scene["theme"]): string[] {
  const parts: string[] = [];
  for (const p of scene.panels) {
    if (p.allocation === undefined) continue;
    const fill = themeVar("letterboxFill", theme);
    for (const gutter of letterboxGutterRects(p.allocation, p)) {
      parts.push(
        `<rect class="gg-letterbox" x="${px(gutter.x)}" y="${px(gutter.y)}" width="${px(gutter.width)}" height="${px(gutter.height)}" fill="${fill}"/>`,
      );
    }
  }
  return parts;
}

function sceneLayoutAttribute(scene: Scene): string {
  return scene.layout === undefined ? "" : ` data-gg-layout="${scene.layout}"`;
}

/** Serialize a computed Scene to a standalone SVG string. */
export function sceneToSVGString(scene: Scene, options: SceneSVGOptions = {}): string {
  const paintMode = options.paintMode ?? "full";
  const mode = options.mode ?? "full";
  const bottom = mode === "full" || mode === "chrome-bottom";
  const top = mode === "full" || mode === "chrome-top";
  const panel = scene.panels[0]!;
  const theme = scene.theme;
  const ink = themeVar("ink", theme);
  const parts: string[] = [];
  const label = options.ariaLabel ?? sceneLabel(scene);
  const titleX = panel.allocation?.x ?? panel.x;
  const layoutAttribute = sceneLayoutAttribute(scene);
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px(scene.width)}" height="${px(scene.height)}" viewBox="0 0 ${px(scene.width)} ${px(scene.height)}" role="img" aria-label="${escapeXML(label)}" class="gg-plot"${layoutAttribute} font-family="${escapeXML(scene.theme.fontFamily)}" font-size="${px(scene.theme.fontSize)}" font-weight="${scene.theme.fontWeight}" text-rendering="optimizeLegibility" shape-rendering="geometricPrecision">`,
    `<title>${escapeXML(label)}</title>`,
  );
  if (bottom && theme.paper !== "none") {
    parts.push(
      `<rect class="gg-paper" width="${px(scene.width)}" height="${px(scene.height)}" fill="${themeVar("paper", theme)}"/>`,
    );
  }
  if (top) parts.push(...renderHeading(scene, titleX, ink));
  // Panel clip paths (decision 0008/0010 follow-up: marks clip to their
  // panel rect — jitter offsets, se ribbons, and pinned domains stay inside).
  // clipPathUnits is userSpaceOnUse, resolved in the coordinate system of the
  // REFERENCING group, which is panel-translated — so rects sit at 0,0.
  const clips = scene.panels
    .map((p, i) =>
      p.clip === false
        ? ""
        : `<clipPath id="gg-clip-${i}"><rect width="${px(p.width)}" height="${px(p.height)}"/></clipPath>`,
    )
    .join("");
  const { paints, glows } = collectPaintResources(scene);
  const paintDefs = paintMode === "full" ? paintDefsSvg(paints, glows) : "";
  parts.push(`<defs>${clips}${paintDefs}</defs>`);
  if (bottom) parts.push(...renderLetterboxes(scene, theme));
  if (mode !== "chrome-top") parts.push(...renderScenePanels(scene, theme, paintMode, mode));
  if (bottom) parts.push(renderAxisTitles(scene));
  for (const legend of top ? scene.legends : []) {
    // Deterministic gradient ids (byte-determinism wins over cross-plot id
    // uniqueness; documented caveat when inlining several plots in one page —
    // the Svelte adapter generates its own unique ids).
    parts.push(renderLegend(legend, theme, `gg-ramp-${legend.scale}`));
  }
  if (top && scene.caption !== "") {
    parts.push(
      `<text class="gg-caption" x="${px(scene.width - 4)}" y="${px(scene.height - 4)}" font-size="${px(scene.theme.captionSize)}" text-anchor="end" fill="${ink}">${escapeXML(scene.caption)}</text>`,
    );
  }
  parts.push("</svg>");
  return parts.join("");
}
