/**
 * One-shot high-N peer comparison (not the CI harness).
 *
 * Measures ggsvelte vs SveltePlot / LayerCake / Unovis / TanStack Charts Svelte
 * on 100k-scale cases with:
 * - fewer samples (1 warmup + 5 samples) so wall time stays practical
 * - per-evaluate timeout so a hung/OOM peer fails the cell instead of wedging the run
 *
 *   bun run measure-100k-peers.ts
 *
 * Writes results/browser-100k-peers.json (does not overwrite browser.json).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { createServer } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import react from "@vitejs/plugin-react";

import { CASES, LIBS, libSupports, type LibMeta } from "./scenarios";

const root = import.meta.dirname;
const resultsDir = path.join(root, "results");
mkdirSync(resultsDir, { recursive: true });

/** Peer + ggsvelte only. */
const LIB_IDS = [
  "ggsvelte-svg",
  "ggsvelte-canvas",
  "layercake",
  "layercake-canvas",
  "svelteplot",
  "unovis",
  "tanstack-svelte",
] as const;

const CASE_IDS = ["scatter-color-100k", "line-10x10k"] as const;

/** Max wall time for a single mount/update evaluate (ms). */
const EVAL_TIMEOUT_MS = 180_000;
const WARMUP = 1;
const SAMPLES = 5;

type BenchApi = {
  mount: (lib: string, caseId: string) => Promise<{ ms: number; markHint: number }>;
  update: (lib: string, caseId: string) => Promise<{ ms: number }>;
  endUpdate: () => void;
};

const cases = CASES.filter((c) => (CASE_IDS as readonly string[]).includes(c.id));
const browserLibs = LIBS.filter((l) => l.browser && (LIB_IDS as readonly string[]).includes(l.id));

