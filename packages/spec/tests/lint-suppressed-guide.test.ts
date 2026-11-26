/**
 * Suppressed mapped guide spec-lint behavior: `suppressed-mapped-guide`.
 * Seam: `lintSpec()` and `validate(spec, { lint: true })`.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg, guideLegend, guideNone } from "../src/index.ts";
import { LINT_CATALOG, lintSpec, type SpecAdvisory } from "../src/lint.ts";
import { validate } from "../src/validate.ts";

const CODE = "suppressed-mapped-guide";

const codesOf = (advisories: SpecAdvisory[]) => advisories.map((a) => a.code);

const suppressedAdvisories = (spec: unknown) => lintSpec(spec).filter((a) => a.code === CODE);

const bubbleData = {
  values: [
    { x: 1, y: 2, vol: 10, group: "a", kind: "circle" },
    { x: 2, y: 4, vol: 50, group: "b", kind: "square" },
    { x: 3, y: 6, vol: 100, group: "c", kind: "triangle" },
  ],
};

describe("suppressed-mapped-guide", () => {
  it("registers catalog metadata with needs: spec", () => {
    const entry = LINT_CATALOG[CODE];
    expect(entry.needs).toBe("spec");
    expect(entry.summary.length).toBeGreaterThan(0);
    expect(entry.rationale.length).toBeGreaterThan(0);
  });

  it("fires when size maps a data field and guides.size.type is none", () => {
    const spec = {
      data: bubbleData,
      aes: { x: { field: "x" }, y: { field: "y" }, size: { field: "vol" } },
      layers: [{ geom: "point" }],
      guides: { size: { type: "none" } },
      labs: { title: "Bubble plot", x: "X", y: "Y" },
    };

    const advisories = lintSpec(spec);
    expect(codesOf(advisories)).toEqual([CODE]);
    const hit = advisories[0]!;
    expect(hit.path).toBe("/guides/size");
    expect(hit.message).toContain("size");
    expect(hit.message).toContain('"vol"');
    expect(hit.suggestion?.description).toMatch(/guide|mapping|label/i);

    const result = validate(spec, { lint: true });
    expect(result.ok).toBe(true);
    expect(codesOf(result.advisories ?? [])).toEqual([CODE]);
  });

  it("fires for color and shape mapped to data fields when guides are suppressed", () => {
    const spec = {
      data: bubbleData,
      layers: [
        {
          geom: "point",
          aes: {
            x: { field: "x" },
            y: { field: "y" },
            color: { field: "group" },
            shape: { field: "kind" },
          },
        },
      ],
      guides: {
        color: { type: "none" },
        shape: { type: "none" },
      },
      labs: { title: "Multi-channel scatter", x: "X", y: "Y" },
    };

    const hits = suppressedAdvisories(spec);
    expect(hits.map((h) => h.path)).toEqual(["/guides/color", "/guides/shape"]);
    expect(hits[0]!.message).toContain('"group"');
    expect(hits[1]!.message).toContain('"kind"');
  });

  it("fires when suppression is set on scales.<channel>.guide without a top-level override", () => {
    const spec = {
      data: bubbleData,
      aes: { x: { field: "x" }, y: { field: "y" }, size: { field: "vol" } },
      layers: [{ geom: "point" }],
      scales: { size: { type: "sequential", guide: { type: "none" } } },
      labs: { title: "Scale-suppressed bubble plot", x: "X", y: "Y" },
    };

    const hits = suppressedAdvisories(spec);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.path).toBe("/scales/size/guide");
  });

  it("does not fire when top-level guides restores a scale-suppressed guide", () => {
    const spec = {
      data: bubbleData,
      aes: { x: { field: "x" }, y: { field: "y" }, size: { field: "vol" } },
      layers: [{ geom: "point" }],
      scales: { size: { type: "sequential", guide: { type: "none" } } },
      guides: { size: { type: "legend" } },
      labs: { title: "Restored guide", x: "X", y: "Y" },
    };

    expect(suppressedAdvisories(spec)).toEqual([]);
  });

  it("does not fire for a constant size value even when guides.size is none", () => {
    const spec = {
      data: bubbleData,
      aes: { x: { field: "x" }, y: { field: "y" }, size: { value: 4 } },
      layers: [{ geom: "point" }],
      guides: { size: { type: "none" } },
      labs: { title: "Constant size", x: "X", y: "Y" },
    };

    expect(suppressedAdvisories(spec)).toEqual([]);
  });

  it("does not fire when a mapped size channel has an active legend", () => {
    const defaultGuide = gg(bubbleData.values, aes({ x: "x", y: "y", size: "vol" }))
      .geomPoint()
      .labs({ title: "Default legend", x: "X", y: "Y" })
      .spec();
    const explicitGuide = gg(bubbleData.values, aes({ x: "x", y: "y", size: "vol" }))
      .geomPoint()
      .guides({ size: guideLegend() })
      .labs({ title: "Explicit legend", x: "X", y: "Y" })
      .spec();

    expect(suppressedAdvisories(defaultGuide)).toEqual([]);
    expect(suppressedAdvisories(explicitGuide)).toEqual([]);
  });

  it("does not fire when the suppressed field is already named by an active axis, facet strip, or direct label", () => {
    // Redundant with x axis
    const axisRedundant = gg(bubbleData.values, aes({ x: "group", y: "y", color: "group" }))
      .geomCol()
      .guides({ color: guideNone() })
      .labs({ title: "Axis redundant", x: "Group", y: "Y" })
      .spec();
    expect(suppressedAdvisories(axisRedundant)).toEqual([]);

    // Redundant with visible facet strip
    const facetRedundant = gg(bubbleData.values, aes({ x: "x", y: "y", color: "group" }))
      .geomPoint()
      .facet({ wrap: "group" })
      .guides({ color: guideNone() })
      .labs({ title: "Facet redundant", x: "X", y: "Y" })
      .spec();
    expect(suppressedAdvisories(facetRedundant)).toEqual([]);

    // Redundant with direct text label
    const labelRedundant = gg(bubbleData.values, aes({ x: "x", y: "y", color: "group" }))
      .geomPoint()
      .geomText({ aes: { label: "group" } })
      .guides({ color: guideNone() })
      .labs({ title: "Direct label", x: "X", y: "Y" })
      .spec();
    expect(suppressedAdvisories(labelRedundant)).toEqual([]);
  });

  it("still fires when a label layer names a different field than the suppressed channel", () => {
    const spec = gg(bubbleData.values, aes({ x: "x", y: "y", size: "vol" }))
      .geomPoint()
      .geomText({ aes: { label: "group" } })
      .guides({ size: guideNone() })
      .labs({ title: "Labeled bubbles with hidden size key", x: "X", y: "Y" })
      .spec();

    const hits = suppressedAdvisories(spec);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.path).toBe("/guides/size");
    expect(hits[0]!.message).toContain('"vol"');
  });

  it("still fires when the matching axis or facet strip is itself hidden", () => {
    const hiddenAxis = gg(bubbleData.values, aes({ x: "group", y: "y", color: "group" }))
      .geomCol()
      .guides({ x: guideNone(), color: guideNone() })
      .labs({ title: "Hidden axis", x: "Group", y: "Y" })
      .spec();
    expect(suppressedAdvisories(hiddenAxis)).toHaveLength(1);

    const hiddenStrip = gg(bubbleData.values, aes({ x: "x", y: "y", color: "group" }))
      .geomPoint()
      .facet({ wrap: "group", strip: { show: false } })
      .guides({ color: guideNone() })
      .labs({ title: "Hidden strip", x: "X", y: "Y" })
      .spec();
    expect(suppressedAdvisories(hiddenStrip)).toHaveLength(1);

    const hiddenAxisLabels = {
      data: bubbleData,
      aes: { x: { field: "group" }, y: { field: "y" }, color: { field: "group" } },
      layers: [{ geom: "col" }],
      guides: { x: { type: "axis", showLabels: false }, color: { type: "none" } },
      labs: { title: "Hidden axis labels", x: "Group", y: "Y" },
    };
    expect(suppressedAdvisories(hiddenAxisLabels)).toHaveLength(1);

    const themeHiddenLabels = {
      data: bubbleData,
      aes: { x: { field: "group" }, y: { field: "y" }, color: { field: "group" } },
      layers: [{ geom: "col" }],
      guides: { color: { type: "none" } },
      theme: { name: "clean", labelsX: false },
      labs: { title: "Theme hidden x labels", x: "Group", y: "Y" },
    };
    expect(suppressedAdvisories(themeHiddenLabels)).toHaveLength(1);
  });

  it("does not fire when color and fill map the same field and one paint guide remains active", () => {
    const spec = {
      data: bubbleData,
      aes: {
        x: { field: "x" },
        y: { field: "y" },
        color: { field: "group" },
        fill: { field: "group" },
      },
      layers: [{ geom: "area" }],
      guides: { fill: { type: "none" } },
      labs: { title: "Paired paint channels", x: "X", y: "Y" },
    };
    expect(suppressedAdvisories(spec)).toEqual([]);
  });

  it("does not fire when plot aes is unset with null on every layer", () => {
    const spec = {
      data: bubbleData,
      aes: { x: { field: "x" }, y: { field: "y" }, size: { field: "vol" } },
      layers: [{ geom: "point", aes: { size: null } }],
      guides: { size: { type: "none" } },
      labs: { title: "Unset size", x: "X", y: "Y" },
    };

    expect(suppressedAdvisories(spec)).toEqual([]);
  });
});
