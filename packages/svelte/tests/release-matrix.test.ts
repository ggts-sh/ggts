import "./setup-register-all.js";
import { tick } from "svelte";
import { describe, expect, it, vi } from "vitest";

import { runPipeline } from "@ggts-sh/core";

import GGPlot from "../src/lib/GGPlot.svelte";
import { resolveInspection } from "../src/lib/inspection/resolver.js";
import type { IntervalSelection, ZoomEvent } from "../src/lib/interaction/interaction.js";
import GGPlotHydrationFixture from "./fixtures/GGPlotHydrationFixture.svelte";
import MultipleInteractivePlots from "./fixtures/MultipleInteractivePlots.svelte";
import { hydrateSsrFixture } from "./helpers/hydration.js";
import { assertIdReferencesResolve, assertUniqueIds } from "./helpers/semantics.js";
import { render } from "./helpers/render.js";

const size = { width: 480, height: 320 } as const;
const rows = [
  { id: "a", x: 1, y: 2 },
  { id: "b", x: 2, y: 4 },
  { id: "c", x: 3, y: 3 },
];

async function nextFrame(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

function tool(container: ParentNode, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button")].find(
    (candidate) => candidate.textContent === label,
  );
  if (button === undefined) throw new Error(`Missing ${label} tool`);
  return button;
}

function pointer(
  target: Element,
  type: "pointerdown" | "pointermove" | "pointerup",
  point: { x: number; y: number },
  pointerType: "mouse" | "pen" = "mouse",
  pointerId = 17,
): void {
  const bounds = target.getBoundingClientRect();
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      clientX: bounds.left + (point.x / size.width) * bounds.width,
      clientY: bounds.top + (point.y / size.height) * bounds.height,
      pointerId,
      pointerType,
    }),
  );
}

function drag(
  target: Element,
  from: { x: number; y: number },
  to: { x: number; y: number },
  pointerType: "mouse" | "pen" = "mouse",
): void {
  pointer(target, "pointerdown", from, pointerType);
  pointer(target, "pointermove", to, pointerType);
  pointer(target, "pointerup", to, pointerType);
}

