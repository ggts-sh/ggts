import { measurementProvenance } from "./provenance";
/**
 * Client bundle sizes across lib × scenario (default bundle cases, or COMPETITIVE_FULL=1).
 * Vite library mode, esbuild minify, gzip -9.
 *
 *   bun run measure-bundles.ts
 *   COMPETITIVE_FULL=1 bun run measure-bundles.ts
 */
import { build } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import react from "@vitejs/plugin-react";
import { gzipSync } from "node:zlib";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { bundleCasesForRun, LIBS, libSupports, type LibId, type ScenarioId } from "./scenarios";

const root = import.meta.dirname;
const outRoot = path.join(root, "results", "bundles");
if (existsSync(outRoot)) rmSync(outRoot, { recursive: true });
mkdirSync(outRoot, { recursive: true });

const full = Boolean(process.env["COMPETITIVE_FULL"]);
const cases = bundleCasesForRun(full);

/** Thin entry modules under entries/ named `{lib}__{scenario}.ts`. */
function entryPath(lib: LibId, scenario: ScenarioId): string {
  return path.join(root, "entries", `${lib}__${scenario}.ts`);
}

function kb(n: number): number {
  return Math.round((n / 1024) * 10) / 10;
}

type BundleResult = {
  id: string;
  lib: string;
  scenario: string;
  caseId: string;
  ok: boolean;
  note?: string;
  rawBytes?: number;
  gzipBytes?: number;
  rawKB?: number;
  gzipKB?: number;
  error?: string;
};

process.env.NODE_ENV = "production";
const provenance = measurementProvenance();
const results: BundleResult[] = [];

const jobs: { lib: (typeof LIBS)[number]; scenario: ScenarioId; caseId: string }[] = [];
for (const lib of LIBS.filter((l) => l.bundle)) {
  for (const c of cases) {
    if (!libSupports(lib, c.scenario)) continue;
    jobs.push({ lib, scenario: c.scenario, caseId: c.id });
  }
}

// Deduplicate lib×scenario (bundle size does not depend on N, only on code path).
const seen = new Set<string>();
const uniqueJobs = jobs.filter((j) => {
  const key = `${j.lib.id}__${j.scenario}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

for (const job of uniqueJobs) {
  const id = `${job.lib.id}__${job.scenario}`;
  const entry = entryPath(job.lib.id, job.scenario);
  if (!existsSync(entry)) {
    results.push({
      id,
      lib: job.lib.id,
      scenario: job.scenario,
      caseId: job.caseId,
      ok: false,
      note: job.lib.note,
      error: `missing entry ${path.relative(root, entry)}`,
    });
    continue;
  }
  const outDir = path.join(outRoot, id);
  process.stderr.write(`building ${id}...\n`);
  try {
    await build({
      configFile: false,
      logLevel: "error",
      plugins: [
        ...(job.lib.id === "tanstack-react" || job.lib.id === "ggsvelte-react" ? [react()] : []),
        ...(job.lib.id === "svelteplot" ||
        job.lib.id === "layercake" ||
        job.lib.id === "unovis" ||
        job.lib.id === "tanstack-svelte" ||
        job.lib.id === "ggsvelte-ggplot"
          ? [svelte({ compilerOptions: { css: "injected" }, emitCss: false })]
          : []),
      ],
      build: {
        lib: {
          entry,
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
      },
    });
    const raw = readFileSync(path.join(outDir, "bundle.js"));
    const gz = gzipSync(raw, { level: 9 });
    results.push({
      id,
      lib: job.lib.id,
      scenario: job.scenario,
      caseId: job.caseId,
      ok: true,
      note: job.lib.note,
      rawBytes: raw.byteLength,
      gzipBytes: gz.byteLength,
      rawKB: kb(raw.byteLength),
      gzipKB: kb(gz.byteLength),
    });
  } catch (err) {
    results.push({
      id,
      lib: job.lib.id,
      scenario: job.scenario,
      caseId: job.caseId,
      ok: false,
      note: job.lib.note,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

console.log("\n=== Competitive bundles (Vite minify, gzip -9) ===\n");
console.log("id".padEnd(40), "raw KB".padStart(10), "gzip KB".padStart(10));
console.log("-".repeat(62));
for (const r of results) {
  if (!r.ok) {
    console.log(r.id.padEnd(40), "FAIL");
    continue;
  }
  console.log(r.id.padEnd(40), String(r.rawKB).padStart(10), String(r.gzipKB).padStart(10));
}

const payload = {
  generatedAt: new Date().toISOString(),
  provenance,
  full,
  results,
};
writeFileSync(path.join(root, "results", "bundles.json"), JSON.stringify(payload, null, 2));
console.log("\nWrote results/bundles.json");
