/**
 * ggplot2/R parity for facet partitioning + per-panel stat outputs and the
 * coord-flip axis contract, against the R-generated fixtures in
 * tests/fixtures/facets (regenerate with
 * `Rscript packages/core/tests/fixtures/facets/generate.R`).
 *
 * Two assertion levels:
 *  - STAT level (exact, 1e-9): per-panel statBin with/without the shared
 *    break-grid range reproduces ggplot2's fixed vs free_x facet binning.
 *  - PIPELINE level (structural): runPipeline partitions before stats — the
 *    per-panel rect batches carry exactly ggplot2's per-panel counts
 *    (recovered by inverting the shared linear count scale; counts are
 *    integers, so float32 pixel noise rounds away).
 *
 * Known representational difference (deliberate, decision 0005 lineage):
 * ggplot2 orders discrete domains by factor level (alphabetical for
 * characters); ggts's band domains are first-seen. Assertions therefore
 * match BY LABEL, never by band index.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { gg, aes } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";
import type { RectsBatch, Scene } from "../src/scene.ts";
import { statBin } from "../src/stats/bin.ts";
import type { CellValue } from "../src/table.ts";

const dir = join(import.meta.dir, "fixtures", "facets");

interface Fixture<E> {
  case: string;
  data: Record<string, CellValue[]>;
  expected: E;
}

function load<E>(name: string): Fixture<E> {
  return JSON.parse(readFileSync(join(dir, name), "utf8")) as Fixture<E>;
}

function rowsOf(data: Record<string, CellValue[]>): Record<string, CellValue>[] {
  const fields = Object.keys(data);
  const n = data[fields[0]!]!.length;
  return Array.from({ length: n }, (_, i) =>
    Object.fromEntries(fields.map((f) => [f, data[f]![i]!])),
  );
}

const size = { width: 640, height: 400 };

/** Recover a rect's data-space count from the shared zero-based y scale. */
function countOf(scene: Scene, rect: { y: number; height: number }, domain: [number, number]) {
  const panel = scene.panels[0]!;
  const span = domain[1] - domain[0];
  // rect.height/panel.height = t(count) - t(0); linear scale with domain[0] = 0.
  return (rect.height / panel.height) * span;
}

function rectsOfPanel(scene: Scene, panelIndex: number): RectsBatch[] {
  return scene.batches.filter(
    (b): b is RectsBatch => b.kind === "rects" && b.panelIndex === panelIndex,
  );
}

describe("facet_wrap + count — R parity (pipeline level)", () => {
  const fixture = load<{ panel: number[]; xLabel: string[]; count: number[] }>(
    "01-wrap-count.json",
  );

  it("partitions before the count stat: per-panel counts match ggplot2 layer_data", () => {
    const model = runPipeline(
      gg(rowsOf(fixture.data), aes({ x: "cat" }))
        .geomBar()
        .facet({ wrap: "g" })
        // flush count axis: this test converts rect heights back to counts
        // through the domain, so the 5% display expansion must be disabled.
        .scales({ y: { expand: { mult: 0, add: 0 } } })
        .spec(),
      size,
    );
    const scene = model.scene;
    expect(scene.panels).toHaveLength(3);
    // ggplot2 PANEL ids are 1-based in sorted-g order; our wrap panels sort
    // ascending too, so PANEL n corresponds to panels[n - 1].
    const yDomain = (model.scales.y as { domain: [number, number] }).domain;
    expect(yDomain[0]).toBe(0); // bars force zero

    // Build the R reference: count per (panel, category label).
    const reference = new Map<string, number>();
    for (let i = 0; i < fixture.expected.panel.length; i++) {
      reference.set(
        `${fixture.expected.panel[i]}:${fixture.expected.xLabel[i]}`,
        fixture.expected.count[i]!,
      );
    }

    const xScale = model.scales.x as {
      domain: readonly string[];
      normalize(v: unknown): number | undefined;
    };
    let asserted = 0;
    for (let p = 0; p < 3; p++) {
      const panel = scene.panels[p]!;
      for (const batch of rectsOfPanel(scene, p)) {
        for (let j = 0; j < batch.rects.length / 4; j++) {
          const x = batch.rects[j * 4]!;
          const w = batch.rects[j * 4 + 2]!;
          const height = batch.rects[j * 4 + 3]!;
          // Band category from the rect center.
          const center = (x + w / 2) / panel.width;
          const label = xScale.domain.find(
            (cat) => Math.abs((xScale.normalize(cat) ?? -1) - center) < 1e-3,
          );
          expect(label).toBeDefined();
          const count = Math.round(countOf(scene, { y: batch.rects[j * 4 + 1]!, height }, yDomain));
          expect(count).toBe(reference.get(`${p + 1}:${label}`) ?? -1);
          asserted++;
        }
      }
    }
    // Every R row with a nonzero count must have been matched (ggplot2 emits
    // zero-count rows for categories absent from a panel; ggts's count
    // stat emits only present categories — the zero bars draw nothing).
    const nonzero = fixture.expected.count.filter((c) => c > 0).length;
    expect(asserted).toBe(nonzero);
  });
});

