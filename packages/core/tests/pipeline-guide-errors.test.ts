import { describe, expect, it } from "bun:test";

import { aes, gg, guideAxis, guideLegend, guideNone, scaleColorDiscrete } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.js";

const rows = [
  { x: 1, y: 2, region: "North" },
  { x: 2, y: 4, region: "South" },
  { x: 3, y: 3, region: "North" },
];

describe("responsive guide planning", () => {
  it("rejects a guide variant that conflicts with an inferred scale family", () => {
    expect(() =>
      runPipeline(
        gg(rows, aes({ x: "x", y: "y", color: "x" }))
          .geomPoint()
          .guides({ color: guideLegend() })
          .spec(),
        { width: 640, height: 360 },
      ),
    ).toThrow(
      expect.objectContaining({ code: "guide-aesthetic-incompatible", path: "/guides/color" }),
    );
    expect(() =>
      runPipeline(
        gg(rows, aes({ x: "x", y: "y", color: "x" }))
          .geomPoint()
          .scales({ color: { guide: guideLegend() } })
          .spec(),
        { width: 640, height: 360 },
      ),
    ).toThrow(
      expect.objectContaining({
        code: "guide-aesthetic-incompatible",
        path: "/scales/color/guide",
      }),
    );
  });

  it("fails collision:error with a structured guide path instead of truncating silently", () => {
    const longRows = rows.map((row) => ({
      ...row,
      region: `${row.region} with a deliberately very long authored category label`,
    }));
    expect(() =>
      runPipeline(
        gg(longRows, aes({ x: "x", y: "y", color: "region" }))
          .geomPoint()
          .guides({ color: guideLegend({ position: "right", collision: "error" }) })
          .spec(),
        { width: 420, height: 360 },
      ),
    ).toThrow(expect.objectContaining({ code: "guide-layout-overflow", path: "/guides/color" }));
  });

  it("fails collision:error when the complete guide block exceeds viewport height", () => {
    const many = Array.from({ length: 40 }, (_, index) => ({
      x: index,
      y: index,
      group: `g${String(index)}`,
    }));
    expect(() =>
      runPipeline(
        gg(many, aes({ x: "x", y: "y", color: "group" }))
          .geomPoint()
          .guides({ color: guideLegend({ position: "bottom", collision: "error" }) })
          .spec(),
        { width: 320, height: 160 },
      ),
    ).toThrow(expect.objectContaining({ code: "guide-layout-overflow", path: "/guides/color" }));
  });

  it("checks collision:error against the translated right-guide area", () => {
    const groups = Array.from({ length: 5 }, (_, index) => ({
      x: index,
      y: index,
      group: `g${String(index)}`,
    }));
    expect(() =>
      runPipeline(
        gg(groups, aes({ x: "x", y: "y", color: "group" }))
          .geomPoint()
          .labs({ title: "A chart title", subtitle: "A chart subtitle" })
          .guides({ color: guideLegend({ position: "right", collision: "error" }) })
          .spec(),
        { width: 720, height: 160 },
      ),
    ).toThrow(expect.objectContaining({ code: "guide-layout-overflow", path: "/guides/color" }));
  });

  it("checks collision:error against the translated bottom-guide area", () => {
    const groups = Array.from({ length: 24 }, (_, index) => ({
      x: index,
      y: index,
      group: `g${String(index)}`,
    }));
    expect(() =>
      runPipeline(
        gg(groups, aes({ x: "x", y: "y", color: "group" }))
          .geomPoint()
          .labs({ caption: "A chart caption" })
          .guides({ color: guideLegend({ position: "bottom", collision: "error" }) })
          .spec(),
        { width: 720, height: 80 },
      ),
    ).toThrow(expect.objectContaining({ code: "guide-layout-overflow", path: "/guides/color" }));
  });

  it("uses top-level guide appearance over scale-local settings and supports suppression", () => {
    const configured = runPipeline(
      gg(rows, aes({ x: "x", y: "y", color: "region" }))
        .geomPoint()
        .scales(
          scaleColorDiscrete({
            guide: guideLegend({ title: "Local", position: "right", keySize: 8 }),
          }),
        )
        .guides({
          color: guideLegend({ title: "Top", position: "bottom", keySize: 16 }),
        })
        .spec(),
      { width: 720, height: 360 },
    );
    expect(configured.scene.legends[0]).toMatchObject({
      title: "Top",
      position: "bottom",
      direction: "horizontal",
      swatchSize: 16,
    });

    const positionOverride = runPipeline(
      gg(rows, aes({ x: "region", y: "y" }))
        .geomPoint()
        .scales({ x: { type: "band", guide: { mode: "off" } } })
        .guides({ x: guideAxis({ showLabels: true }) })
        .spec(),
      { width: 720, height: 360 },
    );
    expect(
      positionOverride.scene.panels[0]!.axisX!.some(
        (tick) => tick.showLabel !== false && tick.label !== "",
      ),
    ).toBe(true);

    const hidden = runPipeline(
      gg(rows, aes({ x: "x", y: "y", color: "region" }))
        .geomPoint()
        .guides({ color: guideNone() })
        .spec(),
      { width: 720, height: 360 },
    );
    expect(hidden.scene.legends).toHaveLength(0);
  });
});
