/**
 * Inspect advisory delivery through a mounted <GGPlot> (#1206, expanded):
 * the pure collectors in inspect-geom-advisories.ts are unit-tested in
 * inspect-geom-advisories.test.ts; this file pins the plot-engine wire-up —
 * registry/prop layers → assembled().layers → deliverAdvisoriesOnce →
 * ondiagnostic — plus the config-diagnostic path for faceted zoom.
 *
 * Browser lane on purpose: every delivery path runs inside $effect, which
 * svelte/server render() never executes, so these assertions would be
 * vacuous in the SSR lane.
 */
import { registerErrorbar, registerViolin } from "@ggts-sh/core";
import { describe, expect, it } from "vitest";

import GGPlot from "../../src/lib/GGPlot.svelte";
import InspectGeomAdvisoriesFixture from "../fixtures/InspectGeomAdvisoriesFixture.svelte";
import { withGrammarAsSpec } from "../helpers/ggplot-input.js";
import { render } from "../helpers/render.js";
import { collect, settled } from "../helpers/diagnostic-harness.js";

// Violin / errorbar need their package-level registrars (stat + geom batch);
// the browser lane setup registers geoms, stats, and color kinds only.
registerViolin();
registerErrorbar();

const rows = [
  { id: "a", x: 1, y: 10, label: "10" },
  { id: "b", x: 2, y: 20, label: "20" },
  { id: "c", x: 3, y: 15, label: "15" },
];
const size = { width: 480, height: 320 };
const aes = { x: "x", y: "y" };

const X_GUIDE_CODES = [
  "INTERACTION_INSPECT_X_ON_COL",
  "INTERACTION_INSPECT_X_ON_BAR",
  "INTERACTION_INSPECT_X_BISECTS_COL_LABELS",
  "INTERACTION_INSPECT_X_BISECTS_BAR_LABELS",
] as const;

// geom "bar" only supports count/bin stats — discrete x, no y.
const categoricalRows = [
  { id: "a", cat: "one", label: "one", labelY: 1 },
  { id: "b", cat: "two", label: "two", labelY: 1 },
  { id: "c", cat: "two", label: "two", labelY: 1 },
  { id: "d", cat: "three", label: "three", labelY: 1 },
];