describe("facet_wrap + bin — R parity (stat level, exact)", () => {
  const groupsOf = (n: number) => Array.from({ length: n }, () => 0);

  function panelInputs(data: Record<string, CellValue[]>, panel: string): Float64Array {
    const v = data["v"] as number[];
    const g = data["g"] as string[];
    return Float64Array.from(v.filter((_, i) => g[i] === panel));
  }

  it("FIXED scales share one break grid across panels (range override)", () => {
    const fixture = load<{ panel: number[]; xmin: number[]; xmax: number[]; count: number[] }>(
      "02-wrap-bin-fixed.json",
    );
    const v = fixture.data["v"] as number[];
    const range: [number, number] = [Math.min(...v), Math.max(...v)];
    for (const [panelId, name] of [
      [1, "p1"],
      [2, "p2"],
    ] as const) {
      const x = panelInputs(fixture.data, name);
      const result = statBin({ x, groups: groupsOf(x.length), params: { bins: 10 }, range });
      const expectIdx = fixture.expected.panel
        .map((p, i) => (p === panelId ? i : -1))
        .filter((i) => i >= 0);
      expect(result.count.length).toBe(expectIdx.length);
      for (let k = 0; k < expectIdx.length; k++) {
        const i = expectIdx[k]!;
        expect(Math.abs(result.xmin[k]! - fixture.expected.xmin[i]!)).toBeLessThan(1e-9);
        expect(Math.abs(result.xmax[k]! - fixture.expected.xmax[i]!)).toBeLessThan(1e-9);
        expect(result.count[k]!).toBe(fixture.expected.count[i]!);
      }
    }
  });

  it("free_x scales derive per-panel break grids (no override)", () => {
    const fixture = load<{ panel: number[]; xmin: number[]; xmax: number[]; count: number[] }>(
      "03-wrap-bin-free-x.json",
    );
    for (const [panelId, name] of [
      [1, "p1"],
      [2, "p2"],
    ] as const) {
      const x = panelInputs(fixture.data, name);
      const result = statBin({ x, groups: groupsOf(x.length), params: { bins: 10 } });
      const expectIdx = fixture.expected.panel
        .map((p, i) => (p === panelId ? i : -1))
        .filter((i) => i >= 0);
      expect(result.count.length).toBe(expectIdx.length);
      for (let k = 0; k < expectIdx.length; k++) {
        const i = expectIdx[k]!;
        expect(Math.abs(result.xmin[k]! - fixture.expected.xmin[i]!)).toBeLessThan(1e-9);
        expect(result.count[k]!).toBe(fixture.expected.count[i]!);
      }
    }
  });

  it("pipeline level: fixed scales align rect edges across panels; free_x does not", () => {
    const rows = rowsOf(load<never>("02-wrap-bin-fixed.json").data);
    const edgesOf = (scene: Scene, p: number) =>
      rectsOfPanel(scene, p).flatMap((b) =>
        Array.from({ length: b.rects.length / 4 }, (_, j) => Math.round(b.rects[j * 4]! * 10) / 10),
      );

    const fixed = runPipeline(
      gg(rows, aes({ x: "v" }))
        .geomHistogram({ bins: 10 })
        .facet({ wrap: "g" })
        .spec(),
      size,
    ).scene;
    // Shared break grid + shared x scale: panel rect x-edges coincide.
    expect(edgesOf(fixed, 0)).toEqual(edgesOf(fixed, 1));

    const free = runPipeline(
      gg(rows, aes({ x: "v" }))
        .geomHistogram({ bins: 10 })
        .facet({ wrap: "g", scales: "free_x" })
        .spec(),
      size,
    ).scene;
    expect(edgesOf(free, 0)).not.toEqual(edgesOf(free, 1));
  });
});

