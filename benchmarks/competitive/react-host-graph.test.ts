/**
 * React host bundle graph: the default entry (`@ggts-sh/react`) registers the
 * basic grammar; the lean entry (`@ggts-sh/react/lean`) keeps only the
 * families the app registers. Sources resolve from packages/react/src so the
 * unit lane needs no React dist build.
 */
import { describe, expect, it } from "bun:test";
import react from "@vitejs/plugin-react";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { build } from "vite";

const root = import.meta.dir;
const reactSrc = path.join(root, "../../packages/react/src");

async function moduleIdsFor(component: string): Promise<string[]> {
  const outDir = path.join(root, "results", "bundles", `_react-host-${component}`);
  mkdirSync(outDir, { recursive: true });
  const result = await build({
    configFile: false,
    logLevel: "error",
    plugins: [react()],
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    build: {
      lib: {
        entry: path.join(root, "components", "ggsvelte-react", `${component}.tsx`),
        formats: ["es"],
        fileName: () => "bundle.js",
      },
      outDir,
      emptyOutDir: true,
      target: "es2022",
      write: false,
    },
    resolve: {
      alias: [
        { find: /^@ggts-sh\/react$/, replacement: path.join(reactSrc, "index.ts") },
        { find: /^@ggts-sh\/react\/lean$/, replacement: path.join(reactSrc, "lean.ts") },
      ],
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) =>
    "output" in item ? item.output : [],
  );
  const chunk = outputs.find((item) => item.type === "chunk");
  if (chunk?.type !== "chunk") throw new Error("expected a chunk output");
  return Object.keys(chunk.modules);
}

/** Basic registration that only the default entry (host-init) brings in. */
const DEFAULT_REGISTRATION_PATTERNS = [
  "react/src/host-init",
  "pipeline/register-color-all",
  "pipeline/register-style-all",
  "pipeline/register-basic-areas",
  "layout/register-band-guide",
];

function included(moduleIds: string[], pattern: string): string[] {
  return moduleIds.filter((id) => id.includes(pattern));
}

describe("React host bundle graph", () => {
  it("default entry keeps host-init and the basic registration", async () => {
    const moduleIds = await moduleIdsFor("ScatterChart");
    for (const pattern of DEFAULT_REGISTRATION_PATTERNS) {
      expect(included(moduleIds, pattern).length, pattern).toBeGreaterThan(0);
    }
  }, 120_000);

  it("lean entry keeps only the registered families and the host runtime", async () => {
    const moduleIds = await moduleIdsFor("ScatterChartLean");
    for (const pattern of DEFAULT_REGISTRATION_PATTERNS) {
      expect(included(moduleIds, pattern), pattern).toEqual([]);
    }
    expect(included(moduleIds, "react/src/host-runtime").length).toBeGreaterThan(0);
    expect(included(moduleIds, "pipeline/register-basic-points").length).toBeGreaterThan(0);
    expect(included(moduleIds, "pipeline/register-color-manual").length).toBeGreaterThan(0);
  }, 120_000);
});
