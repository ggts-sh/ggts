/// <reference lib="dom" />
/**
 * Live SVG plot handle (#1471): mount a Scene as real DOM once, then patch
 * updates in place instead of re-serializing + innerHTML-swapping.
 *
 * Strategy per update:
 * - sceneSignature mismatch → full remount (today's behavior; always safe).
 * - marks (the 10k-node hot path) → positional attribute patching via
 *   patchBatchGroup; a batch that refuses rebuilds from its renderBatch
 *   string (glyphs always take this path).
 * - chrome (axes, grids, strips, legends — tens of nodes) → re-serialized
 *   through the SAME string emitters and swapped per subtree, so chrome
 *   parity with renderToSVGString is by construction, tick-count changes
 *   included.
 *
 * Theme roles keep the string renderer's `var(--gg-*, fallback)` values, so
 * CSS custom-property overrides behave exactly as with the static render.
 * Defs/legend ids are shared with the string renderer; `idPrefix` namespaces
 * them per plot so two live plots can share one document (#1902).
 */
import type { GeometryBatch, Scene, SceneLegend, ScenePanel } from "../scene.js";
import { groupBatchesByPanel } from "../group-batches-by-panel.js";
import { themeVar } from "../theme.js";
import { paintDefsSvg } from "../mark-paint.js";
import { countMarks, renderBatch, type PaintRenderMode } from "../render-svg-marks.js";
import { px, svgIdScope } from "../render-svg-format.js";
import { PipelineError } from "../pipeline/public-api.js";
import {
  renderAxisTitles,
  renderGrid,
  renderPanelAxes,
  renderStrip,
} from "../render-svg-panel-chrome.js";
import { renderLegend } from "../render-svg-legend.js";
import { collectPaintResources, sceneLabel, sceneToSVGString } from "../render-svg-scene.js";

import { patchBatchGroup } from "./patch-marks.js";
import { sceneSignature } from "./signature.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const DEFAULT_MAX_MARKS = 100_000;

export interface LiveSvgOptions {
  /** Refuse to mount/update scenes with more marks than this (default 100_000). */
  maxMarks?: number;
  /** Within-mark paint mode, same contract as renderToSVGString. */
  paintMode?: PaintRenderMode;
  /** Document id scope, same contract as renderToSVGString (#1902). */
  idPrefix?: string;
}

export interface LiveSvgHandle {
  /** The mounted root <svg> element. */
  readonly svg: SVGSVGElement;
  /** The currently mounted scene. */
  readonly scene: Scene;
  /**
   * Patch the mounted DOM to `next`. Structurally identical scenes take the
   * positional fast path; any structural change remounts the affected
   * subtree (batch group, or the whole plot when the skeleton changed).
   */
  update(next: Scene): void;
  /** Remove the plot's <svg> from its parent. */
  destroy(): void;
}

/** Set textContent only when the label actually moved. */
function writeText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

/** setAttribute only when the serialized value actually moved. */
function writeIfChanged(el: Element, name: string, nextValue: string): void {
  if (el.getAttribute(name) !== nextValue) el.setAttribute(name, nextValue);
}

/** Numeric attr write with px formatting, compare-before-write. */
function writeNumAttr(el: Element, name: string, value: number): void {
  writeIfChanged(el, name, px(value));
}

/**
 * Mount a computed Scene as live, patchable SVG DOM under `root`.
 * Initial mount reuses the string renderer (markup identical to
 * renderToSVGString), so mount cost and output parity are unchanged.
 */
