/**
 * Explicit registration API (#1420).
 *
 * Seam A (in-process): `registerAll` / `registerBasic` are exported from the
 * package barrel and are idempotent. (In-process negative assertions are
 * impossible here — bunfig.toml preload registers the full grammar for the
 * whole test process.)
 *
 * Seam B (fresh process): a bare `@ggts-sh/core` import registers NOTHING;
 * unregistered geom/stat errors point at registerAll()/registerBasic();
 * registerBasic() unlocks identity charts only; registerAll() unlocks the
 * full grammar (and Temporal).
 */
import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { getCandidateRuntime } from "../src/candidate-runtime.ts";
import { getStatFrameBuilder } from "../src/pipeline/frame-stats-registry.ts";
import { getGeomBatchBuilder } from "../src/pipeline/geometry-registry.ts";
import { registerAll, registerBasic } from "../src/index.ts";

/** The complete pre-#1420 auto-registered grammar — the composition must not shrink it. */
const ALL_GEOMS = [
  // basic tier
  "point",
  "count",
  "line",
  "step",
  "path",
  "col",
  "bar",
  "area",
  "density",
  "rule",
  "segment",
  "text",
  "label",
  "rect",
  "ribbon",
  "blank",
  // specialty tier
  "qq",
  "dotplot",
  "function",
  "qq_line",
  "quantile",
  "contour",
  "density_2d",
  "density_2d_filled",
  "bin_2d",
  "tile",
  "raster",
  "spoke",
  "abline",
  "curve",
  "rug",
  "polygon",
  "map",
  "sf_text",
  "sf_label",
  "smooth",
  "boxplot",
  "errorbar",
  "violin",
  "linerange",
  "pointrange",
  "crossbar",
  "hex",
  "sf",
];

const ALL_STATS = [
  // basic tier
  "count",
  "sum",
  // specialty tier
  "sf",
  "sf_coordinates",
  "unique",
  "manual",
  "align",
  "connect",
  "ellipse",
  "bin",
  "bin_hex",
  "summary_bin",
  "bindot",
  "bin_2d",
  "density",
  "ydensity",
  "ecdf",
  "density_2d",
  "density_2d_filled",
  "smooth",
  "quantile",
  "contour",
  "boxplot",
  "summary",
  "function",
  "qq",
  "qq_line",
];

describe("explicit registration API (Seam A)", () => {
  it("exports registerAll + registerBasic as idempotent functions", () => {
    expect(typeof registerAll).toBe("function");
    expect(typeof registerBasic).toBe("function");
    // Preload already registered everything; re-calling must not throw.
    expect(() => {
      registerBasic();
    }).not.toThrow();
    expect(() => {
      registerAll();
    }).not.toThrow();
    expect(() => {
      registerAll();
    }).not.toThrow();
  });

  it("registerAll() covers the complete pre-#1420 grammar", () => {
    registerAll();
    for (const geom of ALL_GEOMS) {
      expect(getGeomBatchBuilder(geom), `geom ${geom}`).toBeDefined();
    }
    for (const stat of ALL_STATS) {
      expect(getStatFrameBuilder(stat), `stat ${stat}`).toBeDefined();
    }
    // #1421 parity: registerAll restores the full old-barrel runtime, which
    // includes the interaction-candidate builder.
    expect(getCandidateRuntime()).not.toBeNull();
  });
});

describe("fresh-process registration gating (Seam B)", () => {
  it("bare import registers nothing; registerBasic/registerAll gate the grammar", () => {
    const coreRoot = path.resolve(import.meta.dir, "..");
    const script = `
      import { registerAll, registerBasic, renderToSVGString, runPipeline } from ${JSON.stringify(
        path.join(coreRoot, "src", "index.ts"),
      )};
      import { aes, gg } from "@ggts-sh/spec";

      const rows = [
        { x: 1, y: 10 }, { x: 2, y: 20 }, { x: 3, y: 15 }, { x: 4, y: 25 }, { x: 5, y: 22 },
      ];
      const point = () =>
        renderToSVGString(gg(rows, aes({ x: "x", y: "y" })).geomPoint(), {
          width: 400, height: 300,
        });
      const smooth = () =>
        renderToSVGString(gg(rows, aes({ x: "x", y: "y" })).geomSmooth(), {
          width: 400, height: 300,
        });

      const attempt = (fn) => {
        try {
          fn();
          return "rendered";
        } catch (err) {
          return String(err instanceof Error ? err.message : err);
        }
      };

      const out = {
        pointFresh: attempt(point),
        smoothFresh: attempt(smooth),
      };
      registerBasic();
      out.pointAfterBasic = attempt(point);
      out.smoothAfterBasic = attempt(smooth);
      const candidates = () => {
        const model = runPipeline(gg(rows, aes({ x: "x", y: "y" })).geomPoint().spec(), {
          width: 400, height: 300,
        });
        return model.candidates.size;
      };
      out.candidatesFresh = attempt(candidates);
      registerAll();
      out.smoothAfterAll = attempt(smooth);
      out.candidatesAfterAll = attempt(candidates);
      console.log(JSON.stringify(out));
    `;
    const proc = spawnSync(process.execPath, ["-e", script], {
      cwd: coreRoot,
      encoding: "utf8",
    });
    expect(proc.status).toBe(0);
    const out = JSON.parse(proc.stdout.trim().split("\n").at(-1) ?? "{}") as Record<string, string>;

    // Fresh barrel import: nothing registered, and errors guide to the fix.
    expect(out.pointFresh).toContain("not registered");
    expect(out.pointFresh).toContain("registerAll");
    expect(out.smoothFresh).toContain("not registered");

    // registerBasic(): identity charts only.
    expect(out.pointAfterBasic).toBe("rendered");
    expect(out.smoothAfterBasic).toContain("not registered");

    // registerAll(): full grammar + interaction candidates (#1421).
    expect(out.smoothAfterAll).toBe("rendered");
    expect(out.candidatesFresh).toContain("require @ggts-sh/core");
    expect(out.candidatesAfterAll).not.toContain("not registered");
    expect(out.candidatesAfterAll).not.toContain("require @ggts-sh/core");
  }, 60_000);
});