describe("R-1/R0 release matrix", () => {
  // 240s: the /__ggplot-ssr fetch transforms GGPlot's whole SSR module graph
  // on the suite-shared Vite server, so under full-suite transform contention
  // (three browsers, 150+ files) it can wait well past 30s on loaded runners.
  // Measured on a loaded x86_64 box: 134–155s for the single SSR transform on
  // BOTH main and this branch (#1420) — a pre-existing contention flake, not
  // a correctness signal. The endpoint joins concurrent fetches onto one
  // transform; CI caps maxWorkers=2 (+ retry) which keeps the queue short.
  // Eagerly warming the graph at server start is NOT safe: it races dep
  // re-optimization and yields mixed Svelte server runtimes
  // (lifecycle_outside_component).
  it("hydrates a real server-rendered GGPlot and attaches inspection events", async () => {
    const target = document.createElement("div");
    const response = await fetch("/__ggplot-ssr");
    const ssrBody = await response.text();
    expect(response.ok, ssrBody).toBe(true);
    target.innerHTML = ssrBody;
    document.body.append(target);

    const cleanup = hydrateSsrFixture(GGPlotHydrationFixture, target, {});
    await tick();
    const fixture = target.querySelector<HTMLElement>("[data-ggplot-hydration-fixture]")!;
    expect(fixture.dataset.hydrated).toBe("true");
    const capture = fixture.querySelector<HTMLElement>(".gg-capture")!;
    capture.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await tick();
    expect(fixture.dataset.lastPhase).toBe("change");
    expect(fixture.querySelector(".gg-tooltip")).not.toBeNull();

    await cleanup();
    target.remove();
  }, 240_000);

  it("keeps IDs and ARIA ownership unique across two interactive charts", async () => {
    const { container } = render(MultipleInteractivePlots);
    const captures = [...container.querySelectorAll<HTMLElement>(".gg-capture")];
    expect(captures).toHaveLength(2);
    for (const capture of captures) {
      capture.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    }
    await tick();
    assertUniqueIds(container);
    assertIdReferencesResolve(container);
    expect(new Set(captures.map((capture) => capture.getAttribute("aria-describedby"))).size).toBe(
      2,
    );
    expect(container.querySelectorAll(".gg-tooltip")).toHaveLength(2);
  });

  it("resolves concrete auto modes for mixed, aggregate, and synthetic candidates", () => {
    const mixed = runPipeline(
      {
        data: {
          values: [
            { x: 1, y: 2, group: "a" },
            { x: 2, y: 4, group: "a" },
            { x: 1, y: 6, group: "b" },
            { x: 2, y: 8, group: "b" },
          ],
        },
        aes: {
          x: { field: "x" },
          y: { field: "y" },
          group: { field: "group" },
        },
        layers: [{ geom: "point" }, { geom: "line" }, { geom: "area" }],
      },
      { ...size },
    );
    const modes = new Map<number, Set<string>>();
    for (let id = 0; id < mixed.candidates.size; id++) {
      const candidate = mixed.candidates.candidate(id)!;
      const layerModes = modes.get(candidate.layerIndex) ?? new Set<string>();
      layerModes.add(candidate.autoMode);
      modes.set(candidate.layerIndex, layerModes);
    }
    // Points default to exact (hover ring); line/area keep axis modes (#754).
    expect([...modes.entries()].map(([layer, values]) => [layer, [...values]])).toEqual([
      [0, ["exact"]],
      [1, ["x"]],
      [2, ["x"]],
    ]);

    const aggregate = runPipeline(
      {
        data: { values: [{ group: "a" }, { group: "a" }, { group: "b" }] },
        layers: [{ geom: "bar", aes: { x: { field: "group" } } }],
      },
      { ...size },
    );
    expect(aggregate.candidates.candidate(0)).toMatchObject({
      kind: "rects",
      rowIndex: null,
      autoMode: "exact",
    });
    expect(aggregate.lineage.count(aggregate.candidates.candidate(0)!.lineage)).toBe(2);

    const synthetic = runPipeline(
      {
        data: {
          values: [
            { x: 1, y: 2 },
            { x: 2, y: 4 },
          ],
        },
        layers: [
          { geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } },
          { geom: "rule", params: { yintercept: 3 } },
        ],
      },
      { ...size },
    );
    const annotation = synthetic.candidates.candidate(synthetic.candidates.size - 1)!;
    expect(annotation).toMatchObject({
      layerIndex: 1,
      kind: "segments",
      rowIndex: null,
      autoMode: "y",
    });
    mixed.dispose();
    aggregate.dispose();
    synthetic.dispose();
  });

  it("chooses the orthogonally nearest duplicate-axis representative and retains focus", () => {
    const data = [
      { id: "a-low", x: 1, y: 0, group: "A" },
      { id: "a-high", x: 1, y: 10, group: "A" },
      { id: "b-seed", x: 1, y: 9, group: "B" },
      { id: "c", x: 1, y: 5, group: "C" },
    ];
    const model = runPipeline(
      {
        data: { values: data },
        layers: [
          {
            geom: "point",
            aes: {
              x: { field: "x" },
              y: { field: "y" },
              color: { field: "group" },
            },
          },
        ],
      },
      { ...size },
    );
    const seed = Array.from({ length: model.candidates.size }, (_, id) =>
      model.candidates.candidate(id),
    ).find((candidate) => candidate?.rowIndex === 2)!;
    const inspection = resolveInspection({
      model,
      seed,
      mode: "x",
      state: "transient",
      source: "pointer",
      keyOf: (row) => row.id as string,
    });
    expect(inspection.members.map((member) => member.key)).toEqual(["a-high", "b-seed", "c"]);
    expect(inspection.focus.key).toBe("b-seed");
    model.dispose();
  });

  it("keeps multiple scale legends and layer series in one ordered grouped target", () => {
    const data = [
      { id: "one", x: 1, y: 2, colorGroup: "A", fillGroup: "X" },
      { id: "two", x: 2, y: 3, colorGroup: "B", fillGroup: "Y" },
    ];
    const model = runPipeline(
      {
        data: { values: data },
        layers: [
          {
            geom: "point",
            aes: {
              x: { field: "x" },
              y: { field: "y" },
              color: { field: "colorGroup" },
            },
          },
          {
            geom: "col",
            aes: {
              x: { field: "x" },
              y: { field: "y" },
              fill: { field: "fillGroup" },
            },
          },
        ],
      },
      { ...size },
    );
    const legends = model.scene.legends.filter((legend) => legend.type === "discrete");
    expect(
      legends.map((legend) => [legend.title, legend.entries.map((entry) => entry.value)]),
    ).toEqual([
      ["Color group", ["A", "B"]],
      ["Fill group", ["X", "Y"]],
    ]);
    const seed = model.candidates.candidate(0)!;
    const inspection = resolveInspection({
      model,
      seed,
      mode: "x",
      state: "transient",
      source: "pointer",
      keyOf: (row) => row.id as string,
    });
    expect(inspection.members.map((member) => member.layerIndex)).toEqual([0, 1]);
    expect(inspection.members.map((member) => member.key)).toEqual(["one", "one"]);
    model.dispose();
  });

  it("cancels a live area draft on window blur without committing", async () => {
    const selected = vi.fn<(event: IntervalSelection<string>) => void>();
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      select: "interval",
      onselect: selected,
      ...size,
    });
    await expect.poll(() => tool(container, "Select area").disabled).toBe(false);
    tool(container, "Select area").click();
    const capture = container.querySelector(".gg-capture")!;
    pointer(capture, "pointerdown", { x: 100, y: 80 });
    pointer(capture, "pointermove", { x: 300, y: 220 });
    await nextFrame();
    expect(container.querySelector(".gg-area-draft-select")).not.toBeNull();
    window.dispatchEvent(new Event("blur"));
    await tick();
    expect(container.querySelector(".gg-area-draft-select")).toBeNull();
    expect(selected.mock.calls.some(([event]) => event.phase === "end")).toBe(false);
  });

  it("gives pen and mouse interval gestures identical semantics", async () => {
    const ends: IntervalSelection<string>[] = [];
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      select: "interval",
      onselect: (event: IntervalSelection<string>) => {
        if (event.phase === "end") ends.push(event);
      },
      ...size,
    });
    await expect.poll(() => tool(container, "Select area").disabled).toBe(false);
    tool(container, "Select area").click();
    const capture = container.querySelector(".gg-capture")!;
    drag(capture, { x: 100, y: 80 }, { x: 340, y: 250 }, "mouse");
    await expect.poll(() => ends).toHaveLength(1);
    drag(capture, { x: 100, y: 80 }, { x: 340, y: 250 }, "pen");
    await expect.poll(() => ends).toHaveLength(2);
    expect({ ...ends[1], source: "pointer" }).toEqual(ends[0]);
  });

  it("arbitrates combined capabilities so one gesture has exactly one result", async () => {
    const selected = vi.fn<(event: IntervalSelection<string>) => void>();
    const zoomed = vi.fn<(event: ZoomEvent) => void>();
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      inspect: true,
      select: "interval",
      zoom: true,
      onselect: selected,
      onzoom: zoomed,
      ...size,
    });
    await expect.poll(() => tool(container, "Select area").disabled).toBe(false);
    tool(container, "Select area").click();
    const capture = container.querySelector(".gg-capture")!;
    drag(capture, { x: 100, y: 80 }, { x: 320, y: 230 });
    await expect
      .poll(() => selected.mock.calls.filter(([event]) => event.phase === "end").length)
      .toBe(1);
    expect(zoomed).not.toHaveBeenCalled();

    const selectionEnds = selected.mock.calls.filter(([event]) => event.phase === "end").length;
    tool(container, "Zoom area").click();
    drag(capture, { x: 130, y: 90 }, { x: 350, y: 250 });
    await expect.poll(() => zoomed).toHaveBeenCalledTimes(1);
    expect(selected.mock.calls.filter(([event]) => event.phase === "end")).toHaveLength(
      selectionEnds,
    );
  });
});