function pairs(): { lib: LibMeta; caseId: string; scenario: string; n: number }[] {
  const out: { lib: LibMeta; caseId: string; scenario: string; n: number }[] = [];
  for (const c of cases) {
    for (const lib of browserLibs) {
      if (!libSupports(lib, c.scenario)) continue;
      out.push({ lib, caseId: c.id, scenario: c.scenario, n: c.n });
    }
  }
  return out;
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms (${label})`)), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function medianMs(
  fn: () => Promise<number>,
  { warmup = WARMUP, samples = SAMPLES } = {},
): Promise<{ median: number; mean: number; p95: number; samples: number[] }> {
  for (let i = 0; i < warmup; i++) await fn();
  const times: number[] = [];
  for (let i = 0; i < samples; i++) times.push(await fn());
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)]!;
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const p95 = times[Math.min(times.length - 1, Math.floor(times.length * 0.95))]!;
  return {
    median: +median.toFixed(3),
    mean: +mean.toFixed(3),
    p95: +p95.toFixed(3),
    samples: times.map((t) => +t.toFixed(3)),
  };
}

const server = await createServer({
  configFile: false,
  root: path.join(root, "fixtures"),
  server: { host: "127.0.0.1", port: 5201, strictPort: true },
  plugins: [react(), svelte({ compilerOptions: { css: "injected" }, emitCss: false })],
  resolve: {
    conditions: ["svelte", "browser", "import", "module", "default"],
    dedupe: ["svelte", "react", "react-dom"],
  },
  optimizeDeps: {
    exclude: ["svelte", "svelteplot", "layercake", "@unovis/svelte"],
    include: [
      "@ggts-sh/core",
      "@ggts-sh/core/render",
      "@ggts-sh/core/dom",
      "@ggts-sh/spec/portable",
      "@unovis/ts",
      "d3-scale",
      "d3-selection",
      "d3-array",
      "d3-axis",
      "d3-shape",
      "react",
      "react/jsx-runtime",
      "react-dom",
      "react-dom/client",
      "@tanstack/charts/react",
    ],
  },
});
await server.listen();
await server.warmupRequest("/main.ts");

const browser = await chromium.launch({
  args: ["--disable-frame-rate-limit", "--disable-gpu-vsync"],
});
let page = await browser.newPage();
// Keep Playwright's own timeout above our race so we surface our message.
page.setDefaultTimeout(EVAL_TIMEOUT_MS + 30_000);

function wirePageDiagnostics(p: Page): void {
  p.on("pageerror", (e) => process.stderr.write(`PAGEERROR: ${String(e).slice(0, 800)}\n`));
  p.on("console", (m) => {
    if (m.type() === "error") {
      process.stderr.write(`CONSOLE-ERR: ${m.text().slice(0, 400)}\n`);
    }
  });
}
wirePageDiagnostics(page);

async function waitForBenchApi(): Promise<void> {
  await page.waitForFunction(() => {
    const w = window as unknown as { competitiveBench?: BenchApi };
    return w.competitiveBench !== undefined;
  });
}

async function gotoBenchPage(p: Page): Promise<void> {
  await p.goto("http://127.0.0.1:5201/");
  await waitForBenchApi();
}

async function recoverPage(): Promise<void> {
  try {
    await page.close();
  } catch {
    // already closed
  }
  page = await browser.newPage();
  page.setDefaultTimeout(EVAL_TIMEOUT_MS + 30_000);
  wirePageDiagnostics(page);
  await gotoBenchPage(page);
}

await gotoBenchPage(page);

const results: Record<string, unknown>[] = [];
const matrix = pairs();
process.stderr.write(
  `100k peer browser: ${matrix.length} cells (cases=${cases.map((c) => c.id).join(",")}, libs=${browserLibs.map((l) => l.id).join(",")})\n`,
);
process.stderr.write(`samples=${SAMPLES} warmup=${WARMUP} evalTimeoutMs=${EVAL_TIMEOUT_MS}\n`);

for (const cell of matrix) {
  const label = `${cell.lib.id} ${cell.caseId}`;
  process.stderr.write(`bench mount ${label}...\n`);
  try {
    const mountStats = await medianMs(async () => {
      const r = await withTimeout(
        page.evaluate(
          async ({ library, caseId }) => {
            const w = window as unknown as { competitiveBench: BenchApi };
            return w.competitiveBench.mount(library, caseId);
          },
          { library: cell.lib.id, caseId: cell.caseId },
        ),
        EVAL_TIMEOUT_MS,
        `mount ${label}`,
      );
      return r.ms;
    });
    process.stderr.write(`  mount median ${mountStats.median}ms\n`);
    const updateStats = await medianMs(async () => {
      const r = await withTimeout(
        page.evaluate(
          async ({ library, caseId }) => {
            const w = window as unknown as { competitiveBench: BenchApi };
            return w.competitiveBench.update(library, caseId);
          },
          { library: cell.lib.id, caseId: cell.caseId },
        ),
        EVAL_TIMEOUT_MS,
        `update ${label}`,
      );
      return r.ms;
    });
    process.stderr.write(`  update median ${updateStats.median}ms\n`);
    await page.evaluate(() => {
      const w = window as unknown as { competitiveBench: BenchApi };
      w.competitiveBench.endUpdate();
    });
    results.push({
      lib: cell.lib.id,
      caseId: cell.caseId,
      scenario: cell.scenario,
      n: cell.n,
      ok: true,
      mountMedianMs: mountStats.median,
      mountMeanMs: mountStats.mean,
      mountP95Ms: mountStats.p95,
      mountSamples: mountStats.samples,
      updateMedianMs: updateStats.median,
      updateMeanMs: updateStats.mean,
      updateP95Ms: updateStats.p95,
      updateSamples: updateStats.samples,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`FAIL ${label}: ${message}\n`);
    results.push({
      lib: cell.lib.id,
      caseId: cell.caseId,
      scenario: cell.scenario,
      n: cell.n,
      ok: false,
      error: message,
    });
    await recoverPage();
  }
}

console.log("\n=== 100k peer browser (Chromium, median cold mount / in-place update) ===\n");
console.log("lib".padEnd(18), "case".padEnd(22), "mount".padStart(12), "update".padStart(12));
console.log("-".repeat(66));
for (const r of results) {
  if (!r["ok"]) {
    console.log(String(r["lib"]).padEnd(18), String(r["caseId"]).padEnd(22), "FAIL");
    continue;
  }
  console.log(
    String(r["lib"]).padEnd(18),
    String(r["caseId"]).padEnd(22),
    `${r["mountMedianMs"]}ms`.padStart(12),
    `${r["updateMedianMs"]}ms`.padStart(12),
  );
}

const payload = {
  generatedAt: new Date().toISOString(),
  host: {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
  },
  protocol: {
    warmup: WARMUP,
    samples: SAMPLES,
    evalTimeoutMs: EVAL_TIMEOUT_MS,
    note: "Fewer samples + hard evaluate timeout vs CI measure-browser.ts (2/11, no race).",
  },
  caseIds: CASE_IDS,
  libIds: LIB_IDS,
  results,
};
const outPath = path.join(resultsDir, "browser-100k-peers.json");
writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log(`\nWrote ${outPath}`);

await browser.close();
await server.close();
