/**
 * Discrete legend title placement (#1886): four side positions, the adaptive
 * horizontal default, and the scene geometry consumers rely on.
 */
import { describe, expect, it } from "bun:test";

import { FONT_METRICS } from "../src/layout/font-metrics.ts";
import { MetricsTableMeasurer } from "../src/layout/measure.ts";
import { buildLegends, LegendLayoutError, type DiscreteLegendInput } from "../src/legend.ts";
import type { SceneDiscreteLegend } from "../src/scene.ts";

const measurer = new MetricsTableMeasurer(FONT_METRICS);

type TitlePosition = "top" | "bottom" | "left" | "right";

function discrete(
  labels: string[],
  overrides: {
    title?: string;
    titlePosition?: TitlePosition;
    position?: "right" | "bottom";
    direction?: "vertical" | "horizontal";
    collision?: "ellipsis" | "wrap" | "error";
    titleSize?: number;
    labelSize?: number;
    keySize?: number;
    keyGap?: number;
  } = {},
): DiscreteLegendInput {
  const title = overrides.title ?? "Groups";
  return {
    kind: "discrete",
    scale: "color",
    title,
    domain: labels,
    firstSeen: labels,
    colorOf: () => "#123456",
    appearance: {
      type: "legend",
      title,
      order: 0,
      position: overrides.position ?? "bottom",
      direction: overrides.direction ?? "horizontal",
      ...(overrides.titlePosition !== undefined && {
        titlePosition: overrides.titlePosition,
      }),
      ...(overrides.collision !== undefined && { collision: overrides.collision }),
      ...(overrides.keySize !== undefined && { keySize: overrides.keySize }),
      theme: {
        ...(overrides.titleSize !== undefined && { titleSize: overrides.titleSize }),
        ...(overrides.labelSize !== undefined && { labelSize: overrides.labelSize }),
        ...(overrides.keyGap !== undefined && { keyGap: overrides.keyGap }),
      },
    },
  };
}

function build(labels: string[], maxWidth: number, overrides: Parameters<typeof discrete>[1] = {}) {
  // Bottom-positioned guides subtract 80px of estimated chrome from the
  // viewport; offset it so `maxWidth` is the available legend width.
  const legend = buildLegends(
    [discrete(labels, overrides)],
    "stable-domain",
    measurer,
    maxWidth,
    maxWidth + 80,
  ).legends[0];
  if (legend?.type !== "discrete") throw new Error("expected a discrete legend");
  return legend;
}

function labelEnd(legend: SceneDiscreteLegend, index: number): number {
  const entry = legend.entries[index]!;
  return (
    (entry.x ?? 0) +
    4 +
    legend.swatchSize +
    (legend.keyGap ?? 6) +
    measurer.measureWidth(entry.label, legend.labelSize ?? 11)
  );
}

function titleEnd(legend: SceneDiscreteLegend): number {
  return (
    legend.titleX! +
    measurer.measureWidth(legend.titleLabel ?? legend.title, legend.titleSize ?? 11)
  );
}

/** Title glyph bounds derived from the canonical metrics table. */
function titleBounds(legend: SceneDiscreteLegend) {
  const size = legend.titleSize ?? 11;
  const ascent = (FONT_METRICS.ascent * size) / FONT_METRICS.refSize;
  const descent = (FONT_METRICS.descent * size) / FONT_METRICS.refSize;
  expect(legend.titleY! - ascent).toBeGreaterThanOrEqual(-1e-6);
  expect(legend.titleY! + descent).toBeLessThanOrEqual(legend.height + 1e-6);
  expect(titleEnd(legend)).toBeLessThanOrEqual(legend.width + 1e-6);
}