describe("inspect x-guide advisories on bar/col (#1206)", () => {
  it("fires X_ON_COL for mode xy with a GeomCol child component", async () => {
    const { diagnostics, ondiagnostic } = collect();
    render(InspectGeomAdvisoriesFixture, {
      data: rows,
      aes,
      inspect: { mode: "xy" as const },
      ondiagnostic,
      ...size,
    });
    await expect
      .poll(() => diagnostics.find((d) => d.code === "INTERACTION_INSPECT_X_ON_COL"))
      .toMatchObject({ severity: "advisory", prop: "inspect.mode", actual: "xy" });
  });

  it("escalates to BISECTS_COL_LABELS when GeomText value labels are present", async () => {
    const { diagnostics, ondiagnostic } = collect();
    const { container } = render(InspectGeomAdvisoriesFixture, {
      data: rows,
      aes,
      inspect: { mode: "xy" as const },
      withLabels: true,
      ondiagnostic,
      ...size,
    });
    await expect
      .poll(() => diagnostics.find((d) => d.code === "INTERACTION_INSPECT_X_BISECTS_COL_LABELS"))
      .toMatchObject({ severity: "warning", prop: "inspect.mode", actual: "xy" });
    await settled(container);
    // The stronger bisect warning REPLACES the plain-geom advisory.
    expect(diagnostics.map((d) => d.code)).not.toContain("INTERACTION_INSPECT_X_ON_COL");
  });

  it("fires X_ON_BAR for mode xy via the layers prop form", async () => {
    const { diagnostics, ondiagnostic } = collect();
    render(GGPlot, {
      data: categoricalRows,
      layers: [{ geom: "bar" as const, aes: { x: { field: "cat" } } }],
      inspect: { mode: "xy" as const },
      ondiagnostic,
      ...size,
    });
    await expect
      .poll(() => diagnostics.find((d) => d.code === "INTERACTION_INSPECT_X_ON_BAR"))
      .toMatchObject({ severity: "advisory", prop: "inspect.mode", actual: "xy" });
  });

  it("escalates to BISECTS_BAR_LABELS for layers-prop bar + text labels", async () => {
    const { diagnostics, ondiagnostic } = collect();
    const { container } = render(GGPlot, {
      data: categoricalRows,
      layers: [
        { geom: "bar" as const, aes: { x: { field: "cat" } } },
        {
          geom: "text" as const,
          aes: { x: { field: "cat" }, y: { field: "labelY" }, label: { field: "label" } },
        },
      ],
      inspect: { mode: "xy" as const },
      ondiagnostic,
      ...size,
    });
    await expect
      .poll(() => diagnostics.find((d) => d.code === "INTERACTION_INSPECT_X_BISECTS_BAR_LABELS"))
      .toMatchObject({ severity: "warning", prop: "inspect.mode", actual: "xy" });
    await settled(container);
    expect(diagnostics.map((d) => d.code)).not.toContain("INTERACTION_INSPECT_X_ON_BAR");
  });

  it("fires for mode x, the other x-guide mode", async () => {
    const { diagnostics, ondiagnostic } = collect();
    render(GGPlot, {
      data: rows,
      aes,
      layers: [{ geom: "col" as const }],
      inspect: { mode: "x" as const },
      ondiagnostic,
      ...size,
    });
    await expect
      .poll(() => diagnostics.find((d) => d.code === "INTERACTION_INSPECT_X_ON_COL"))
      .toMatchObject({ severity: "advisory", actual: "x" });
  });

  it("stays silent when mode resolves to auto (bare inspect: true)", async () => {
    const { diagnostics, ondiagnostic } = collect();
    const { container } = render(GGPlot, {
      data: rows,
      aes,
      layers: [{ geom: "col" as const }],
      inspect: true,
      ondiagnostic,
      ...size,
    });
    await settled(container);
    for (const code of X_GUIDE_CODES) expect(diagnostics.map((d) => d.code)).not.toContain(code);
  });

  it("stays silent for mode exact", async () => {
    const { diagnostics, ondiagnostic } = collect();
    const { container } = render(GGPlot, {
      data: rows,
      aes,
      layers: [{ geom: "col" as const }],
      inspect: { mode: "exact" as const },
      ondiagnostic,
      ...size,
    });
    await settled(container);
    for (const code of X_GUIDE_CODES) expect(diagnostics.map((d) => d.code)).not.toContain(code);
  });

  // #1409 — band-axis advisories still fire under coord_flip (not a false positive).
  // coord is children-only on GGPlot (#704); fold via withGrammarAsSpec.
  it("fires X_ON_COL for mode x under coord=flip (band guide remains)", async () => {
    const { diagnostics, ondiagnostic } = collect();
    render(
      GGPlot,
      withGrammarAsSpec({
        data: rows,
        aes,
        layers: [{ geom: "col" as const }],
        coord: "flip" as const,
        inspect: { mode: "x" as const },
        ondiagnostic,
        ...size,
      }),
    );
    await expect
      .poll(() => diagnostics.find((d) => d.code === "INTERACTION_INSPECT_X_ON_COL"))
      .toMatchObject({ severity: "advisory", actual: "x" });
  });

  it("stays silent for mode y under coord=flip (value axis, not the x band)", async () => {
    const { diagnostics, ondiagnostic } = collect();
    const { container } = render(
      GGPlot,
      withGrammarAsSpec({
        data: rows,
        aes,
        layers: [{ geom: "col" as const }],
        coord: "flip" as const,
        inspect: { mode: "y" as const },
        ondiagnostic,
        ...size,
      }),
    );
    await settled(container);
    for (const code of X_GUIDE_CODES) expect(diagnostics.map((d) => d.code)).not.toContain(code);
  });

  it("delivers once per plot instance, not once per reactive update", async () => {
    const { diagnostics, ondiagnostic } = collect();
    const view = render(GGPlot, {
      data: rows,
      aes,
      layers: [{ geom: "col" as const }],
      inspect: { mode: "xy" as const },
      ondiagnostic,
      ...size,
    });
    await expect
      .poll(() => diagnostics.filter((d) => d.code === "INTERACTION_INSPECT_X_ON_COL").length)
      .toBe(1);
    await view.rerender({ height: 340 });
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(diagnostics.filter((d) => d.code === "INTERACTION_INSPECT_X_ON_COL")).toHaveLength(1);
  });
});

describe("high-cardinality discrete color + inspect (#1274)", () => {
  const categories = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `r${i}`,
      x: i,
      y: i * 2,
      series: `s${i}`,
    }));

  it("fires at the threshold of 16 discrete color categories", async () => {
    const { diagnostics, ondiagnostic } = collect();
    render(GGPlot, {
      data: categories(16),
      aes: { x: "x", y: "y", color: "series" },
      layers: [{ geom: "point" as const }],
      inspect: true,
      ondiagnostic,
      ...size,
    });
    // Needs the trained model — poll rather than drain.
    await expect
      .poll(() =>
        diagnostics.find((d) => d.code === "INTERACTION_INSPECT_HIGH_CARDINALITY_DISCRETE"),
      )
      .toMatchObject({ severity: "advisory", prop: "color", actual: 16 });
  });

  it("stays silent one category below the threshold", async () => {
    const { diagnostics, ondiagnostic } = collect();
    const { container } = render(GGPlot, {
      data: categories(15),
      aes: { x: "x", y: "y", color: "series" },
      layers: [{ geom: "point" as const }],
      inspect: true,
      ondiagnostic,
      ...size,
    });
    await settled(container);
    expect(diagnostics.map((d) => d.code)).not.toContain(
      "INTERACTION_INSPECT_HIGH_CARDINALITY_DISCRETE",
    );
  });

  it("stays silent at 16 categories when inspect is off", async () => {
    const { diagnostics, ondiagnostic } = collect();
    const { container } = render(GGPlot, {
      data: categories(16),
      aes: { x: "x", y: "y", color: "series" },
      layers: [{ geom: "point" as const }],
      ondiagnostic,
      ...size,
    });
    await settled(container);
    expect(diagnostics.map((d) => d.code)).not.toContain(
      "INTERACTION_INSPECT_HIGH_CARDINALITY_DISCRETE",
    );
  });
});