describe("coord_flip — R parity (axis contract)", () => {
  const fixture = load<{
    xLabel: string[];
    count: number[];
    yAxisLabels: string[];
    xRange: [number, number];
  }>("04-coord-flip-bar.json");
  const expected = fixture.expected;

  it("flips the discrete axis to the left (first category at the BOTTOM) and the count axis to the bottom", () => {
    const rows = rowsOf(fixture.data);
    const model = runPipeline(
      gg(rows, aes({ x: "cat" }))
        .geomBar()
        // flush count axis: bar left edges and width->count use pixel 0 as the
        // baseline, so disable the 5% display expansion for this parity check.
        .scales({ y: { expand: { mult: 0, add: 0 } } })
        .coordFlip()
        .spec(),
      size,
    );
    const panel = model.scene.panels[0]!;

    // Left axis carries the categories. ggplot2 puts the FIRST domain level
    // at the bottom (largest pixel y); domain ORDER differs by design
    // (first-seen vs alphabetical), so assert the placement contract.
    const left = [...(panel.axisY ?? [])].toSorted((a, b) => b.pos - a.pos); // bottom-to-top
    const domain = (model.scales.x as { domain: readonly string[] }).domain;
    expect(left.map((t) => t.label)).toEqual([...domain]);
    // R contract sanity: its y axis (bottom-to-top) is ITS domain order too.
    expect(new Set(left.map((t) => t.label))).toEqual(new Set(expected.yAxisLabels));

    // Bottom axis carries the counts: our shared y (count) domain must cover
    // R's built x.range (R pads by expansion; we nice() — both contain the
    // raw count extent).
    const yDomain = (model.scales.y as { domain: [number, number] }).domain;
    const maxCount = Math.max(...expected.count);
    expect(yDomain[0]).toBeLessThanOrEqual(0);
    expect(yDomain[1]).toBeGreaterThanOrEqual(maxCount);
    expect(panel.axisX).not.toBeNull();
    // Bottom labels are numeric (the measure), not categories.
    for (const tick of panel.axisX ?? []) {
      if (tick.label !== "") expect(Number.isFinite(Number(tick.label))).toBe(true);
    }

    // The bars themselves are horizontal: every rect is a full-height band
    // slice (height = band fraction) with width proportional to its count.
    const rects = rectsOfPanel(model.scene, 0);
    expect(rects.length).toBeGreaterThan(0);
    const reference = new Map<string, number>();
    for (let i = 0; i < expected.xLabel.length; i++) {
      reference.set(expected.xLabel[i]!, expected.count[i]!);
    }
    const xScale = model.scales.x as {
      domain: readonly string[];
      normalize(v: unknown): number | undefined;
    };
    const span = yDomain[1] - yDomain[0];
    for (const batch of rects) {
      for (let j = 0; j < batch.rects.length / 4; j++) {
        const x = batch.rects[j * 4]!;
        const y = batch.rects[j * 4 + 1]!;
        const w = batch.rects[j * 4 + 2]!;
        const h = batch.rects[j * 4 + 3]!;
        // Horizontal bar: anchored at the left edge (count 0), extends right.
        expect(x).toBeCloseTo(0, 3);
        const count = Math.round((w / panel.width) * span);
        // Band center on the VERTICAL axis, measured from the bottom.
        const centerFromBottom = (panel.height - (y + h / 2)) / panel.height;
        const label = xScale.domain.find(
          (cat) => Math.abs((xScale.normalize(cat) ?? -1) - centerFromBottom) < 1e-3,
        );
        expect(label).toBeDefined();
        expect(count).toBe(reference.get(label!) ?? -1);
      }
    }
  });
});