export function mountSceneSvg(
  root: Element,
  scene: Scene,
  options: LiveSvgOptions = {},
): LiveSvgHandle {
  const maxMarks = options.maxMarks ?? DEFAULT_MAX_MARKS;
  const paintMode = options.paintMode ?? "full";
  const idPrefix = options.idPrefix;
  const idScope = svgIdScope(idPrefix);
  const checkMarks = (s: Scene): void => {
    const marks = countMarks(s);
    if (marks > maxMarks) {
      throw new PipelineError(
        "max-marks-exceeded",
        "/layers",
        `The plot renders ${marks} marks, more than maxMarks (${maxMarks}). ` +
          "Raise maxMarks explicitly or reduce the data.",
      );
    }
  };
  checkMarks(scene);

  // Detached hosts for fragment parsing (SVG innerHTML is the supported
  // parse path); reused across updates so no per-patch allocation churn.
  const fragmentHost = document.createElementNS(SVG_NS, "svg");
  const mountHost = document.createElement("div");

  const parseFragment = (markup: string): Element[] => {
    fragmentHost.innerHTML = markup;
    const nodes = Array.from(fragmentHost.children);
    for (const n of nodes) n.remove();
    return nodes;
  };

  const renderToNode = (s: Scene): SVGSVGElement => {
    mountHost.innerHTML = sceneToSVGString(s, {
      paintMode,
      ...(idPrefix === undefined ? {} : { idPrefix }),
    });
    const fresh = mountHost.firstElementChild;
    mountHost.innerHTML = "";
    if (fresh === null) {
      throw new PipelineError("renderer-failure", "", "The SVG renderer produced no output.");
    }
    return fresh as SVGSVGElement;
  };

  let current = scene;
  let signature = sceneSignature(scene);
  let svg = renderToNode(scene);
  root.append(svg);

  const remount = (next: Scene): void => {
    const fresh = renderToNode(next);
    svg.replaceWith(fresh);
    svg = fresh;
    current = next;
    signature = sceneSignature(next);
  };

  const patchRoot = (next: Scene): void => {
    const theme = next.theme;
    writeNumAttr(svg, "width", next.width);
    writeNumAttr(svg, "height", next.height);
    writeIfChanged(svg, "viewBox", `0 0 ${px(next.width)} ${px(next.height)}`);
    writeIfChanged(svg, "aria-label", sceneLabel(next));
    writeIfChanged(svg, "font-family", theme.fontFamily);
    writeNumAttr(svg, "font-size", theme.fontSize);
    writeIfChanged(svg, "font-weight", String(theme.fontWeight));
    if (next.layout === undefined) delete svg.dataset["ggLayout"];
    else writeIfChanged(svg, "data-gg-layout", next.layout);
    const titleEl = svg.querySelector(":scope > title");
    if (titleEl !== null) writeText(titleEl, sceneLabel(next));
    const paper = svg.querySelector(":scope > rect.gg-paper");
    if (paper !== null) {
      writeNumAttr(paper, "width", next.width);
      writeNumAttr(paper, "height", next.height);
      writeIfChanged(paper, "fill", themeVar("paper", theme));
    }
    const ink = themeVar("ink", theme);
    const titleX = next.panels[0]?.allocation?.x ?? next.panels[0]?.x ?? 0;
    const patchHeadline = (
      cls: string,
      text: string,
      y: number,
      size: number,
      weight: number,
    ): void => {
      const el = svg.querySelector(`:scope > text.${cls}`);
      if (el === null) return; // presence is signature-stable
      writeNumAttr(el, "x", titleX);
      writeNumAttr(el, "y", y);
      writeNumAttr(el, "font-size", size);
      writeIfChanged(el, "font-weight", String(weight));
      writeIfChanged(el, "fill", ink);
      writeText(el, text);
    };
    if (next.title !== "") {
      patchHeadline("gg-title", next.title, theme.titleSize, theme.titleSize, theme.titleWeight);
    }
    if (next.subtitle !== "") {
      const y = next.title === "" ? theme.subtitleSize : theme.titleSize + theme.subtitleSize + 3;
      patchHeadline("gg-subtitle", next.subtitle, y, theme.subtitleSize, theme.subtitleWeight);
    }
    if (next.caption !== "") {
      const el = svg.querySelector(":scope > text.gg-caption");
      if (el !== null) {
        writeNumAttr(el, "x", next.width - 4);
        writeNumAttr(el, "y", next.height - 4);
        writeNumAttr(el, "font-size", theme.captionSize);
        writeIfChanged(el, "fill", ink);
        writeText(el, next.caption);
      }
    }
  };

  const patchDefs = (next: Scene): void => {
    const defs = svg.querySelector(":scope > defs");
    if (defs === null) return;
    // Panel clip paths lead the defs block (one per clipped panel).
    const clips = Array.from(defs.children).filter((c) => c.tagName === "clipPath");
    let i = 0;
    for (const p of next.panels) {
      if (p.clip === false) continue;
      const rect = clips[i]?.querySelector("rect");
      i++;
      if (rect === null || rect === undefined) continue;
      writeNumAttr(rect, "width", p.width);
      writeNumAttr(rect, "height", p.height);
    }
    // Paint defs: rebuild only when the serialized paint set actually moved.
    const { paints, glows } = collectPaintResources(next);
    const paintMarkup = paintMode === "full" ? paintDefsSvg(paints, glows, idScope) : "";
    const prev = collectPaintResources(current);
    const prevMarkup = paintMode === "full" ? paintDefsSvg(prev.paints, prev.glows, idScope) : "";
    if (paintMarkup === prevMarkup) return;
    for (const c of Array.from(defs.children)) {
      if (c.tagName !== "clipPath") c.remove();
    }
    defs.append(...parseFragment(paintMarkup));
  };

  const patchLetterbox = (next: Scene): void => {
    const gutters = svg.querySelectorAll(":scope > rect.gg-letterbox");
    if (gutters.length === 0) return;
    const fill = themeVar("letterboxFill", next.theme);
    let k = 0;
    for (const p of next.panels) {
      if (p.allocation === undefined) continue;
      // Same gutter derivation as letterboxGutterRects (top, bottom, left,
      // right order) — count stability is signature-guaranteed.
      const a = p.allocation;
      const rects: { x: number; y: number; width: number; height: number }[] = [];
      if (p.y - a.y > 0) rects.push({ x: a.x, y: a.y, width: a.width, height: p.y - a.y });
      if (a.y + a.height - (p.y + p.height) > 0) {
        rects.push({
          x: a.x,
          y: p.y + p.height,
          width: a.width,
          height: a.y + a.height - (p.y + p.height),
        });
      }
      if (p.x - a.x > 0) rects.push({ x: a.x, y: p.y, width: p.x - a.x, height: p.height });
      if (a.x + a.width - (p.x + p.width) > 0) {
        rects.push({
          x: p.x + p.width,
          y: p.y,
          width: a.x + a.width - (p.x + p.width),
          height: p.height,
        });
      }
      for (const g of rects) {
        const el = gutters[k];
        k++;
        if (el === undefined) return;
        writeNumAttr(el, "x", g.x);
        writeNumAttr(el, "y", g.y);
        writeNumAttr(el, "width", g.width);
        writeNumAttr(el, "height", g.height);
        writeIfChanged(el, "fill", fill);
      }
    }
  };

  /** Returns false on any structural drift — caller remounts. */
  const patchPanel = (
    next: Scene,
    index: number,
    panel: ScenePanel,
    nextBatches: readonly GeometryBatch[],
    prevBatches: readonly GeometryBatch[] | undefined,
  ): boolean => {
    const theme = next.theme;
    const group = svg.querySelector(`g.gg-panel[data-panel="${index}"]`);
    if (group === null) return false;
    writeIfChanged(group, "transform", `translate(${px(panel.x)},${px(panel.y)})`);
    const background = group.querySelector(":scope > rect.gg-panel-background");
    if (background !== null) {
      writeNumAttr(background, "width", panel.width);
      writeNumAttr(background, "height", panel.height);
      writeIfChanged(background, "fill", themeVar("panel", theme));
    }
    const marks = group.querySelector(":scope > g.gg-marks");
    if (marks === null) return false;
    // Grid groups re-serialize (tick counts move with domains); they sit
    // between the background and the marks group in emission order.
    const gridNodes = parseFragment(renderGrid(panel, theme));
    const oldGrids = Array.from(group.querySelectorAll(":scope > g.gg-grid"));
    if (oldGrids.length === gridNodes.length) {
      for (let g = 0; g < oldGrids.length; g++) oldGrids[g]!.replaceWith(gridNodes[g]!);
    } else {
      for (const g of oldGrids) g.remove();
      for (const node of gridNodes) marks.before(node);
    }
    // Marks: positional batch patching with per-batch rebuild fallback.
    if (panel.clip === false) marks.removeAttribute("clip-path");
    else writeIfChanged(marks, "clip-path", `url(#${idScope}gg-clip-${index})`);
    if (prevBatches === undefined) return false;
    const batchGroups = marks.querySelectorAll(":scope > g.gg-batch");
    if (batchGroups.length !== nextBatches.length) return false;
    const ctx = { theme, paintMode, idScope };
    for (let b = 0; b < nextBatches.length; b++) {
      const g = batchGroups[b] as SVGGElement;
      const ok = patchBatchGroup(g, prevBatches[b]!, nextBatches[b]!, ctx);
      if (!ok) {
        const fresh = parseFragment(renderBatch(nextBatches[b]!, theme, paintMode));
        if (fresh[0] === undefined) return false;
        g.replaceWith(fresh[0]);
      }
    }
    const border = group.querySelector(":scope > rect.gg-panel-border");
    if (border !== null) {
      writeNumAttr(border, "width", panel.width);
      writeNumAttr(border, "height", panel.height);
    }
    return true;
  };

  const patchStrips = (next: Scene): void => {
    // Strip groups follow their panel group in document order (signature
    // pins presence), so consume `.gg-strip` nodes per panel in order.
    const strips = Array.from(svg.querySelectorAll(":scope > g.gg-strip"));
    let k = 0;
    for (let i = 0; i < next.panels.length; i++) {
      const panel = next.panels[i]!;
      if (panel.strip === "" || panel.showStrip === false) continue;
      const el = strips[k];
      k++;
      if (el === undefined) return;
      const fresh = parseFragment(renderStrip(panel, next, i, idScope));
      if (fresh[0] !== undefined) el.replaceWith(fresh[0]);
    }
  };

  const patchAxes = (next: Scene): void => {
    // Axis groups appear in document order: per panel, x then y. Presence is
    // signature-stable, so consume the existing list in that order.
    const existing = Array.from(svg.querySelectorAll(":scope > g.gg-axis"));
    let k = 0;
    for (const panel of next.panels) {
      const fresh = parseFragment(renderPanelAxes(panel, next.theme));
      for (const axis of [
        { cls: "gg-axis-x", ticks: panel.axisX },
        { cls: "gg-axis-y", ticks: panel.axisY },
      ]) {
        if (axis.ticks === null) continue;
        const old = existing[k];
        k++;
        if (old === undefined) return;
        const node = fresh.find((n) => n.classList.contains(axis.cls));
        if (node !== undefined) old.replaceWith(node);
      }
    }
  };

  const patchAxisTitles = (next: Scene): void => {
    const titles = Array.from(svg.querySelectorAll(":scope > text.gg-axis-title"));
    if (titles.length === 0) return;
    const fresh = parseFragment(renderAxisTitles(next));
    for (let t = 0; t < titles.length; t++) {
      const node = fresh[t];
      if (node !== undefined) titles[t]!.replaceWith(node);
    }
  };

  const patchLegends = (next: Scene): void => {
    const existing = Array.from(svg.querySelectorAll(":scope > g.gg-legend"));
    for (let i = 0; i < existing.length; i++) {
      const legend: SceneLegend | undefined = next.legends[i];
      if (legend === undefined) return;
      const fresh = parseFragment(
        renderLegend(legend, next.theme, `${idScope}gg-ramp-${legend.scale}`),
      );
      if (fresh[0] !== undefined) existing[i]!.replaceWith(fresh[0]);
    }
  };

  return {
    get svg() {
      return svg;
    },
    get scene() {
      return current;
    },
    update(next: Scene): void {
      checkMarks(next);
      try {
        if (sceneSignature(next) !== signature) {
          remount(next);
          return;
        }
        patchRoot(next);
        patchDefs(next);
        patchLetterbox(next);
        // Group once per update, not once per panel (O(P² + P·B) otherwise).
        const { byPanel } = groupBatchesByPanel(next.panels.length, next.batches, false);
        const { byPanel: prevByPanel } = groupBatchesByPanel(
          current.panels.length,
          current.batches,
          false,
        );
        for (let i = 0; i < next.panels.length; i++) {
          if (!patchPanel(next, i, next.panels[i]!, byPanel[i]!, prevByPanel[i])) {
            remount(next);
            return;
          }
        }
        patchStrips(next);
        patchAxes(next);
        patchAxisTitles(next);
        patchLegends(next);
        current = next;
      } catch (error) {
        if (error instanceof PipelineError) throw error;
        throw new PipelineError(
          "renderer-failure",
          "",
          `The live SVG update failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    destroy(): void {
      svg.remove();
    },
  };
}

/** Re-exported for parity assertions and custom drivers. */
export { sceneSignature };