describe("discrete legend title positions", () => {
  it("puts a left title on the first key row and starts keys after it", () => {
    const legend = build(["alpha", "beta"], 400, { titlePosition: "left" });
    const first = legend.entries[0]!;
    const rowHeight = first.height ?? 24;
    const labelBaseline = first.y + rowHeight / 2 + (legend.labelSize ?? 11) * 0.32;
    expect(legend.titleHeight).toBe(0);
    expect(legend.titleX).toBe(4);
    expect(legend.titleY).toBeCloseTo(labelBaseline, 6);
    expect(first.y).toBe(0);
    expect(first.x!).toBeGreaterThan(0);
    expect(first.x! + 4).toBeGreaterThanOrEqual(titleEnd(legend) + 6 - 1e-6);
    expect(legend.height).toBe(24 + 4);
  });

  it("puts a right title after the widest row and still offsets wide labels", () => {
    const legend = build(["alpha", "beta", "gamma"], 400, {
      titlePosition: "right",
      collision: "wrap",
    });
    const widestLabel = Math.max(...legend.entries.map((_, index) => labelEnd(legend, index)));
    expect(legend.titleHeight).toBe(0);
    expect(legend.entries[0]!.x).toBe(0);
    expect(legend.titleX!).toBeGreaterThanOrEqual(widestLabel + 6 - 1e-6);
    expect(
      legend.titleX! + measurer.measureWidth(legend.title, legend.titleSize ?? 11),
    ).toBeLessThanOrEqual(legend.width + 1);
  });

  it("places a bottom title after every wrapped row with no top band", () => {
    const legend = build(
      [
        "A deliberately long northern category label",
        "A deliberately long southern category label",
        "A deliberately long western category label",
      ],
      120,
      { titlePosition: "bottom", collision: "wrap" },
    );
    const last = legend.entries.at(-1)!;
    const lastBottom = last.y + (last.height ?? 24);
    expect(legend.titleHeight).toBe(0);
    expect(legend.entries[0]!.y).toBe(0);
    expect(new Set(legend.entries.map((entry) => entry.y)).size).toBeGreaterThan(1);
    expect(legend.titleY!).toBeGreaterThan(lastBottom);
    expect(legend.height).toBeGreaterThan(legend.titleY!);
  });

  it("reserves no title space or coordinates for an empty title", () => {
    const legend = build(["alpha"], 400, { title: "", titlePosition: "left" });
    expect(legend.titleHeight).toBe(0);
    expect(legend.titleX).toBeUndefined();
    expect(legend.titleY).toBeUndefined();
    expect(legend.entries[0]!.x).toBe(0);
    expect(legend.entries[0]!.y).toBe(0);
  });

  it("uses left adaptively only when the title and untruncated keys fit one row", () => {
    const fitting = build(["alpha", "beta"], 400);
    expect(fitting.titleHeight).toBe(0);
    expect(fitting.entries[0]!.x!).toBeGreaterThan(0);
    expect(fitting.entries[0]!.y).toBe(0);

    const wrapping = build(
      [
        "A deliberately long northern category label",
        "A deliberately long southern category label",
      ],
      150,
    );
    expect(wrapping.titleHeight).toBeGreaterThan(0);
    expect(wrapping.entries[0]!.x).toBe(0);
    expect(wrapping.entries[0]!.y).toBeGreaterThanOrEqual(wrapping.titleHeight!);
    expect(wrapping.titleY!).toBeLessThan(wrapping.entries[0]!.y);
  });

  it("keeps vertical guides on top by default and offsets entries for side titles", () => {
    const top = build(["alpha", "beta"], 240, { direction: "vertical" });
    expect(top.titleHeight).toBeGreaterThan(0);
    expect(top.entries[0]!.x).toBe(0);

    const left = build(["alpha", "beta"], 240, {
      direction: "vertical",
      titlePosition: "left",
    });
    expect(left.titleHeight).toBe(0);
    expect(left.entries[0]!.x!).toBeGreaterThan(0);
    expect(left.entries[0]!.y).toBe(0);
    expect(left.titleY).toBeCloseTo(
      left.entries[0]!.y + (left.entries[0]!.height ?? 24) / 2 + (left.labelSize ?? 11) * 0.32,
      6,
    );

    const right = build(["alpha", "beta"], 240, {
      direction: "vertical",
      titlePosition: "right",
    });
    expect(right.titleHeight).toBe(0);
    expect(right.entries[0]!.x).toBe(0);
    expect(right.titleX!).toBeGreaterThanOrEqual(labelEnd(right, 0) + 6 - 1e-6);
  });

  it("bounds long titles, custom title fonts, and oversized keys without overlap", () => {
    const legend = build(["alpha", "beta"], 240, {
      title: "A substantially wider group title",
      titlePosition: "left",
      direction: "vertical",
      titleSize: 32,
      labelSize: 16,
      keySize: 48,
    });
    const first = legend.entries[0]!;
    expect(legend.titleHeight).toBe(0);
    expect(legend.titleLabel).toBeDefined();
    expect(legend.titleLabel!.length).toBeLessThan(legend.title.length);
    expect(first.x!).toBe(measurer.measureWidth(legend.titleLabel!, 32) + (legend.keyGap ?? 6));
    expect(first.x! + 4).toBeGreaterThan(titleEnd(legend));
    expect(first.y).toBeGreaterThan(0);
    expect(first.height).toBe(48);
    expect(first.x! + 4 + legend.swatchSize).toBeLessThanOrEqual(legend.width + 1e-6);
    titleBounds(legend);
  });

  it("does not turn the adaptive default into a forced collision error", () => {
    // The label fits a top title's full row but not the narrower left column.
    const label = "abcdefghijklmnop";
    expect(() => build([label], 150, { collision: "error" })).not.toThrow();
    expect(() => build([label], 150, { collision: "error", titlePosition: "left" })).toThrow(
      LegendLayoutError,
    );
  });

  it("reserves actual narrow labels instead of an ellipsis when sizing a side title", () => {
    for (const label of ["i", ""]) {
      for (const direction of ["horizontal", "vertical"] as const) {
        for (const titlePosition of [undefined, "left", "right"] as const) {
          for (const collision of ["ellipsis", "wrap", "error"] as const) {
            const legend = build([label], 73, {
              collision,
              direction,
              ...(titlePosition !== undefined && { titlePosition }),
            });
            // A measured zero-width label is known, not unknown: the complete
            // title still fits and the empty label is preserved.
            expect(legend.title).toBe("Groups");
            expect(legend.titleLabel).toBeUndefined();
            expect(legend.entries[0]!.label).toBe(label);
            titleBounds(legend);
          }
        }
      }
    }
  });

  it("reserves a 24px interactive key block before right titles in both directions", () => {
    for (const direction of ["horizontal", "vertical"] as const) {
      for (const keySize of [4, 10]) {
        for (const labelSize of [8, 11]) {
          const legend = build(["i"], 240, {
            titlePosition: "right",
            direction,
            keyGap: 0,
            keySize,
            labelSize,
          });
          expect(legend.titleX!).toBeGreaterThanOrEqual((legend.entries[0]!.x ?? 0) + 24 - 1e-6);
          titleBounds(legend);
        }
      }
    }
  });

  it("keeps right titles clear of the row-end target", () => {
    for (const direction of ["horizontal", "vertical"] as const) {
      for (const keySize of [4, 10]) {
        for (const labelSize of [8, 11]) {
          const legend = build(["i", "j"], 73, {
            titlePosition: "right",
            direction,
            keyGap: 0,
            keySize,
            labelSize,
            collision: "ellipsis",
          });
          const rowEnds = new Map<number, number>();
          for (const entry of legend.entries) rowEnds.set(entry.y, entry.x ?? 0);
          for (const x of rowEnds.values()) {
            expect(legend.titleX!).toBeGreaterThanOrEqual(x + 24 - 1e-6);
          }
          titleBounds(legend);
        }
      }
    }
  });

  it("does not overlap title and entries at tiny widths", () => {
    const tinyLeft = build(["alpha", "beta"], 60, { titlePosition: "left" });
    expect(tinyLeft.entries[0]!.x! + 4).toBeGreaterThan(titleEnd(tinyLeft));
    const tinyRight = build(["alpha", "beta"], 60, { titlePosition: "right" });
    const widest = Math.max(...tinyRight.entries.map((_, index) => labelEnd(tinyRight, index)));
    expect(tinyRight.titleX!).toBeGreaterThanOrEqual(widest);
  });

  it("keeps large side titles inside the vertical box in both directions", () => {
    for (const direction of ["vertical", "horizontal"] as const) {
      for (const titlePosition of ["left", "right"] as const) {
        const legend = build(["alpha", "beta"], 400, {
          title: "Group",
          titlePosition,
          direction,
          titleSize: 32,
          labelSize: 11,
        });
        const first = legend.entries[0]!;
        expect(legend.titleY).toBeCloseTo(
          first.y + (first.height ?? 24) / 2 + (legend.labelSize ?? 11) * 0.32,
          6,
        );
        expect(first.y).toBeGreaterThan(0);
        expect(legend.entries.every((entry) => entry.y >= 0)).toBe(true);
        titleBounds(legend);
      }
    }
  });

  it("bounds a side title before spending width on oversized keys", () => {
    const legend = build(["A"], 96, {
      title: "MMMMMM",
      titlePosition: "left",
      direction: "vertical",
      collision: "ellipsis",
      titleSize: 11,
      keySize: 48,
    });
    const first = legend.entries[0]!;
    expect(legend.title).toBe("MMMMMM");
    expect(legend.titleLabel).toBeDefined();
    expect(legend.titleLabel).not.toBe(legend.title);
    expect(first.x!).toBeGreaterThanOrEqual(0);
    expect(first.x! + 4 + legend.swatchSize).toBeLessThanOrEqual(legend.width + 1e-6);
    expect(first.y + (first.height ?? 24)).toBeLessThanOrEqual(legend.height + 1e-6);
    titleBounds(legend);
  });

  it("mirrors the bounded side title on the right", () => {
    const legend = build(["A"], 96, {
      title: "MMMMMM",
      titlePosition: "right",
      direction: "vertical",
      titleSize: 11,
      keySize: 48,
    });
    const widest = Math.max(...legend.entries.map((_, index) => labelEnd(legend, index)));
    expect(legend.titleX!).toBeGreaterThan(4);
    expect(legend.titleX!).toBeGreaterThanOrEqual(widest + 6 - 1e-6);
    expect(legend.entries[0]!.x! + 4 + legend.swatchSize).toBeLessThanOrEqual(legend.width + 1e-6);
    expect(legend.titleLabel).toBeDefined();
    titleBounds(legend);
  });

  it("keeps empty-domain side titles inside the box", () => {
    for (const direction of ["vertical", "horizontal"] as const) {
      for (const titlePosition of ["left", "right"] as const) {
        const legend = build([], 240, {
          title: "Groups",
          titlePosition,
          direction,
        });
        expect(legend.entries).toEqual([]);
        expect(legend.titleLabel).toBeUndefined();
        titleBounds(legend);
      }
    }
  });

  it("applies wrap and error policies to narrowed side titles", () => {
    const wrapped = build(["A deliberately long label"], 120, {
      title: "MMMMMM",
      titlePosition: "left",
      direction: "horizontal",
      collision: "wrap",
      keySize: 48,
    });
    expect(wrapped.titleLabel).toBeDefined();
    expect(wrapped.entries[0]!.lines!.length).toBeGreaterThan(1);
    titleBounds(wrapped);

    expect(() =>
      build(["A"], 96, {
        title: "MMMMMM",
        titlePosition: "left",
        direction: "vertical",
        collision: "error",
        keySize: 48,
      }),
    ).toThrow(LegendLayoutError);
  });
});
