import { describe, expect, it } from "bun:test";

import { aes, gg, guideAxis, guideNone } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.js";

import { renderToSVGString } from "../src/render-svg-full.js";

const rows = [
  { x: 1, y: 2, region: "North" },
  { x: 2, y: 4, region: "South" },
  { x: 3, y: 3, region: "North" },
];

describe("responsive guide planning", () => {
  it("applies axis title/tick/label presentation and axis suppression without changing scale plans", () => {
    const styled = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .guides({ x: guideAxis({ title: "Observation", showTicks: false, showLabels: false }) })
        .spec(),
      { width: 640, height: 360 },
    );
    expect(styled.scene.axes.x.title).toBe("Observation");
    expect(styled.scene.panels[0]?.axisX?.every((tick) => tick.showTick === false)).toBe(true);
    expect(styled.scene.panels[0]?.axisX?.every((tick) => tick.showLabel === false)).toBe(true);
    expect(styled.guidePlans.some((plan) => plan.type === "axis" && plan.aesthetic === "x")).toBe(
      true,
    );
    const hidden = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .guides({ x: guideNone() })
        .spec(),
      { width: 640, height: 360 },
    );
    expect(hidden.scene.panels[0]?.axisX).toBeNull();
    expect(hidden.scene.axes.x.title).toBe("");
  });

  it("preserves a scale-local band label mode when a top-level axis guide only adds appearance", () => {
    const categories = [
      { category: "A deliberately long northern category", y: 1 },
      { category: "A deliberately long southern category", y: 2 },
    ];
    const result = runPipeline(
      gg(categories, aes({ x: "category", y: "y" }))
        .geomPoint()
        .scales({ x: { type: "band", guide: { mode: "wrap", wrap: 3 } } })
        .guides({ x: guideAxis({ title: "Category" }) })
        .spec(),
      { width: 280, height: 300 },
    );
    const plan = result.guidePlans.find(
      (candidate) => candidate.type === "axis" && candidate.aesthetic === "x",
    );
    expect(plan?.type).toBe("axis");
    if (plan?.type !== "axis") return;
    expect(plan.bandLabelMode).toBe("wrapped");
    expect(plan.bandLabelAuthorPinned).toBe(true);
  });

  it("keeps rendered label offsets aligned when axis tick marks are hidden", () => {
    const spec = gg(rows, aes({ x: "x", y: "y" }))
      .geomPoint()
      .theme({ name: "light", ticksX: true, ticksY: true, tickLength: 8 })
      .guides({
        x: guideAxis({ showTicks: false, showLabels: true }),
        y: guideAxis({ showTicks: false, showLabels: true }),
      })
      .spec();
    const svg = renderToSVGString(spec, { width: 640, height: 360 });
    expect(svg).toMatch(/gg-axis-x[\s\S]*?<text y="3"/);
    expect(svg).toMatch(/gg-axis-y[\s\S]*?<text x="-3"/);
  });

  it("suppresses band-label diagnostics and presentation plans when labels are hidden", () => {
    const categories = [
      { category: "A deliberately long northern category", y: 1 },
      { category: "A deliberately long southern category", y: 2 },
    ];
    const result = runPipeline(
      gg(categories, aes({ x: "category", y: "y" }))
        .geomPoint()
        .scales({ x: { type: "band" } })
        .guides({ x: guideAxis({ showLabels: false }) })
        .spec(),
      { width: 280, height: 300 },
    );
    const plan = result.guidePlans.find(
      (candidate) => candidate.type === "axis" && candidate.aesthetic === "x",
    );
    expect(plan?.type).toBe("axis");
    if (plan?.type !== "axis") return;
    expect(plan.degraded).toEqual([]);
    expect(plan.bandLabelMode).toBeUndefined();
    expect(result.advisories.filter(({ code }) => code.startsWith("band-label"))).toEqual([]);
    expect(result.scaleDiagnostics.filter(({ code }) => code.startsWith("band-label"))).toEqual([]);
  });

  it("renders explicit band-axis ellipsis without wrapping or rotation", () => {
    const categories = [
      { category: "A deliberately long northern category", y: 1 },
      { category: "A deliberately long southern category", y: 2 },
    ];
    const result = runPipeline(
      gg(categories, aes({ x: "category", y: "y" }))
        .geomPoint()
        .scales({ x: { type: "band" } })
        .guides({ x: guideAxis({ collision: "ellipsis" }) })
        .spec(),
      { width: 220, height: 300 },
    );
    const plan = result.guidePlans.find(
      (candidate) => candidate.type === "axis" && candidate.aesthetic === "x",
    );
    expect(plan?.type).toBe("axis");
    if (plan?.type !== "axis") return;
    expect(plan.bandLabelMode).toBe("single-line");
    expect(result.scene.axes.x.ticks.some((tick) => tick.label.endsWith("…"))).toBe(true);
    expect(
      result.scene.axes.x.ticks.every(
        (tick) => tick.lines === undefined && tick.angle === undefined && tick.fullLabel.length > 0,
      ),
    ).toBe(true);
  });

  it("restores complete unwrapped axis labels when collision:preserve is explicit", () => {
    const categories = [
      { category: "A deliberately long northern category", y: 1 },
      { category: "A deliberately long southern category", y: 2 },
    ];
    const build = gg(categories, aes({ x: "category", y: "y" }))
      .geomPoint()
      .scales({ x: { type: "band" } });
    const automatic = runPipeline(build.spec(), { width: 280, height: 300 });
    const result = runPipeline(build.guides({ x: guideAxis({ collision: "preserve" }) }).spec(), {
      width: 280,
      height: 300,
    });
    expect(
      result.scene.axes.x.ticks.every(
        (tick) =>
          tick.label === tick.fullLabel && tick.lines === undefined && tick.angle === undefined,
      ),
    ).toBe(true);
    expect(result.scene.panels[0]!.x).toBeGreaterThan(automatic.scene.panels[0]!.x);
  });

  it("does not leak the auto wrap/rotate band plan into collision:preserve diagnostics", () => {
    const categories = [
      { category: "A deliberately long northern category", y: 1 },
      { category: "A deliberately long southern category", y: 2 },
    ];
    const build = gg(categories, aes({ x: "category", y: "y" }))
      .geomPoint()
      .scales({ x: { type: "band" } })
      .labs({ x: "Category" });
    // At this width, automatic layout must escalate to wrap or rotate.
    const automatic = runPipeline(build.spec(), { width: 280, height: 300 });
    const automaticPlan = automatic.guidePlans.find(
      (candidate) => candidate.type === "axis" && candidate.aesthetic === "x",
    );
    expect(automaticPlan?.type === "axis" && automaticPlan.bandLabelMode).not.toBe("single-line");

    const result = runPipeline(build.guides({ x: guideAxis({ collision: "preserve" }) }).spec(), {
      width: 280,
      height: 300,
    });
    const plan = result.guidePlans.find(
      (candidate) => candidate.type === "axis" && candidate.aesthetic === "x",
    );
    expect(plan?.type).toBe("axis");
    if (plan?.type !== "axis") return;
    // The rendered labels are always single-line full text (presentForLayout), so
    // the guide plan must say so too — not the auto wrap/rotate plan that never renders.
    expect(plan.bandLabelMode).toBe("single-line");
    expect(result.scene.axes.x.titleOffset).toBeUndefined();
    expect(result.advisories.filter(({ code }) => code.startsWith("band-labels-"))).toEqual([]);
  });

  it("does not report a truncated guide-plan label for an overhanging preserve end category", () => {
    const categories = [
      { category: "A", y: 1 },
      {
        category:
          "A dramatically longer end-of-axis category label that overhangs far past the panel edge",
        y: 2,
      },
    ];
    const result = runPipeline(
      gg(categories, aes({ x: "category", y: "y" }))
        .geomPoint()
        .scales({ x: { type: "band" } })
        .guides({ x: guideAxis({ collision: "preserve" }) })
        .spec(),
      { width: 300, height: 300 },
    );
    const plan = result.guidePlans.find(
      (candidate) => candidate.type === "axis" && candidate.aesthetic === "x",
    );
    expect(plan?.type).toBe("axis");
    if (plan?.type !== "axis") return;
    // The guide plan must report the SAME labels actually rendered — full text,
    // not the end-cap truncated ellipsis that only the pinned-single planner emits.
    expect(plan.ticks.map((tick) => tick.label)).toEqual(
      result.scene.axes.x.ticks.map((tick) => tick.label),
    );
    expect(plan.marginOverflow).toBe(false);
    expect(plan.degraded).not.toContain("band-label-margin-overflow");
  });

  it("reclaims tick-label margins and diagnostics for hidden axes", () => {
    const categories = [
      { category: "A deliberately long northern category", y: 1 },
      { category: "A deliberately long southern category", y: 2 },
    ];
    const build = gg(categories, aes({ x: "category", y: "y" }))
      .geomPoint()
      .scales({ x: { type: "band" } });
    const visible = runPipeline(build.spec(), { width: 280, height: 300 });
    const hidden = runPipeline(build.guides({ x: guideNone() }).spec(), {
      width: 280,
      height: 300,
    });
    expect(hidden.scene.panels[0]!.height).toBeGreaterThan(visible.scene.panels[0]!.height);
    expect(hidden.warnings.filter((warning) => warning.code.startsWith("band-label"))).toEqual([]);
  });
});

