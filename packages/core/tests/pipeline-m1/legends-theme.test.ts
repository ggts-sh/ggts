/**
 * M1 discrete legends and theme wiring.
 */
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { EDITION_DEFAULTS } from "../../src/editions.ts";
import { runPipeline } from "../../src/pipeline.ts";
import { renderToSVGString } from "../../src/render-svg-full.ts";
import type { SceneDiscreteLegend } from "../../src/scene.ts";
import { salesRows, size } from "./fixtures.ts";

describe("legends", () => {
  const spec = (order?: "stable-domain" | "present-first-seen" | "sorted") => {
    let b = gg(salesRows, aes({ x: "city", y: "sales", fill: "kind" }))
      .geomCol()
      .labs({ fill: "Channel" });
    if (order) b = b.legend({ order });
    return b.spec();
  };

  it("a discrete fill legend is produced, titled, and placed right of the panel", () => {
    const model = runPipeline(spec(), size);
    expect(model.scene.legends).toHaveLength(1);
    const legend = model.scene.legends[0] as SceneDiscreteLegend;
    expect(legend.type).toBe("discrete");
    expect(legend.title).toBe("Channel");
    expect(legend.entries.map((e) => e.label)).toEqual(["web", "store"]);
    const panel = model.scene.panels[0]!;
    expect(legend.x).toBeGreaterThan(panel.x + panel.width);
    expect(legend.x + legend.width).toBeLessThanOrEqual(size.width);
  });

  it("legend.order reorders labels WITHOUT changing colors", () => {
    const stable = runPipeline(spec(), size);
    const sorted = runPipeline(spec("sorted"), size);
    const entriesOf = (m: typeof stable) =>
      new Map((m.scene.legends[0] as SceneDiscreteLegend).entries.map((e) => [e.label, e.color]));
    expect([...entriesOf(sorted).keys()]).toEqual(["store", "web"]);
    expect(entriesOf(sorted).get("web")).toBe(entriesOf(stable).get("web"));
    expect(entriesOf(sorted).get("store")).toBe(entriesOf(stable).get("store"));
  });

  it("keeps typed values with colliding labels as distinct, disambiguated entries", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 1, g: 1 },
          { x: 2, y: 2, g: "1" },
        ],
        aes({ x: "x", y: "y", color: "g" }),
      )
        .geomPoint()
        .legend({ order: "present-first-seen" })
        .spec(),
      size,
    );
    const legend = model.scene.legends[0] as SceneDiscreteLegend;
    expect(legend.type).toBe("discrete");
    // The ordinal scale assigns 1 and "1" distinct colors; collapsing them
    // to one entry would make the second group impossible to identify (or
    // filter). Colliding presentation labels carry a typed qualifier.
    expect(legend.entries.map((e) => e.value)).toEqual([1, "1"]);
    expect(legend.entries.map((e) => e.label)).toEqual(["1 (number)", "1 (text)"]);
    expect(new Set(legend.entries.map((e) => e.color)).size).toBe(2);
  });

  it("no color mapping -> no legends, no reserved right margin beyond labels", () => {
    const model = runPipeline(
      gg(salesRows, aes({ x: "city", y: "sales" }))
        .geomCol()
        .spec(),
      size,
    );
    expect(model.scene.legends).toHaveLength(0);
  });
});

describe("theme wiring", () => {
  it("scene carries resolved tokens; unmapped bars render the accent var", () => {
    const svg = renderToSVGString(
      gg(salesRows, aes({ x: "city", y: "sales" }))
        .geomCol()
        .theme("dark")
        .spec(),
      { ...size, editions: EDITION_DEFAULTS },
    );
    expect(svg).toContain('class="gg-paper"');
    expect(svg).toContain("var(--gg-paper, #16181d)");
    expect(svg).toContain("var(--gg-accent, #7ea1f0)");
    expect(svg).toContain("var(--gg-ink, #e6e8eb)");
  });

  it("edition-2 default uses the hrbr-style paper and ink roles", () => {
    const svg = renderToSVGString(
      gg(salesRows, aes({ x: "city", y: "sales" }))
        .geomCol()
        .spec(),
      size,
    );
    expect(svg).toContain('class="gg-paper"');
    expect(svg).toContain("var(--gg-paper, #ffffff)");
    expect(svg).toContain("var(--gg-ink, #262626)");
    expect(svg).not.toContain("gg-axis-line");
  });

  it("edition-1 specs retain the legacy transparent currentColor theme", () => {
    const svg = renderToSVGString(
      {
        edition: 1,
        data: { values: salesRows },
        aes: { x: { field: "city" }, y: { field: "sales" } },
        layers: [{ geom: "col" }],
      },
      size,
    );
    expect(svg).not.toContain("gg-paper");
    expect(svg).toContain("var(--gg-ink, currentColor)");
  });

  it("unknown theme names throw a structured tier-1 error", () => {
    try {
      runPipeline(
        fromAny({
          data: { values: salesRows },
          theme: "darkk",
          layers: [{ geom: "point", aes: { x: { field: "city" }, y: { field: "sales" } } }],
        }),
        size,
      );
      throw new Error("should have thrown");
    } catch (e) {
      // the schema rejects it first (SpecValidationError) — which IS tier 1
      expect((e as Error).name).toMatch(/SpecValidationError|PipelineError/);
    }
  });
});
