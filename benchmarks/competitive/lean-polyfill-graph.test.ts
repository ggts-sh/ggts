/**
 * Vite tree-shaken client graphs for the competitive lean ggsvelte entries
 * (SVG + canvas) must not include @js-temporal/polyfill or jsbi.
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { build } from "vite";

const root = import.meta.dir;

async function buildEntry(entryName: string): Promise<{ moduleIds: string[]; rawBytes: number }> {
  const outDir = path.join(root, "results", "bundles", `_lean-polyfill-test-${entryName}`);
  mkdirSync(outDir, { recursive: true });

  const result = await build({
    configFile: false,
    logLevel: "error",
    build: {
      lib: {
        entry: path.join(root, "entries", entryName),
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
      conditions: ["import", "module", "default"],
    },
  });

  const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output ?? []);
  const chunk = outputs.find((item) => item.type === "chunk");
  expect(chunk?.type).toBe("chunk");
  if (chunk?.type !== "chunk") throw new Error("expected a chunk output");

  const raw = readFileSync(path.join(outDir, "bundle.js"));
  return { moduleIds: Object.keys(chunk.modules), rawBytes: raw.byteLength };
}

function expectPolyfillFree(
  { moduleIds, rawBytes }: { moduleIds: string[]; rawBytes: number },
  maxRawBytes: number,
): void {
  expect(moduleIds.filter((id) => id.includes("@js-temporal/polyfill"))).toEqual([]);
  expect(
    moduleIds.filter((id) => id.includes(`${path.sep}jsbi${path.sep}`) || id.includes("jsbi-umd")),
  ).toEqual([]);

  // Pre-fix lean graphs carried the polyfill (~210KB raw extra); stay under the floor.
  expect(rawBytes).toBeGreaterThan(50_000);
  expect(rawBytes).toBeLessThan(maxRawBytes);
}

describe("lean competitive SVG graph", () => {
  it("excludes Temporal polyfill and jsbi after minify", async () => {
    // Pre-fix lean SVG was ~827KB raw with polyfill; keep the 700KB floor.
    expectPolyfillFree(await buildEntry("ggsvelte-svg__scatter-color.ts"), 700_000);
  }, 120_000);
});

describe("lean competitive canvas graph", () => {
  it("excludes Temporal polyfill and jsbi after minify", async () => {
    // Canvas marks need planStrata; it must come from the lean render graph,
    // not the full @ggts-sh/core barrel (which installs Temporal on import).
    expectPolyfillFree(await buildEntry("ggsvelte-canvas__scatter-color.ts"), 700_000);
  }, 120_000);
});