/**
 * #700 — rug plots (vertical rules with only aes.x) train a synthetic y
 * domain of [0, 1] so panel-spanning marks have a range. Without an explicit
 * suppress, that domain renders a full 0.0…1.0 y-axis ladder of meaningless
 * ink. guideNone() on y is the supported way to hide it.
 */
describe("rug plot y-axis suppression (#700)", () => {
  const rugRows = [{ longitude: 18.1 }, { longitude: 22.4 }, { longitude: 29.7 }];

  it("default rug still draws a synthetic 0–1 y tick ladder", () => {
    const result = runPipeline(
      gg(rugRows, aes({ x: "longitude" }))
        .geomRule()
        .spec(),
      { width: 640, height: 400 },
    );
    const labels = (result.scene.panels[0]?.axisY ?? []).map((tick) => tick.label);
    expect(labels).toContain("0.0");
    expect(labels).toContain("1.0");
  });

  it("guides.y = none removes the y axis (panel + scene title)", () => {
    const result = runPipeline(
      gg(rugRows, aes({ x: "longitude" }))
        .geomRule()
        .guides({ y: guideNone() })
        .spec(),
      { width: 640, height: 400 },
    );
    expect(result.scene.panels[0]?.axisY).toBeNull();
    expect(result.scene.axes.y.title).toBe("");
    const svg = renderToSVGString(
      gg(rugRows, aes({ x: "longitude" }))
        .geomRule()
        .guides({ y: guideNone() })
        .spec(),
      { width: 640, height: 400 },
    );
    expect(svg).not.toContain(">0.0</text>");
    expect(svg).not.toContain(">1.0</text>");
    // x axis still present for the distribution
    expect(svg).toMatch(/>1[89]</);
  });

  it("scale-local guide: none also hides the y axis", () => {
    const result = runPipeline(
      gg(rugRows, aes({ x: "longitude" }))
        .geomRule()
        .scales({ y: { guide: guideNone() } })
        .spec(),
      { width: 640, height: 400 },
    );
    expect(result.scene.panels[0]?.axisY).toBeNull();
  });
});
