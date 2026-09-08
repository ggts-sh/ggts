import { runPipeline, type AxisGuidePlan } from "@ggts-sh/core";
import { describe, expect, it } from "vitest";

import GGPlot from "../src/lib/GGPlot.svelte";
import { createPlotInteraction } from "../src/lib/interaction/controller.svelte.js";
import GGPlotHydrationFixture from "./fixtures/GGPlotHydrationFixture.svelte";
import HydrationFixture from "./fixtures/HydrationFixture.svelte";
import QuickstartSsrFixture from "./fixtures/QuickstartSsrFixture.svelte";
import { withGrammarAsSpec } from "./helpers/ggplot-input.js";
import { renderSsrFixture } from "./helpers/ssr.js";

const rows = [
  { x: 1, y: 2 },
  { x: 2, y: 4 },
];

describe("SSR release fixture", () => {
  it("renders a chart without DOM globals and retains Svelte hydration markers", () => {
    const fixture = renderSsrFixture(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      width: 480,
      height: 320,
    });

    expect(fixture.body).toContain("gg-plot-root");
    expect(fixture.body).toContain("gg-plot");
    expect(fixture.body).toContain("<!--[-->");
    expect(fixture.html).toMatch(/^<!doctype html>/);
  });

  it("server-renders the declaration-only Quickstart with responsive defaults and its accessible name", () => {
    const fixture = renderSsrFixture(QuickstartSsrFixture, {});

    expect(fixture.body).toContain('data-gg-ready="false"');
    expect(fixture.body).toContain('width="832" height="400"');
    expect(fixture.body).toContain(
      'aria-label="Fuel economy decreases as vehicle weight increases"',
    );
  });

  it('keeps data-gg-ready="false" during SSR for fixed-width SVG plots (decision 0009)', () => {
    // $effect never runs on the server; prerendered HTML must not claim ready
    // so VR / screenshot tooling waits for the post-hydration committed flush.
    const fixture = renderSsrFixture(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      width: 480,
      height: 320,
    });

    expect(fixture.body).toContain('data-gg-ready="false"');
    expect(fixture.body).not.toContain('data-gg-ready="true"');
  });

  it("server-renders the same measured temporal guide labels as the core plan", () => {
    const spec = {
      data: {
        values: [
          { when: "2024-01-01T00:00:00Z", value: 1 },
          { when: "2024-01-15T00:00:00Z", value: 2 },
          { when: "2024-02-01T00:00:00Z", value: 3 },
        ],
      },
      layers: [{ geom: "line" as const, aes: { x: "when", y: "value" } }],
      scales: {
        x: {
          type: "time" as const,
          temporalKind: "datetime" as const,
          dateBreaks: "2 weeks",
          dateLabels: "%e %b",
          locale: "en-GB",
          timezone: "Europe/London",
        },
      },
    };
    const model = runPipeline(spec, { width: 480, height: 320 });
    const fixture = renderSsrFixture(GGPlot, { spec, width: 480, height: 320 });
    const guide = model.guidePlans.find(
      (plan): plan is AxisGuidePlan => plan.type === "axis" && plan.aesthetic === "x",
    );

    expect(guide).toBeDefined();
    for (const tick of guide!.ticks.filter((entry) => entry.kind === "major")) {
      expect(fixture.body).toContain(tick.label);
      expect(fixture.body).toContain(`<title>${tick.fullLabel}</title>`);
    }
  });

  it("server-renders binned colorsteps from the same semantic guide payload", () => {
    // scales/guides are no longer GGPlot props (#704) — fold into PortableSpec.
    const fixture = renderSsrFixture(
      GGPlot,
      withGrammarAsSpec({
        data: [
          { x: 1, y: 1, score: 1 },
          { x: 2, y: 2, score: 10 },
          { x: 3, y: 3, score: 100 },
        ],
        aes: { x: "x", y: "y", color: "score" },
        layers: [{ geom: "point" }],
        scales: {
          color: {
            type: "binned",
            breaks: [1, 10, 100],
            range: ["#111", "#eee"],
          },
        },
        guides: {
          color: { type: "colorsteps", position: "bottom", direction: "horizontal" },
        },
        width: 480,
        height: 320,
      }),
    );

    expect(fixture.body.match(/gg-legend-step/g)).toHaveLength(2);
    expect(fixture.body).toContain("gg-legend-bottom gg-legend-horizontal");
    expect(fixture.body).toContain("1–10");
    expect(fixture.body).toContain("10–100");
  });

  it("renders the canonical browser hydration fixture", () => {
    const fixture = renderSsrFixture(HydrationFixture, { label: "Selected", count: 2 });
    expect(fixture.body).toContain('data-hydrated="false"');
    expect(fixture.body).toContain("Selected: 2");
    expect(fixture.body).toContain("<!--[-->");
  });

  it("server-renders the same interactive GGPlot fixture used by the browser hydration gate", () => {
    const fixture = renderSsrFixture(GGPlotHydrationFixture, {});
    expect(fixture.body).toContain("data-ggplot-hydration-fixture");
    expect(fixture.body).toContain('data-hydrated="false"');
    expect(fixture.body).toContain('aria-label="Hydrated scatter plot"');
    expect(fixture.body).toContain("gg-capture");
    expect(fixture.body).toContain("<!--[-->");
  });

  it("server-renders with pre-populated non-union interval state (#165)", () => {
    const interaction = createPlotInteraction<number>();
    const interactionScope = { keys: "row-id", intervals: "restored-brush" } as const;
    interaction.setInterval(
      {
        panelId: "restored-panel",
        preset: "independent",
        domains: { x: { kind: "linear", domain: [1, 2] } },
        keys: [1],
      },
      { scope: interactionScope, source: "programmatic" },
    );

    const fixture = renderSsrFixture(GGPlot, {
      data: [
        { id: 1, x: 1, y: 2 },
        { id: 2, x: 2, y: 4 },
      ],
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      select: { type: "interval", persistent: true },
      interaction,
      interactionScope,
      width: 480,
      height: 320,
    });

    expect(fixture.body).toContain("gg-plot-root");
  });
});