describe("inspect axis-guide advisories on distribution/interval geoms (#1528)", () => {
  // Violin/boxplot need continuous y and discrete x; synthetic rows are enough
  // for the advisory path (it keys on assembled layer geom names only).
  const distributionRows = [
    { id: "a", run: "Jun 5", value: 1.2 },
    { id: "b", run: "Jun 5", value: 1.5 },
    { id: "c", run: "Jun 7", value: 0.9 },
    { id: "d", run: "Jun 7", value: 1.1 },
  ];
  const distributionAes = { x: "run", y: "value" };

  it("fires AXIS_ON_VIOLIN for explicit mode x on GeomViolin layers", async () => {
    const { diagnostics, ondiagnostic } = collect();
    render(GGPlot, {
      data: distributionRows,
      aes: distributionAes,
      layers: [{ geom: "violin" as const }],
      inspect: { mode: "x" as const },
      ondiagnostic,
      ...size,
    });
    await expect
      .poll(() => diagnostics.find((d) => d.code === "INTERACTION_INSPECT_AXIS_ON_VIOLIN"))
      .toMatchObject({ severity: "advisory", prop: "inspect.mode", actual: "x" });
  });

  it("stays silent when mode is auto (advisory gate; exactness is pure unit-tested)", async () => {
    const { diagnostics, ondiagnostic } = collect();
    const { container } = render(GGPlot, {
      data: distributionRows,
      aes: distributionAes,
      layers: [{ geom: "violin" as const }],
      inspect: true,
      ondiagnostic,
      ...size,
    });
    await settled(container);
    expect(diagnostics.map((d) => d.code)).not.toContain("INTERACTION_INSPECT_AXIS_ON_VIOLIN");
  });

  it("fires AXIS_ON_ERRORBAR for mode xy on errorbar layers", async () => {
    const { diagnostics, ondiagnostic } = collect();
    render(GGPlot, {
      data: [
        { id: "a", run: "A", y: 1, ymin: 0.5, ymax: 1.5 },
        { id: "b", run: "B", y: 2, ymin: 1.5, ymax: 2.5 },
      ],
      aes: { x: "run", y: "y", ymin: "ymin", ymax: "ymax" },
      layers: [{ geom: "errorbar" as const }],
      inspect: { mode: "xy" as const },
      ondiagnostic,
      ...size,
    });
    await expect
      .poll(() => diagnostics.find((d) => d.code === "INTERACTION_INSPECT_AXIS_ON_ERRORBAR"))
      .toMatchObject({ severity: "advisory", actual: "xy" });
  });
});

describe("faceted zoom config diagnostic", () => {
  const facetedRows = rows.map((r, i) => ({ ...r, g: i < 2 ? "p1" : "p2" }));

  it("warns INTERVAL_FACET_UNSUPPORTED when zoom meets a faceted plot", async () => {
    const { diagnostics, ondiagnostic } = collect();
    render(
      GGPlot,
      withGrammarAsSpec({
        data: facetedRows,
        aes,
        layers: [{ geom: "point" as const }],
        facet: { wrap: "g" },
        zoom: true,
        ondiagnostic,
        ...size,
      }),
    );
    // Config diagnostics re-deliver on every interactionConfig() recompute —
    // assert presence, never a count.
    await expect
      .poll(() => diagnostics.some((d) => d.code === "INTERACTION_INTERVAL_FACET_UNSUPPORTED"))
      .toBe(true);
    expect(
      diagnostics.find((d) => d.code === "INTERACTION_INTERVAL_FACET_UNSUPPORTED"),
    ).toMatchObject({ severity: "warning", prop: "zoom" });
  });

  it("stays silent for zoom on an unfaceted plot", async () => {
    const { diagnostics, ondiagnostic } = collect();
    const { container } = render(GGPlot, {
      data: rows,
      aes,
      layers: [{ geom: "point" as const }],
      zoom: true,
      ondiagnostic,
      ...size,
    });
    await settled(container);
    expect(diagnostics.map((d) => d.code)).not.toContain("INTERACTION_INTERVAL_FACET_UNSUPPORTED");
  });
});
