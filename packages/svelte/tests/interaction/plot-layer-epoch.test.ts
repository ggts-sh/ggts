/**
 * #609 data-identity epoch must keep reading mark descriptors' `.data`
 * after the LayerRegistry union widening. Guards
 * plot-engine.svelte.ts data-identity epoch (`inputs.registry.markLayers`).
 *
 * Wire-through only: observe the production path, never recompute the epoch
 * token in the test body (that would be a LayerRegistry tautology).
 */
import { describe, expect, it } from "vitest";

import type { RenderModel } from "@ggts-sh/core";

import { LayerRegistry } from "../../src/lib/geoms/registry.svelte.js";
import type { PortableSpec } from "../../src/lib/index.js";
import PlotLayerHost from "../fixtures/PlotLayerHost.svelte";
import { render } from "../helpers/render.js";

const rowsA = [
  { x: 1, y: 2 },
  { x: 3, y: 4 },
];
/** New row *objects* with the same field values as rowsA.
 *  sourceIdentity differs (epoch must bump via markLayers) but candidate
 *  axis tokens match — so keyless pin revalidation would succeed if the
 *  epoch stayed stable (the silent #609 failure under registry.layers). */
const rowsAPrime = [
  { x: 1, y: 2 },
  { x: 3, y: 4 },
];

const size = { width: 480, height: 320 };

function pointEvent(
  capture: Element,
  type: "pointerdown" | "pointermove" | "pointerup",
  x: number,
  y: number,
  pointerType = "mouse",
  pointerId = 1,
): PointerEvent {
  const rect = capture.getBoundingClientRect();
  const event = new PointerEvent(type, {
    bubbles: true,
    button: 0,
    buttons: type === "pointerup" ? 0 : 1,
    clientX: rect.left + (x / size.width) * rect.width,
    clientY: rect.top + (y / size.height) * rect.height,
    pointerId,
    pointerType,
  });
  capture.dispatchEvent(event);
  return event;
}

describe("#609 epoch with non-mark layers registered", () => {
  it("markLayers expose .data; union layers do not (call-site contract)", () => {
    // Cheap documentation of the silent-regression shape: reading
    // registry.layers under the union makes .data undefined. Not the guard —
    // see the pin-invalidation test below for the production wire-through.
    const registry = new LayerRegistry();
    registry.register({
      geom: "point",
      data: rowsA,
    });
    registry.registerPlotLayer({
      kind: "theme",
      get value() {
        return "dark" as const;
      },
    });

    const broken = registry.layers.map((layer) => (layer as { data?: unknown }).data);
    expect(broken.every((data) => data === undefined)).toBe(true);

    const fixed = registry.markLayers.map((layer) => layer.data);
    expect(fixed).toEqual([rowsA]);
  });

  it("markLayers data replace bumps epoch; default identity rebinds pin", async () => {
    // Production path: plot-engine fingerprints
    // inputs.registry.markLayers when the layers prop is absent. Only mark
    // descriptors expose .data — so a geom child's layer-local replacement
    // must bump dataIdentityEpoch (new RenderModel). Default row-index
    // identity then rebinds the pin across that epoch when geometry matches.
    //
    // Setup: no plot `data`/`spec` prop (layer-local only), a non-mark theme
    // sibling registered, inspect pin enabled, no explicit key.
    let model: RenderModel | null = null;
    const inspectEvents: Array<{ phase: string; state?: string }> = [];
    const view = render(PlotLayerHost, {
      aes: { x: "x", y: "y" },
      markData: rowsA,
      plotLayers: [{ kind: "theme" as const, value: "dark" as const }],
      inspect: { pin: true },
      onrender: (next: RenderModel, _spec: PortableSpec) => {
        model = next;
      },
      oninspect: (event: { phase: string; state?: string }) => {
        inspectEvents.push({ phase: event.phase, state: event.state });
      },
    });

    await expect.poll(() => model !== null && model.candidates.size > 0).toBe(true);
    const seed = model!.candidates.candidate(0);
    expect(seed).not.toBeNull();
    const capture = view.container.querySelector(".gg-capture")!;
    expect(capture).not.toBeNull();

    // Touch tap pins when inspect.pin is enabled (see r0-evidence/touch-interval / pointer-up).
    pointEvent(capture, "pointerdown", seed!.x, seed!.y, "touch", 9);
    pointEvent(capture, "pointerup", seed!.x, seed!.y, "touch", 9);
    await expect
      .poll(() =>
        inspectEvents.some((event) => event.phase === "change" && event.state === "pinned"),
      )
      .toBe(true);
    expect(view.container.querySelector(".gg-tooltip")).not.toBeNull();

    const pinnedModel = model;
    // Swap to a *new array of new row objects* with identical field values.
    // That bumps the markLayers source-identity fingerprint (epoch). Default
    // row-index keys rebind the pin so the tooltip stays up.
    await view.rerender({
      aes: { x: "x", y: "y" },
      markData: rowsAPrime,
      plotLayers: [{ kind: "theme" as const, value: "dark" as const }],
      inspect: { pin: true },
      onrender: (next: RenderModel) => {
        model = next;
      },
      oninspect: (event: { phase: string; state?: string }) => {
        inspectEvents.push({ phase: event.phase, state: event.state });
      },
    });

    await expect.poll(() => model !== pinnedModel).toBe(true);
    expect(view.container.querySelector(".gg-tooltip")).not.toBeNull();
  });

  it("isFacetedPlotIntent host path: facet plot layer disables brush zoom with diagnostic", async () => {
    // Wire-through: orchestrator must pass registry.layers into
    // isFacetedPlotIntent, not only the helper signature.
    const diagnostics: Array<{ code: string }> = [];
    const facetedRows = [
      { x: 1, y: 2, g: "a" },
      { x: 2, y: 4, g: "b" },
    ];
    render(PlotLayerHost, {
      data: facetedRows,
      aes: { x: "x", y: "y" },
      point: true,
      // No facet prop — only a registry facet layer.
      plotLayers: [{ kind: "facet" as const, value: { wrap: "g" } }],
      zoom: true,
      ondiagnostic: (diagnostic: { code: string }) => {
        diagnostics.push(diagnostic);
      },
    });
    await expect
      .poll(() => diagnostics.some((d) => d.code === "INTERACTION_INTERVAL_FACET_UNSUPPORTED"))
      .toBe(true);
  });
});
