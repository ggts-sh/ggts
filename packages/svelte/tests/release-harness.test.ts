import { describe, expect, it } from "vitest";

import GGPlot from "../src/lib/GGPlot.svelte";
import "../src/lib/host-init.js";
import GenericInteractionPlot from "./fixtures/GenericInteractionPlot.svelte";
import {
  expectAccessible,
  assertNoAccessibilityViolations,
  formatAxeViolations,
} from "./helpers/accessibility.js";
import {
  assertIdReferencesResolve,
  assertUniqueIds,
  getSemanticSnapshot,
} from "./helpers/semantics.js";
import { render } from "./helpers/render.js";

describe("release accessibility harness", () => {
  it("compiles semantic key inference for fields and accessors", () => {
    const { container } = render(GenericInteractionPlot);
    expect(container.querySelectorAll(".gg-plot-root")).toHaveLength(5);
  });

  it("reports actionable axe violation details", () => {
    const report = formatAxeViolations([
      {
        id: "button-name",
        impact: "critical",
        help: "Buttons must have discernible text",
        helpUrl: "https://dequeuniversity.com/rules/axe/button-name",
        nodes: [{ target: ["#save"], failureSummary: "Fix the button label" }],
      },
    ]);

    expect(report).toContain("button-name (critical)");
    expect(report).toContain("#save");
    expect(report).toContain("Fix the button label");
  });

  it("accepts an empty axe result", () => {
    expect(() => {
      assertNoAccessibilityViolations({ violations: [] });
    }).not.toThrow();
  });

  it("rejects duplicate ids and unresolved ARIA references", () => {
    const host = document.createElement("div");
    host.innerHTML = `
      <p id="description">Chart description</p>
      <button id="duplicate" aria-describedby="description missing">Inspect</button>
      <span id="duplicate">Duplicate</span>
    `;

    expect(() => {
      assertUniqueIds(host);
    }).toThrow(/duplicate/);
    expect(() => {
      assertIdReferencesResolve(host);
    }).toThrow(/missing/);
  });

  it("captures a stable semantic snapshot without presentation markup", () => {
    const host = document.createElement("div");
    host.innerHTML = `
      <section aria-label="Sales chart">
        <button aria-pressed="true">North</button>
        <p role="status" aria-live="polite">3 selected</p>
        <svg aria-hidden="true"><circle cx="2" cy="2" r="2"></circle></svg>
      </section>
    `;

    expect(getSemanticSnapshot(host)).toEqual([
      { tag: "section", role: null, name: "Sales chart", states: {} },
      { tag: "button", role: null, name: "North", states: { pressed: "true" } },
      {
        tag: "p",
        role: "status",
        name: "3 selected",
        states: { live: "polite" },
      },
    ]);
  });

  it("audits a real chart and verifies chart-local ids", async () => {
    const { container } = render(GGPlot, {
      data: [
        { x: 1, y: 2 },
        { x: 2, y: 3 },
      ],
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      labels: { title: "Accessible scatter plot" },
      width: 480,
      height: 320,
    });

    assertUniqueIds(container);
    assertIdReferencesResolve(container);
    await expectAccessible(container);
  });
});
