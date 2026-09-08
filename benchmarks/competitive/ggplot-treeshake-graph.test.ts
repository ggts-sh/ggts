/**
 * GGPlot tree-shaking attribution (#1420).
 *
 * A Vite consumer importing <GGPlot> with point/line layers must tree-shake
 * specialty geom/stat code (smooth, density, density_2d, sf, contour, violin,
 * hex, boxplot, …). Specialty code may only enter the graph when the app
 * imports the matching <GeomX> component (which self-registers) or calls
 * registerAll() explicitly.
 *
 * Two fixtures:
 *   - fixtures/ggplot-scatter — point/line only: specialty modules excluded.
 *   - fixtures/ggplot-smooth  — positive control: <GeomSmooth> pulls smooth
 *     modules in via component self-registration.
 */
import { describe, expect, it } from "bun:test";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { build } from "vite";

const root = import.meta.dir;

async function buildFixture(fixtureName: string): Promise<{
  moduleIds: string[];
  rawBytes: number;
}> {
  const outDir = path.join(root, "results", "bundles", `_ggplot-treeshake-${fixtureName}`);
  mkdirSync(outDir, { recursive: true });

  // bun test exports NODE_ENV=test, which flips esm-env/vite-plugin-svelte to
  // dev builds (~210KB extra). Measure the production graph consumers get.
  const prevNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  let result;
  try {
    result = await build({
      configFile: false,
      logLevel: "error",
      plugins: [svelte({ compilerOptions: { css: "injected" }, emitCss: false })],
      build: {
        lib: {
          entry: path.join(root, "fixtures", fixtureName, "entry.ts"),
          formats: ["es"],
          fileName: () => "bundle.js",
        },
        outDir,
        emptyOutDir: true,
        minify: "esbuild",
        target: "es2022",
        rollupOptions: { external: [] },
        write: true,
      },
      resolve: {
        conditions: ["svelte", "browser", "import", "module", "default"],
        // Hermetic: resolve the adapter from source so the unit CI lane (which
        // builds only spec/core/cli dist) can run this test. Core/spec still
        // resolve to dist, matching what measure-bundles.ts records.
        alias: [
          {
            find: /^@ggts-sh\/svelte$/,
            replacement: path.join(root, "../../packages/svelte/src/lib/index.ts"),
          },
        ],
      },
    });
  } finally {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
  }

  const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output ?? []);
  const chunk = outputs.find((item) => item.type === "chunk");
  expect(chunk?.type).toBe("chunk");
  if (chunk?.type !== "chunk") throw new Error("expected a chunk output");

  const raw = readFileSync(path.join(outDir, "bundle.js"));
  return { moduleIds: Object.keys(chunk.modules), rawBytes: raw.byteLength };
}

/** Specialty modules a point/line GGPlot app must never bundle. */
const SPECIALTY_MODULE_PATTERNS = [
  "pipeline/geometry-smooth",
  "pipeline/frame-stats-smooth",
  "pipeline/frame-stats-density",
  "pipeline/frame-stats-sf",
  "pipeline/frame-stats-contour",
  "pipeline/frame-stats-boxplot",
  "pipeline/frame-stats-qq",
  "pipeline/frame-stats-ellipse",
  "pipeline/geometry-violin",
  "pipeline/geometry-hex",
  "pipeline/geometry-boxplot",
  "stats/loess",
  "stats/density-2d",
  "stats/contour",
];

const TEMPORAL_RUNTIME_PATTERNS = ["@js-temporal/polyfill", "/jsbi/", "install-temporal"];

function included(moduleIds: string[], pattern: string): string[] {
  return moduleIds.filter((id) => id.includes(pattern));
}

describe("GGPlot point/line bundle (#1420)", () => {
  it("excludes specialty geom/stat modules", async () => {
    const { moduleIds, rawBytes } = await buildFixture("ggplot-scatter");
    for (const pattern of SPECIALTY_MODULE_PATTERNS) {
      expect(included(moduleIds, pattern)).toEqual([]);
    }
    for (const pattern of TEMPORAL_RUNTIME_PATTERNS) {
      expect(included(moduleIds, pattern)).toEqual([]);
    }
    // Production raw is ~1046 KB after the numeric GGPlot graph stopped
    // installing the Temporal polyfill. Keep modest headroom without allowing
    // that dependency back into the default graph.
    expect(rawBytes).toBeLessThan(GGPLOT_SCATTER_MAX_RAW_BYTES);
  }, 120_000);
});

describe("GGPlot smooth bundle (positive control)", () => {
  it("includes smooth modules via <GeomSmooth> self-registration", async () => {
    const { moduleIds } = await buildFixture("ggplot-smooth");
    expect(included(moduleIds, "pipeline/geometry-smooth").length).toBeGreaterThan(0);
    expect(included(moduleIds, "pipeline/frame-stats-smooth").length).toBeGreaterThan(0);
  }, 120_000);
});

describe("GGPlot temporal scale bundle (positive control)", () => {
  it("installs full Temporal support via <ScaleXDate>", async () => {
    const { moduleIds } = await buildFixture("ggplot-date");
    expect(included(moduleIds, "@js-temporal/polyfill").length).toBeGreaterThan(0);
    expect(included(moduleIds, "install-temporal").length).toBeGreaterThan(0);
  }, 120_000);
});

const GGPLOT_SCATTER_MAX_RAW_BYTES = 1_100_000;
