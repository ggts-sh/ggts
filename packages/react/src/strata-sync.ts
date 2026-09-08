import { groupBatchesByPanel, planStrata, sceneToSVGString } from "@ggts-sh/core";
import type { BatchInteractionMask, GeometryBatch, Scene } from "@ggts-sh/core";
import { cssColorResolver, drawStratum, sizeCanvasForDpr } from "@ggts-sh/core/dom";
import { mountSceneSvg, type LiveSvgHandle } from "@ggts-sh/core/svg-live";

const STRATUM_STYLE = "position:absolute;inset:0;pointer-events:none";
type SvgMode = "full" | "chrome-bottom" | "marks" | "chrome-top";
type Slot = { backend: "canvas" | "svg"; batches: GeometryBatch[]; mode: SvgMode };

function slots(scene: Scene, strata: ReturnType<typeof planStrata>): Slot[] {
  if (!strata.some((s) => s.backend === "canvas")) {
    return [{ backend: "svg", batches: scene.batches, mode: "full" }];
  }
  return [
    { backend: "svg", batches: [], mode: "chrome-bottom" },
    ...strata.map((stratum): Slot => ({ ...stratum, mode: "marks" })),
    { backend: "svg", batches: [], mode: "chrome-top" },
  ];
}

/** Prefix generated resource ids so sibling plots cannot borrow clips/gradients. */
export function namespaceSvg(markup: string, prefix: string): string {
  return markup
    .replaceAll(/\bid="([^"]+)"/g, (_match, id: string) => `id="${prefix}-${id}"`)
    .replaceAll(/url\(#([^)]+)\)/g, (_match, id: string) => `url(#${prefix}-${id})`);
}

function slotSvg(scene: Scene, slot: Slot, prefix: string, label?: string): string {
  const svg = sceneToSVGString(
    { ...scene, batches: slot.batches },
    {
      mode: slot.mode,
      ...(label !== undefined && { ariaLabel: label }),
    },
  );
  const named = namespaceSvg(svg, prefix);
  return slot.mode === "marks" || slot.mode === "chrome-top"
    ? named.replace('role="img"', 'aria-hidden="true"')
    : named;
}

export function renderStackHTML(
  scene: Scene,
  strata: ReturnType<typeof planStrata>,
  prefix: string,
  label?: string,
): string {
  return slots(scene, strata)
    .map((slot, index) =>
      slot.backend === "canvas"
        ? `<canvas class="gg-stratum gg-canvas" aria-hidden="true" style="${STRATUM_STYLE}"></canvas>`
        : `<div class="gg-stratum gg-svg-host" style="${STRATUM_STYLE}">${slotSvg(scene, slot, `${prefix}-${index}`, label)}</div>`,
    )
    .join("");
}

function namespaceLive(svg: SVGSVGElement, prefix: string): void {
  for (const element of svg.querySelectorAll("[id]")) {
    if (!element.id.startsWith(`${prefix}-`)) element.id = `${prefix}-${element.id}`;
  }
  for (const element of svg.querySelectorAll("[clip-path], [fill], [stroke], [filter]")) {
    for (const attribute of ["clip-path", "fill", "stroke", "filter"]) {
      const value = element.getAttribute(attribute);
      if (value === null || !value.includes("url(#")) continue;
      const next = value.replaceAll(/url\(#([^)]+)\)/g, (match, id: string) =>
        id.startsWith(`${prefix}-`) ? match : `url(#${prefix}-${id})`,
      );
      if (next !== value) element.setAttribute(attribute, next);
    }
  }
}

function maskBatch(
  group: Element,
  batch: GeometryBatch,
  mask: BatchInteractionMask | null,
  mutedOpacity: number,
): void {
  let primitive = 0;
  for (const element of group.children) {
    if (!(element instanceof SVGElement)) continue;
    if (batch.kind === "paths") {
      while (
        primitive < batch.pathOffsets.length - 1 &&
        batch.pathOffsets[primitive] === batch.pathOffsets[primitive + 1]
      )
        primitive++;
    }
    const muted = mask !== null && !mask.isFocused(primitive);
    element.style.opacity = muted
      ? String(Number(element.getAttribute("opacity") ?? 1) * mutedOpacity)
      : "";
    // Label backgrounds and their following text represent the same mark.
    if (batch.kind !== "glyphs" || element.tagName === "text") primitive++;
  }
}

function maskMarks(
  host: HTMLElement,
  scene: Scene,
  batches: GeometryBatch[],
  masks: readonly (BatchInteractionMask | null)[],
): void {
  const grouped = groupBatchesByPanel(scene.panels.length, batches, true);
  for (const [panelIndex, panelBatches] of grouped.byPanel.entries()) {
    const groups = host.querySelectorAll(
      `.gg-panel[data-panel="${panelIndex}"] > .gg-marks > .gg-batch`,
    );
    for (const [batchIndex, batch] of panelBatches.entries()) {
      const group = groups[batchIndex];
      if (group === undefined) continue;
      const mask = masks[grouped.indices![panelIndex]![batchIndex]!] ?? null;
      maskBatch(group, batch, mask, scene.theme.interactionMuted);
    }
  }
}

export function destroyAllLives(lives: Map<number, LiveSvgHandle>): void {
  for (const handle of lives.values()) handle.destroy();
  lives.clear();
}

function syncSvgSlot(
  element: HTMLElement,
  scene: Scene,
  slot: Slot,
  lives: Map<number, LiveSvgHandle>,
  index: number,
  prefix: string,
  label?: string,
): void {
  element.className = "gg-stratum gg-svg-host";
  if (slot.mode === "full") {
    let live = lives.get(index);
    if (live === undefined) {
      element.replaceChildren();
      live = mountSceneSvg(element, scene);
      lives.set(index, live);
    } else if (live.scene !== scene) live.update(scene);
    namespaceLive(live.svg, prefix);
    if (label !== undefined) live.svg.setAttribute("aria-label", label);
  } else {
    lives.get(index)?.destroy();
    lives.delete(index);
    const markup = slotSvg(scene, slot, prefix, label);
    if (element.innerHTML !== markup) element.innerHTML = markup;
  }
}

export function syncStrata(
  stack: HTMLDivElement,
  scene: Scene,
  strata: ReturnType<typeof planStrata>,
  lives: Map<number, LiveSvgHandle>,
  prefix: string,
  label?: string,
  interactionMasks: readonly (BatchInteractionMask | null)[] = [],
): boolean {
  const planned = slots(scene, strata);
  const sceneIndexes = new Map(scene.batches.map((batch, index) => [batch, index]));
  while (stack.childElementCount > planned.length) {
    const index = stack.childElementCount - 1;
    lives.get(index)?.destroy();
    lives.delete(index);
    stack.lastElementChild?.remove();
  }
  let painted = true;
  for (const [index, slot] of planned.entries()) {
    const existing = stack.children[index];
    const tag = slot.backend === "canvas" ? "CANVAS" : "DIV";
    let element: HTMLElement;
    if (existing instanceof HTMLElement && existing.tagName === tag) element = existing;
    else {
      lives.get(index)?.destroy();
      lives.delete(index);
      element = document.createElement(tag.toLowerCase());
      if (existing === undefined) stack.append(element);
      else stack.replaceChild(element, existing);
    }
    element.style.cssText = STRATUM_STYLE;
    const masks = slot.batches.map((batch) => interactionMasks[sceneIndexes.get(batch)!] ?? null);
    if (element instanceof HTMLCanvasElement) {
      element.className = "gg-stratum gg-canvas";
      element.setAttribute("aria-hidden", "true");
      const context = element.getContext("2d");
      if (context === null) {
        painted = false;
        continue;
      }
      sizeCanvasForDpr(element, context, scene.width, scene.height, window.devicePixelRatio || 1);
      drawStratum(
        context,
        scene,
        slot.batches,
        cssColorResolver(element),
        masks.some((mask) => mask !== null) ? { focusMasks: masks } : undefined,
      );
      continue;
    }
    syncSvgSlot(element, scene, slot, lives, index, `${prefix}-${index}`, label);
    maskMarks(element, scene, slot.batches, masks);
  }
  return painted;
}
