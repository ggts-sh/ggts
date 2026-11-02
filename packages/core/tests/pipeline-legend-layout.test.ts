import { describe, expect, it } from "bun:test";

import {
  aes,
  gg,
  guideAxis,
  guideColorbar,
  guideLegend,
  scaleColorContinuous,
  scaleColorDiscrete,
  scaleColorIdentity,
  scaleShapeDiscrete,
  scaleSizeIdentity,
} from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.js";

import { renderToSVGString } from "../src/render-svg-full.js";

const rows = [
  { x: 1, y: 2, region: "North" },
  { x: 2, y: 4, region: "South" },
  { x: 3, y: 3, region: "North" },
];

describe("responsive guide planning", () => {
  it("moves automatic guides below on narrow viewports and keeps 320px of panel when right", () => {
    const narrow = runPipeline(
      gg(rows, aes({ x: "x", y: "y", color: "region" }))
        .geomPoint()
        .spec(),
      { width: 420, height: 360 },
    );
    expect(narrow.scene.legends[0]?.position).toBe("bottom");
    expect(narrow.scene.legends[0]?.direction).toBe("horizontal");
    expect(narrow.warnings.filter((warning) => warning.code === "guide-auto-bottom")).toHaveLength(
      1,
    );

    const wide = runPipeline(
      gg(rows, aes({ x: "x", y: "y", color: "region" }))
        .geomPoint()
        .spec(),
      { width: 720, height: 360 },
    );
    expect(wide.scene.legends[0]?.position).toBe("right");
    expect(wide.scene.panels[0]?.width).toBeGreaterThanOrEqual(320);
  });

  it("reserves independent right and bottom zones for explicitly placed guides", () => {
    const result = runPipeline(
      gg(rows, aes({ x: "x", y: "y", color: "region", shape: "region" }))
        .geomPoint()
        .scales({ ...scaleColorDiscrete(), ...scaleShapeDiscrete() })
        .labs({ color: "Region", shape: "Region" })
        .guides({
          color: guideLegend({ position: "right" }),
          shape: guideLegend({ position: "bottom" }),
        })
        .spec(),
      { width: 720, height: 360 },
    );
    expect(
      result.scene.legends
        .map((legend) => legend.position)
        .toSorted((left, right) => (left ?? "").localeCompare(right ?? "")),
    ).toEqual(["bottom", "right"]);
    expect(result.scene.panels[0]?.width).toBeLessThan(620);
    const bottomLegend = result.scene.legends.find((legend) => legend.position === "bottom");
    expect(bottomLegend!.width).toBeLessThanOrEqual(result.scene.panels[0]!.width);
    expect(bottomLegend!.y).toBeGreaterThanOrEqual(
      result.scene.panels[0]!.y + result.scene.panels[0]!.height + 32,
    );
    const svg = renderToSVGString(
      gg(rows, aes({ x: "x", y: "y", color: "region" }))
        .geomPoint()
        .guides({ color: guideLegend({ position: "bottom", direction: "horizontal" }) })
        .spec(),
      { width: 420, height: 360 },
    );
    expect(svg).toContain("gg-legend-bottom gg-legend-horizontal");
    expect(svg).toContain(">North</text>");
  });

  it("keeps bottom guides inside the viewport when the y-axis has wide chrome", () => {
    const wideChromeRows = [
      { x: 0, y: "A very long category on the vertical axis", value: 0 },
      { x: 1, y: "Another very long category on the vertical axis", value: 1 },
    ];
    const result = runPipeline(
      gg(wideChromeRows, aes({ x: "x", y: "y", color: "value" }))
        .geomPoint()
        .scales({ y: { type: "band" }, ...scaleColorContinuous() })
        .guides({
          color: guideColorbar({
            position: "bottom",
            direction: "horizontal",
            theme: { colorbarLength: 512 },
          }),
        })
        .spec(),
      { width: 640, height: 360 },
    );
    const legend = result.scene.legends[0]!;
    expect(legend.x + legend.width).toBeLessThanOrEqual(result.scene.width - 2);
  });

  it("renders wrapped discrete labels as multiline SVG without ellipsis", () => {
    const wrappedRows = [
      { x: 1, y: 1, group: "A deliberately long northern category label" },
      { x: 2, y: 2, group: "A deliberately long southern category label" },
    ];
    const svg = renderToSVGString(
      gg(wrappedRows, aes({ x: "x", y: "y", color: "group" }))
        .geomPoint()
        .guides({
          color: guideLegend({
            position: "bottom",
            direction: "horizontal",
            collision: "wrap",
          }),
        })
        .spec(),
      { width: 190, height: 360 },
    );
    expect(svg).toContain("<tspan");
    expect(svg).toContain(">long northern</tspan>");
    expect(svg).toContain(">category label</tspan>");
    expect(svg).not.toContain("…");
  });

  it("renders measured colorbar title bands and horizontal ramp insets in pure SVG", () => {
    const spec = gg(rows, aes({ x: "x", y: "y", color: "x" }))
      .geomPoint()
      .scales(scaleColorContinuous())
      .guides({
        color: guideColorbar({
          title: "Value",
          position: "bottom",
          theme: { titleSize: 32 },
        }),
      })
      .spec();
    const result = runPipeline(spec, { width: 640, height: 360 });
    const legend = result.scene.legends[0];
    expect(legend?.type).toBe("ramp");
    if (legend?.type !== "ramp") return;
    const rampX = Math.round((legend.rampX ?? 0) * 100) / 100;
    const svg = renderToSVGString(spec, { width: 640, height: 360 });
    expect(svg).toContain('class="gg-legend-title" x="4" y="32"');
    expect(svg).toContain(`class="gg-legend-ramp" x="${String(rampX)}"`);
  });

  it("controls colorbar tick marks independently from complete semantic labels", () => {
    const spec = gg(rows, aes({ x: "x", y: "y", color: "x" }))
      .geomPoint()
      .scales(scaleColorContinuous())
      .guides({
        color: guideColorbar({
          position: "bottom",
          showTicks: false,
          showLabels: false,
        }),
      })
      .spec();
    const result = runPipeline(spec, { width: 640, height: 360 });
    const legend = result.scene.legends[0];
    expect(legend?.type).toBe("ramp");
    if (legend?.type !== "ramp") return;
    expect(legend.showTicks).toBe(false);
    expect(legend.ticks.every((tick) => tick.label === "" && tick.fullLabel !== "")).toBe(true);
    const svg = renderToSVGString(spec, { width: 640, height: 360 });
    expect(svg).not.toContain("gg-legend-tick");
    expect(svg).not.toContain("gg-legend-label");
  });

  it("suppresses identity guides by default and exposes exact values only when forced", () => {
    const identityRows = [
      { x: 1, y: 2, color: "#ff0000", size: 4 },
      { x: 2, y: 3, color: "#0000ff", size: 8 },
    ];
    const base = gg(identityRows, aes({ x: "x", y: "y", color: "color", size: "size" }))
      .geomPoint()
      .scales({ ...scaleColorIdentity(), ...scaleSizeIdentity() })
      .labs({ color: "Authored color", size: "Authored size" });
    expect(runPipeline(base.spec(), { width: 720, height: 360 }).scene.legends).toHaveLength(0);

    const forced = runPipeline(
      base
        .guides({
          color: guideLegend({ force: true }),
          size: guideLegend({ force: true }),
        })
        .spec(),
      { width: 720, height: 360 },
    );
    expect(forced.scene.legends).toHaveLength(2);
    expect(
      forced.scene.legends.every(
        (legend) => legend.type === "discrete" && legend.interactive === true,
      ),
    ).toBe(true);
  });

  it("uses each preceding guide block gap without reserving trailing whitespace", () => {
    const result = runPipeline(
      gg(rows, aes({ x: "x", y: "y", color: "region", shape: "region" }))
        .geomPoint()
        .labs({ color: "Color", shape: "Shape" })
        .guides({
          color: guideLegend({ position: "right", theme: { blockGap: 30 } }),
          shape: guideLegend({ position: "right", theme: { blockGap: 4 } }),
        })
        .spec(),
      { width: 720, height: 360 },
    );
    const [color, shape] = result.scene.legends;
    expect(shape?.y).toBe((color?.y ?? 0) + (color?.height ?? 0) + 30);
  });

  it("uses theme-owned guide roles and reserves bounded per-guide typography", () => {
    const baseline = runPipeline(
      gg(rows, aes({ x: "x", y: "y", color: "region" }))
        .geomPoint()
        .spec(),
      { width: 720, height: 360 },
    );
    const result = runPipeline(
      gg(rows, aes({ x: "x", y: "y", color: "region" }))
        .geomPoint()
        .theme({
          name: "light",
          guideTitleSize: 14,
          legendKeySize: 15,
          legendKeyGap: 8,
          guideBlockGap: 16,
        })
        .guides({
          x: guideAxis({ theme: { titleSize: 16, labelSize: 12 } }),
          color: guideLegend({ theme: { labelSize: 13 } }),
        })
        .spec(),
      { width: 720, height: 360 },
    );
    const legend = result.scene.legends[0];
    expect(legend).toMatchObject({ titleSize: 14, labelSize: 13, swatchSize: 15 });
    expect(result.scene.axes.x.titleSize).toBe(16);
    expect(result.scene.axes.x.ticks.every((tick) => tick.labelSize === 12)).toBe(true);
    expect(result.scene.panels[0]!.height).toBeLessThan(baseline.scene.panels[0]!.height);
  });

  it("places legend titles on the requested side without reserving side bands", () => {
    const legendFor = (titlePosition: "top" | "bottom" | "left" | "right") => {
      const legend = runPipeline(
        gg(rows, aes({ x: "x", y: "y", color: "region" }))
          .geomPoint()
          .guides({
            color: guideLegend({
              title: "Region",
              position: "bottom",
              direction: "horizontal",
              titlePosition,
            }),
          })
          .spec(),
        { width: 720, height: 360 },
      ).scene.legends[0];
      if (legend?.type !== "discrete") throw new Error("expected a discrete legend");
      return legend;
    };

    const left = legendFor("left");
    expect(left.titleHeight).toBe(0);
    expect(left.titleX).toBeDefined();
    expect(left.titleY).toBeDefined();
    expect(left.entries[0]!.x ?? 0).toBeGreaterThan(left.titleX!);

    const top = legendFor("top");
    expect(top.titleHeight).toBeGreaterThan(0);
    expect(top.entries[0]!.y).toBeGreaterThanOrEqual(top.titleHeight!);
    expect(top.titleY!).toBeLessThan(top.entries[0]!.y);

    const bottom = legendFor("bottom");
    expect(bottom.titleHeight).toBe(0);
    expect(bottom.titleY!).toBeGreaterThan(bottom.entries.at(-1)!.y);

    const right = legendFor("right");
    expect(right.titleHeight).toBe(0);
    expect(right.titleX).toBeDefined();
    expect(right.titleY).toBeDefined();
  });

  it("uses theme title placement and keeps the adaptive horizontal default", () => {
    const themed = (legendTitlePosition: "top" | "bottom" | "left" | "right") => {
      const legend = runPipeline(
        gg(rows, aes({ x: "x", y: "y", color: "region" }))
          .geomPoint()
          .theme({ name: "light", legendTitlePosition })
          .guides({ color: guideLegend({ position: "bottom", direction: "horizontal" }) })
          .spec(),
        { width: 720, height: 360 },
      ).scene.legends[0];
      if (legend?.type !== "discrete") throw new Error("expected a discrete legend");
      return legend;
    };
    expect(themed("left").titleHeight).toBe(0);
    expect(themed("top").titleHeight).toBeGreaterThan(0);

    const adaptive = (width: number, labels: string[]) =>
      runPipeline(
        gg(
          labels.map((region, index) => ({ x: index, y: index + 1, region })),
          aes({ x: "x", y: "y", color: "region" }),
        )
          .geomPoint()
          .guides({ color: guideLegend({ position: "bottom", direction: "horizontal" }) })
          .spec(),
        { width, height: 360 },
      ).scene.legends[0]!;
    const oneRow = adaptive(720, ["North", "South"]);
    if (oneRow.type !== "discrete") throw new Error("expected a discrete legend");
    expect(oneRow.titleHeight).toBe(0);
    const wrapped = adaptive(190, [
      "A deliberately long northern category label",
      "A deliberately long southern category label",
    ]);
    if (wrapped.type !== "discrete") throw new Error("expected a discrete legend");
    expect(wrapped.titleHeight).toBeGreaterThan(0);
  });

  it("separates guide precedence from same-type field and theme merging", () => {
    const merged = runPipeline(
      gg(rows, aes({ x: "x", y: "y", color: "region" }))
        .geomPoint()
        .scales(
          scaleColorDiscrete({
            guide: guideLegend({
              title: "Local",
              position: "bottom",
              direction: "horizontal",
              titlePosition: "left",
              theme: { labelSize: 11 },
            }),
          }),
        )
        .guides({ color: guideLegend({ title: "Top", theme: { keyGap: 8 } }) })
        .spec(),
      { width: 720, height: 360 },
    ).scene.legends[0];
    expect(merged).toMatchObject({
      title: "Top",
      position: "bottom",
      direction: "horizontal",
      labelSize: 11,
      keyGap: 8,
      titleHeight: 0,
    });

    const overridden = runPipeline(
      gg(rows, aes({ x: "x", y: "y", color: "region" }))
        .geomPoint()
        .scales(scaleColorDiscrete({ guide: guideLegend({ titlePosition: "left" }) }))
        .guides({ color: guideLegend({ titlePosition: "top" }) })
        .spec(),
      { width: 720, height: 360 },
    ).scene.legends[0];
    expect(overridden?.type).toBe("discrete");
    if (overridden?.type === "discrete") expect(overridden.titleHeight).toBeGreaterThan(0);

    const split = runPipeline(
      gg(rows, aes({ x: "x", y: "y", color: "region", shape: "region" }))
        .geomPoint()
        .scales({ ...scaleColorDiscrete(), ...scaleShapeDiscrete() })
        .labs({ color: "Region", shape: "Region" })
        .guides({
          color: guideLegend({ position: "bottom", titlePosition: "left" }),
          shape: guideLegend({ position: "bottom", titlePosition: "top" }),
        })
        .spec(),
      { width: 720, height: 360 },
    ).scene.legends;
    expect(split).toHaveLength(2);
    const bands = split.flatMap((legend) =>
      legend.type === "discrete" ? [legend.titleHeight ?? 0] : [],
    );
    expect(Math.min(...bands)).toBe(0);
    expect(Math.max(...bands)).toBeGreaterThan(0);
  });

  it("warns about extreme panel proportions without blocking the render", () => {
    const spec = gg(rows, aes({ x: "x", y: "y", color: "region" }))
      .geomPoint()
      .spec();
    const wide = runPipeline(spec, { width: 1600, height: 260 });
    expect(wide.warnings.some((warning) => warning.code === "panel-aspect-extreme")).toBe(true);
    expect(wide.scene.panels[0]!.width / wide.scene.panels[0]!.height).toBeGreaterThanOrEqual(4);

    const tall = runPipeline(spec, { width: 200, height: 900 });
    expect(tall.warnings.some((warning) => warning.code === "panel-aspect-extreme")).toBe(true);
    expect(tall.scene.panels[0]!.width / tall.scene.panels[0]!.height).toBeLessThan(0.25);
  });

  it("warns when a short plot leaves the panel under half its height", () => {
    const spec = gg(rows, aes({ x: "x", y: "y", color: "region" }))
      .geomPoint()
      .labs({ title: "Title", subtitle: "Subtitle", x: "X", y: "Y", color: "Region" })
      .guides({ color: guideLegend({ position: "bottom", direction: "horizontal" }) })
      .spec();
    const result = runPipeline(spec, { width: 1200, height: 200 });
    expect(result.warnings.some((warning) => warning.code === "panel-height-share-low")).toBe(true);
    expect(result.scene.panels[0]!.height / result.scene.height).toBeLessThan(0.5);

    const compact = runPipeline(spec, { width: 1200, height: 300 });
    expect(compact.scene.panels[0]!.height).toBeGreaterThanOrEqual(174);
  });

  it("lets the theme mark an intended strip and excludes fixed and radial coords", () => {
    const extreme = gg(rows, aes({ x: "x", y: "y", color: "region" })).geomPoint();
    const free = runPipeline(extreme.theme({ name: "light", panelAspect: "free" }).spec(), {
      width: 1600,
      height: 260,
    });
    expect(
      free.warnings.some(
        (warning) =>
          warning.code === "panel-aspect-extreme" || warning.code === "panel-height-share-low",
      ),
    ).toBe(false);
    expect(free.scene.panels).toHaveLength(1);

    for (const spec of [
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .coordFixed({ ratio: 0.1 })
        .spec(),
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .coordRadial()
        .spec(),
    ]) {
      const result = runPipeline(spec, { width: 1600, height: 260 });
      expect(
        result.warnings.some(
          (warning) =>
            warning.code === "panel-aspect-extreme" || warning.code === "panel-height-share-low",
        ),
      ).toBe(false);
    }
  });
});
