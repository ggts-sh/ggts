/**
 * Ambiguous-wiring advisories (ADR 0013 audit): combos that silently do
 * nothing must advise once, through the ordinary diagnostic channel, without
 * disturbing intentional patterns (passive controller consumers, clean
 * handler/capability pairs).
 */
import { describe, expect, it, vi } from "vitest";

import GGPlot from "../../src/lib/GGPlot.svelte";
import "../../src/lib/host-init.js";
import { createPlotInteraction } from "../../src/lib/interaction/controller.svelte.js";
import type { InteractionDiagnostic } from "../../src/lib/interaction/interaction.js";
import { render } from "../helpers/render.js";
import { collect, settled } from "../helpers/diagnostic-harness.js";

const rows = [
  { id: "a", x: 1, y: 10 },
  { id: "b", x: 2, y: 20 },
  { id: "c", x: 3, y: 15 },
];
const size = { width: 480, height: 320 };
const base = {
  data: rows,
  aes: { x: "x", y: "y" },
  layers: [{ geom: "point" as const }],
  // Default identity: rows expose `id` — no plot-level `key` (deprecated).
  ...size,
};

describe("scope-without-controller advisory", () => {
  it("advises when interactionScope is supplied without a controller", async () => {
    const { diagnostics, ondiagnostic } = collect();
    render(GGPlot, { ...base, interactionScope: { keys: "row-id" }, ondiagnostic });
    await expect
      .poll(() => diagnostics.find((d) => d.code === "INTERACTION_SCOPE_WITHOUT_CONTROLLER"))
      .toMatchObject({ severity: "advisory", prop: "interactionScope" });
  });

  it("stays silent when the scope accompanies a controller", async () => {
    const { diagnostics, ondiagnostic } = collect();
    const interaction = createPlotInteraction<string>();
    const { container } = render(GGPlot, {
      ...base,
      interaction,
      interactionScope: { keys: "row-id" },
      ondiagnostic,
    });
    await settled(container);
    expect(diagnostics.map((d) => d.code)).not.toContain("INTERACTION_SCOPE_WITHOUT_CONTROLLER");
  });
});

describe("handler-without-capability advisory", () => {
  it("advises per dead handler, naming the capability prop to enable", async () => {
    const { diagnostics, ondiagnostic } = collect();
    render(GGPlot, {
      ...base,
      onselect: vi.fn(),
      onzoom: vi.fn(),
      ondiagnostic,
    });
    await expect
      .poll(
        () => diagnostics.filter((d) => d.code === "INTERACTION_HANDLER_WITHOUT_CAPABILITY").length,
      )
      .toBe(2);
    // Narrowing predicate, not a cast: `actual` exists only on the interaction
    // variant, so under the widened PlotDiagnostic union a plain filter leaves
    // `d.actual` resolving to an error type.
    const dead = diagnostics.filter(
      (d): d is InteractionDiagnostic => d.code === "INTERACTION_HANDLER_WITHOUT_CAPABILITY",
    );
    expect(new Set(dead.map((d) => d.prop))).toEqual(new Set(["onselect", "onzoom"]));
    expect(new Set(dead.map((d) => d.actual))).toEqual(new Set(["select", "zoom"]));
    for (const diagnostic of dead) expect(diagnostic.severity).toBe("advisory");
  });

  it("stays silent when every handler has its capability enabled", async () => {
    const { diagnostics, ondiagnostic } = collect();
    const { container } = render(GGPlot, {
      ...base,
      inspect: true,
      select: { type: "point" as const },
      zoom: true,
      oninspect: vi.fn(),
      onselect: vi.fn(),
      onzoom: vi.fn(),
      ondiagnostic,
    });
    await settled(container);
    expect(diagnostics.map((d) => d.code)).not.toContain("INTERACTION_HANDLER_WITHOUT_CAPABILITY");
  });

  it("does not advise about handlers that were never passed", async () => {
    const { diagnostics, ondiagnostic } = collect();
    const { container } = render(GGPlot, { ...base, ondiagnostic });
    await settled(container);
    expect(diagnostics.map((d) => d.code)).not.toContain("INTERACTION_HANDLER_WITHOUT_CAPABILITY");
  });

  it("keeps the passive controller-consumer pattern advisory-free", async () => {
    // Controller state with locally-disabled capabilities is the documented
    // linked-view pattern (PassiveControllerConsumerPlot) — never advised.
    const { diagnostics, ondiagnostic } = collect();
    const interaction = createPlotInteraction<string>();
    const { container } = render(GGPlot, {
      ...base,
      interaction,
      interactionScope: { keys: "row-id" },
      ondiagnostic,
    });
    await settled(container);
    expect(diagnostics.map((d) => d.code)).not.toContain("INTERACTION_HANDLER_WITHOUT_CAPABILITY");
  });

  it("advises once per plot instance, not once per reactive update", async () => {
    const { diagnostics, ondiagnostic } = collect();
    const view = render(GGPlot, { ...base, onselect: vi.fn(), ondiagnostic });
    await expect
      .poll(
        () => diagnostics.filter((d) => d.code === "INTERACTION_HANDLER_WITHOUT_CAPABILITY").length,
      )
      .toBe(1);
    await view.rerender({ height: 340 });
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(
      diagnostics.filter((d) => d.code === "INTERACTION_HANDLER_WITHOUT_CAPABILITY"),
    ).toHaveLength(1);
  });

  it("falls back to a dev console warning when no ondiagnostic handler is set", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {
      /* swallow the dev fallback while asserting on it */
    });
    try {
      render(GGPlot, { ...base, onselect: () => {} });
      await expect
        .poll(() =>
          warn.mock.calls.some((call) =>
            String(call[0]).includes("INTERACTION_HANDLER_WITHOUT_CAPABILITY"),
          ),
        )
        .toBe(true);
    } finally {
      warn.mockRestore();
    }
  });
});

describe("deprecated plot-level key advisory", () => {
  it("advises DEPRECATED_PLOT_PROP when GGPlot key is set", async () => {
    const { diagnostics, ondiagnostic } = collect();
    render(GGPlot, {
      ...base,
      // oxlint-disable-next-line typescript/no-deprecated -- dual-read under test
      key: "id",
      ondiagnostic,
    });
    await expect
      .poll(() => diagnostics.find((d) => d.code === "DEPRECATED_PLOT_PROP" && d.prop === "key"))
      .toMatchObject({
        severity: "advisory",
        prop: "key",
        since: "0.21.0",
        removeIn: "0.22.0",
      });
  });

  it("stays silent when identity comes from createPlotInteraction", async () => {
    const { diagnostics, ondiagnostic } = collect();
    const interaction = createPlotInteraction<string>({ identity: "id" });
    const { container } = render(GGPlot, {
      ...base,
      interaction,
      interactionScope: { keys: "row-id" },
      ondiagnostic,
    });
    await settled(container);
    expect(
      diagnostics.filter(
        (d) => d.code === "DEPRECATED_PLOT_PROP" && "prop" in d && d.prop === "key",
      ),
    ).toHaveLength(0);
  });
});
