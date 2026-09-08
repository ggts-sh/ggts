import { describe, expect, it } from "bun:test";

import {
  aes,
  gg,
  scaleAlphaIdentity,
  scaleLinetypeIdentity,
  scaleLinewidthIdentity,
} from "@ggts-sh/spec";

import { runPipeline } from "../../src/pipeline.ts";
import { candidates, path, size } from "./fixtures.ts";

describe("pipeline post-stat coord_transform — path topology", () => {
  it("tessellates closed area topology without promoting synthetic vertices", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 1 },
          { x: 10, y: 4 },
          { x: 100, y: 9 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomArea()
        .coordTransform({ x: "log10", y: "sqrt" })
        .spec(),
      size,
    );
    const batch = path(model);
    expect(batch.closed).toBe(true);
    expect(batch.positions.length / 2).toBeGreaterThan(6);
    expect([...(batch.semanticAnchors ?? [])].filter((anchor) => anchor === 1)).toHaveLength(6);
    expect(model.candidates.size).toBe(6);
  });
  it("expands step corners before projection and keeps only authored anchors inspectable", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 1 },
          { x: 10, y: 5 },
          { x: 100, y: 20 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomLine({ curve: "step" })
        .coordTransform({ x: "log10", y: "sqrt" })
        .spec(),
      size,
    );
    const batch = path(model);
    expect(batch.curve).toBe("linear");
    expect(batch.positions.length / 2).toBeGreaterThan(3);
    expect(model.candidates.size).toBe(3);
  });
  it("caps render topology without truncating semantic anchors", () => {
    const n = 8_000;
    const rows = Array.from({ length: n }, (_, index) => ({
      x: index % 2 === 0 ? 1 : 1_000_000_000,
      y: index % 2 === 0 ? 1 : 100_000_000,
      group: `segment-${index >>> 1}`,
    }));
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y", group: "group" }))
        .geomLine()
        .coordTransform({ x: "log10", y: "sqrt" })
        .spec(),
      size,
    );
    const batch = path(model);
    expect(batch.positions.length / 2).toBeLessThanOrEqual(65_536);
    expect(model.candidates.size).toBe(n);
    expect(model.warnings.some((warning) => warning.code === "coord-tessellation-cap")).toBe(true);
  });
  it("drops filled subpaths whose closed boundary crosses an invalid coordinate domain", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: -1 },
          { x: 2, y: 10 },
          { x: 3, y: 100 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomArea()
        .coordTransform({ y: { transform: "log10", limits: [1, 100], expand: false } })
        .spec(),
      size,
    );
    const batch = path(model);
    expect(batch.positions).toHaveLength(0);
    expect(batch.pathOffsets).toEqual(Uint32Array.from([0]));
    expect(model.candidates.size).toBe(0);
    expect(model.warnings.some((warning) => warning.code === "coord-invalid-geometry")).toBe(true);
  });
  it("splits paths at values outside the coordinate transform domain", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 1, width: 4, opacity: 0.4, dash: "dashed" },
          { x: 2, y: 2, width: 4, opacity: 0.4, dash: "dashed" },
          { x: 3, y: -1, width: 4, opacity: 0.4, dash: "dashed" },
          { x: 4, y: 10, width: 4, opacity: 0.4, dash: "dashed" },
          { x: 5, y: 100, width: 4, opacity: 0.4, dash: "dashed" },
        ],
        aes({
          x: "x",
          y: "y",
          linewidth: "width",
          alpha: "opacity",
          linetype: "dash",
        }),
      )
        .geomLine()
        .scales({
          ...scaleLinewidthIdentity(),
          ...scaleAlphaIdentity(),
          ...scaleLinetypeIdentity(),
        })
        .coordTransform({ y: { transform: "log10", limits: [1, 100], expand: false } })
        .spec(),
      size,
    );
    const batch = path(model);
    expect(batch.pathOffsets).toHaveLength(3);
    expect(batch.linewidths).toEqual(Float32Array.from([4, 4]));
    expect(batch.alphas).toEqual(Float32Array.from([0.4, 0.4]));
    expect(batch.linetypeIndexes).toEqual(Uint8Array.from([1, 1]));
    expect(
      [0, 1].map(
        (subpath) =>
          [...(batch.semanticAnchors ?? [])]
            .slice(batch.pathOffsets[subpath], batch.pathOffsets[subpath + 1])
            .filter((anchor) => anchor === 1).length,
      ),
    ).toEqual([2, 2]);
    expect([...batch.positions].every((value) => Number.isFinite(value))).toBe(true);
    expect(model.candidates.size).toBe(4);
    const anchorIndexes = [...(batch.semanticAnchors ?? [])].flatMap((anchor, index) =>
      anchor === 1 ? [index] : [],
    );
    // Candidate primitive indexes remain renderer-space indexes even though
    // semanticIndex points back into the pre-split/stat topology.
    expect(candidates(model).map((candidate) => candidate.primitiveIndex)).toEqual(anchorIndexes);
    expect(model.warnings.some((warning) => warning.code === "coord-invalid-geometry")).toBe(true);
  });
  it("keeps post-split path candidate values aligned with pre-split semantic vertices", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 1 },
          { x: 2, y: 2 },
          { x: 3, y: -1 },
          { x: 4, y: 10 },
          { x: 5, y: 100 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomLine()
        .coordTransform({ y: { transform: "log10", limits: [1, 100], expand: false } })
        .spec(),
      size,
    );
    // Two finite runs: (1,1)-(2,2) and (4,10)-(5,100). Values must stay on the
    // authored vertices, not shift to neighbors after pathOffsets re-index.
    const xs = candidates(model)
      .map((candidate) => Number(candidate.xValue))
      .toSorted((a, b) => a - b);
    const ys = candidates(model)
      .map((candidate) => Number(candidate.yValue))
      .toSorted((a, b) => a - b);
    expect(xs).toEqual([1, 2, 4, 5]);
    expect(ys).toEqual([1, 2, 10, 100]);
  });
  it("tessellates nonlinear paths without creating semantic candidates", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 1 },
          { x: 100, y: 100 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomLine()
        .coordTransform({ x: "log10", y: "sqrt" })
        .spec(),
      size,
    );
    const batch = path(model);
    expect(batch.positions.length / 2).toBeGreaterThan(2);
    expect(model.candidates.size).toBe(2);
    expect(candidates(model).map((candidate) => candidate.xValue)).toEqual([1, 100]);
    const syntheticCandidates = [...(batch.semanticAnchors ?? [])]
      .map((anchor, index) => ({ anchor, index }))
      .filter(({ anchor }) => anchor === 0);
    const synthetic = syntheticCandidates[Math.floor(syntheticCandidates.length / 2)]?.index ?? -1;
    expect(synthetic).toBeGreaterThanOrEqual(0);
    const panel = model.scene.panels[0]!;
    const hit = model.candidates.hitTest(
      panel.x + batch.positions[synthetic * 2]!,
      panel.y + batch.positions[synthetic * 2 + 1]!,
    );
    expect(hit).not.toBeNull();
    expect([1, 100]).toContain(hit?.xValue);
  });
});
