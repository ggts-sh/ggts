/**
 * Compact chrome behavior through the public pipeline: a bottom legend's
 * reserved block shrinks with layout height while type sizes stay fixed, and
 * theme legend-title placement reaches discrete legends without overriding
 * explicit guide settings.
 *
 * The reserve is measured as plain panel height minus legend panel height, so
 * the tests pin the resulting scene geometry instead of recomputing any gap
 * formula or importing layout constants.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg, guideLegend } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";
import type { SceneDiscreteLegend } from "../src/scene.ts";

const rows = [
  { x: 1, y: 2, region: "North", g: "A" },
  { x: 2, y: 4, region: "South", g: "B" },
  { x: 3, y: 3, region: "North", g: "A" },
  { x: 4, y: 5, region: "South", g: "B" },
];

const size = (height: number) => ({ width: 420, height });

/**
 * Difference in panel height between the same chart without and with a
 * bottom discrete legend. This is the legend block plus its gap and edge pad:
 * the consumer-visible vertical space the legend reserves.
 */
function chartPair(
  facet: boolean,
  height: number,
): {
  plainPanelHeight: number;
  panelHeight: number;
  legend: SceneDiscreteLegend;
  reserved: number;
} {
  const plain = runPipeline(
    facet
      ? gg(rows, aes({ x: "x", y: "y" }))
          .geomPoint()
          .facet({ wrap: "g" })
          .spec()
      : gg(rows, aes({ x: "x", y: "y" }))
          .geomPoint()
          .spec(),
    size(height),
  ).scene;
  const plot = gg(rows, aes({ x: "x", y: "y", color: "region" }))
    .geomPoint()
    .guides({ color: guideLegend({ position: "bottom" }) });
  const decorated = runPipeline(
    facet ? plot.facet({ wrap: "g" }).spec() : plot.spec(),
    size(height),
  ).scene;
  const legend = decorated.legends[0];
  if (legend?.type !== "discrete") throw new Error("expected a discrete bottom legend");
  const plainPanelHeight = plain.panels[0]!.height;
  const panelHeight = decorated.panels[0]!.height;
  return {
    plainPanelHeight,
    panelHeight,
    legend,
    reserved: plainPanelHeight - panelHeight,
  };
}

describe("compact bottom legend spacing", () => {
  it("reclaims panel height on a short plot without shrinking type", () => {
    const compact = chartPair(false, 300);
    const tall = chartPair(false, 800);

    expect(compact.reserved).toBeLessThan(tall.reserved);
    // A short plot keeps more panel than the tall-layout legend reserve would allow.
    expect(compact.panelHeight).toBeGreaterThan(compact.plainPanelHeight - tall.reserved);
    expect(compact.legend.height).toBe(tall.legend.height);
    expect(compact.legend.titleSize).toBe(tall.legend.titleSize);
    expect(compact.legend.labelSize).toBe(tall.legend.labelSize);
    expect(compact.legend.labelSize).toBeGreaterThan(0);
  });

  it("grows the reserved block with height and caps it at tall layouts", () => {
    const short = chartPair(false, 300);
    const medium = chartPair(false, 600);
    const tall = chartPair(false, 800);
    const veryTall = chartPair(false, 1600);

    expect(short.reserved).toBeLessThan(medium.reserved);
    expect(medium.reserved).toBeLessThan(tall.reserved);
    expect(tall.reserved).toBe(veryTall.reserved);
    expect(tall.legend.height).toBe(veryTall.legend.height);
  });

  it("keeps the right legend reserve independent of height", () => {
    const rightReserve = (height: number) => {
      const plain = runPipeline(
        gg(rows, aes({ x: "x", y: "y" }))
          .geomPoint()
          .spec(),
        { width: 720, height },
      ).scene;
      const decorated = runPipeline(
        gg(rows, aes({ x: "x", y: "y", color: "region" }))
          .geomPoint()
          .guides({ color: guideLegend({ position: "right" }) })
          .spec(),
        { width: 720, height },
      ).scene;
      return plain.panels[0]!.width - decorated.panels[0]!.width;
    };
    expect(rightReserve(300)).toBe(rightReserve(800));
    expect(rightReserve(300)).toBeGreaterThan(0);
  });

  it("uses the same compact reserve below facet grids", () => {
    const compact = chartPair(true, 300);
    const tall = chartPair(true, 800);
    const veryTall = chartPair(true, 1600);

    expect(compact.reserved).toBeLessThan(tall.reserved);
    expect(tall.reserved).toBe(veryTall.reserved);
    expect(compact.legend.titleSize).toBe(tall.legend.titleSize);
    expect(compact.legend.labelSize).toBe(tall.legend.labelSize);
  });
});

describe("theme legend title placement", () => {
  const legendFor = (themePosition: "left" | undefined, guidePosition?: "top") => {
    const legend = runPipeline(
      gg(rows, aes({ x: "x", y: "y", color: "region" }))
        .geomPoint()
        .theme({
          name: "light",
          ...(themePosition !== undefined && { legendTitlePosition: themePosition }),
        })
        .guides({
          color: guideLegend({
            position: "bottom",
            ...(guidePosition !== undefined && { titlePosition: guidePosition }),
          }),
        })
        .spec(),
      size(800),
    ).scene.legends[0];
    if (legend?.type !== "discrete") throw new Error("expected a discrete legend");
    return legend;
  };

  it("applies the theme placement to a discrete legend", () => {
    expect(legendFor("left").titleHeight).toBe(0);
    expect(legendFor("left").titleX).toBeDefined();
  });

  it("lets an explicit guide placement override the theme", () => {
    const overridden = legendFor("left", "top");
    expect(overridden.titleHeight).toBeGreaterThan(0);
  });
});
