/**
 * Axis tick geometry + label anchors (no ARIA — that lives on SceneView).
 */
import { describe, expect, it } from "vitest";

import { resolveTheme } from "@ggts-sh/core";
import { aes, gg } from "@ggts-sh/spec";

import Axis from "../../src/lib/scene/Axis.svelte";
import { modelFor } from "../helpers/model.js";
import { render } from "../helpers/render.js";

const rows = [
  { x: 1, y: 10 },
  { x: 2, y: 20 },
  { x: 3, y: 15 },
];

describe("Axis", () => {
  const orientCases = [
    {
      orient: "x" as const,
      axisKey: "axisX" as const,
      groupSelector: "g.gg-axis-x",
      groupTransform: (panel: import("@ggts-sh/core").ScenePanel) =>
        `translate(${panel.x},${panel.y + panel.height})`,
      tickTransform: (pos: number) => `translate(${pos},0)`,
      anchor: "middle",
    },
    {
      orient: "y" as const,
      axisKey: "axisY" as const,
      groupSelector: "g.gg-axis-y",
      groupTransform: (panel: import("@ggts-sh/core").ScenePanel) =>
        `translate(${panel.x},${panel.y})`,
      tickTransform: (pos: number) => `translate(0,${pos})`,
      anchor: "end",
    },
  ];

  it.each(orientCases)(
    "places $orient ticks at tick.pos with $anchor-anchored labels",
    ({ orient, axisKey, groupSelector, groupTransform, tickTransform, anchor }) => {
      const model = modelFor(
        gg(rows, aes({ x: "x", y: "y" }))
          .geomPoint()
          .spec(),
      );
      const panel = model.scene.panels[0];
      expect(panel).toBeDefined();
      if (panel === undefined) throw new Error("expected panel");
      const ticks = panel[axisKey];
      expect(ticks).not.toBeNull();
      if (ticks === null) throw new Error(`expected ${axisKey} ticks`);
      const { container } = render(Axis, {
        ticks,
        orient,
        panel,
        theme: model.scene.theme,
      });

      const group = container.querySelector(groupSelector);
      expect(group).not.toBeNull();
      expect(group?.getAttribute("transform")).toBe(groupTransform(panel));

      const tickGroups = [...container.querySelectorAll("g.gg-tick")];
      expect(tickGroups.length).toBe(ticks.length);
      for (let i = 0; i < ticks.length; i++) {
        const tick = ticks[i];
        expect(tick).toBeDefined();
        if (tick === undefined) throw new Error("expected tick");
        expect(tickGroups[i]?.getAttribute("transform")).toBe(tickTransform(tick.pos));
        expect(tickGroups[i]?.querySelector("title")?.textContent).toBe(tick.fullLabel);
        const label = tickGroups[i]?.querySelector("text");
        if (tick.label !== "") {
          expect(label?.getAttribute("text-anchor")).toBe(anchor);
          expect(label?.textContent).toBe(tick.label);
        }
      }
      model.dispose();
    },
  );

  it("renders wrapped band labels as one tspan per line (Codex P2)", () => {
    const model = modelFor(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .spec(),
    );
    const panel = model.scene.panels[0];
    if (panel === undefined) throw new Error("expected panel");
    const ticks = [
      {
        pos: 40,
        value: "a",
        label: "Corrección errores",
        fullLabel: "Corrección errores",
        kind: "major" as const,
        lines: ["Corrección", "errores"],
      },
    ];
    const { container } = render(Axis, {
      ticks,
      orient: "x" as const,
      panel,
      theme: model.scene.theme,
    });
    const tspans = [...container.querySelectorAll("g.gg-tick text tspan")];
    expect(tspans).toHaveLength(2);
    expect(tspans.map((t) => t.textContent)).toEqual(["Corrección", "errores"]);
    expect(container.querySelector("g.gg-tick text")?.getAttribute("text-anchor")).toBe("middle");
    model.dispose();
  });

  it("renders rotated band labels with a rotate() transform anchored at the tick end (Codex P2)", () => {
    const model = modelFor(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .spec(),
    );
    const panel = model.scene.panels[0];
    if (panel === undefined) throw new Error("expected panel");
    const ticks = [
      {
        pos: 40,
        value: "a",
        label: "Corrección",
        fullLabel: "Corrección",
        kind: "major" as const,
        angle: -45,
      },
    ];
    const { container } = render(Axis, {
      ticks,
      orient: "x" as const,
      panel,
      theme: model.scene.theme,
    });
    const label = container.querySelector("g.gg-tick text");
    expect(label?.getAttribute("transform")).toContain("rotate(-45)");
    expect(label?.getAttribute("text-anchor")).toBe("end");
    expect(label?.textContent).toBe("Corrección");
    model.dispose();
  });

  it("places labels next to the axis line when their tick marks are hidden", () => {
    const model = modelFor(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .spec(),
    );
    const panel = model.scene.panels[0];
    if (panel === undefined) throw new Error("expected panel");
    const ticks = [
      {
        pos: 40,
        value: 1,
        label: "visible label",
        fullLabel: "visible label",
        kind: "major" as const,
        showTick: false,
      },
    ];
    const tickTheme = resolveTheme({
      name: "light",
      ticksX: true,
      ticksY: true,
      tickLength: 8,
    });
    const x = render(Axis, { ticks, orient: "x" as const, panel, theme: tickTheme });
    expect(x.container.querySelector("g.gg-tick text")?.getAttribute("y")).toBe("3");
    const y = render(Axis, { ticks, orient: "y" as const, panel, theme: tickTheme });
    expect(y.container.querySelector("g.gg-tick text")?.getAttribute("x")).toBe("-3");
    model.dispose();
  });

  it("omits label text when tick.label is empty (geometry-only tick)", () => {
    const model = modelFor(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .spec(),
    );
    const panel = model.scene.panels[0];
    expect(panel).toBeDefined();
    if (panel === undefined) throw new Error("expected panel");
    const ticks = [
      { pos: 10, value: 1, label: "", fullLabel: "", kind: "minor" as const },
      { pos: 40, value: 2, label: "mid", fullLabel: "middle value", kind: "major" as const },
    ];
    const { container } = render(Axis, {
      ticks,
      orient: "x" as const,
      panel,
      theme: model.scene.theme,
    });
    const tickGroups = [...container.querySelectorAll("g.gg-tick")];
    expect(tickGroups).toHaveLength(2);
    expect(tickGroups[0]?.querySelector("text")).toBeNull();
    expect(tickGroups[0]?.querySelector("title")).toBeNull();
    expect(tickGroups[1]?.querySelector("title")?.textContent).toBe("middle value");
    expect(tickGroups[1]?.querySelector("text")?.textContent).toBe("mid");
    model.dispose();
  });
});
