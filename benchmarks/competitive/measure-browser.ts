/**
 * Browser paint competitive bench (Playwright Chromium).
 *
 * Matrix: browser-enabled libs × scenario cases (default subset, or COMPETITIVE_FULL=1).
 * Metrics per cell: cold mount plus IN-PLACE update medians, each reported as
 * paint-inclusive total time and synchronous adapter time (warmup 2 / samples
 * 11, alternating perturbed data). Each library×case cell gets a fresh page so
 * framework state and page-heap pressure from earlier cells cannot skew peers.
 * replace* columns mirror mount until a distinct remount metric is wanted
 * (full remount is not re-sampled).
 *
 *   bun run measure-browser.ts
 *   COMPETITIVE_FULL=1 bun run measure-browser.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { build, preview } from "vite";
import { measurementProvenance } from "./provenance";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import react from "@vitejs/plugin-react";

import { CASES, casesForRun, LIBS, libSupports, type LibMeta } from "./scenarios";

const root = import.meta.dirname;
const resultsDir = path.join(root, "results");
mkdirSync(resultsDir, { recursive: true });

const full = Boolean(process.env["COMPETITIVE_FULL"]);
// Optional focus filters for debugging contested cells:
//   COMPETITIVE_LIBS=ggsvelte-svg,layercake COMPETITIVE_CASES=line-3x10k bun run measure-browser.ts
const onlyLibs = process.env["COMPETITIVE_LIBS"]
  ?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const onlyCases = process.env["COMPETITIVE_CASES"]
  ?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const cases = casesForRun(full).filter((c) => !onlyCases || onlyCases.includes(c.id));
const browserLibs = LIBS.filter((lib) => lib.browser && (!onlyLibs || onlyLibs.includes(lib.id)));
let benchUrl = "http://127.0.0.1:5199/";

type BenchApi = {
  mount: (lib: string, caseId: string) => Promise<{ ms: number; syncMs: number; markHint: number }>;
  replace: (lib: string, caseId: string) => Promise<{ ms: number }>;
  update: (lib: string, caseId: string) => Promise<{ ms: number; syncMs: number }>;
  endUpdate: () => void;
  list: () => {
    libs: { id: string; browser: boolean }[];
    cases: { id: string }[];
  };
  /** #1471: live patcher DOM ≡ fresh full render. */
  parityLiveSvg: (caseId: string) => { equal: boolean; detail: string };
  verifyUpdate: (
    lib: string,
    caseId: string,
  ) => Promise<{ equal: boolean; mutated: boolean; detail: string }>;
};

type Timing = { ms: number; syncMs: number };
type TimingStats = { median: number; mean: number; p95: number; samples: number[] };

function summarize(times: number[]): TimingStats {
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

async function medianTiming(
  fn: () => Promise<Timing>,
  { warmup = 2, samples = 11 } = {},
): Promise<{ total: TimingStats; sync: TimingStats }> {
  for (let i = 0; i < warmup; i++) await fn();
  const totalTimes: number[] = [];
  const syncTimes: number[] = [];
  for (let i = 0; i < samples; i++) {
    const timing = await fn();
    totalTimes.push(timing.ms);
    syncTimes.push(timing.syncMs);
  }
  return { total: summarize(totalTimes), sync: summarize(syncTimes) };
}

function pairs(): { lib: LibMeta; caseId: string; scenario: string; n: number }[] {
  const out: { lib: LibMeta; caseId: string; scenario: string; n: number }[] = [];
  // Case-outer so peer and ggsvelte cells for the same chart share warm
  // Chromium/canvas state — lib-outer cold-started the first lib on each
  // dense cell and inflated the relative gate (#1468).
  for (const c of cases) {
    for (const lib of browserLibs) {
      if (!libSupports(lib, c.scenario)) continue;
      out.push({ lib, caseId: c.id, scenario: c.scenario, n: c.n });
    }
  }
  return out;
}

process.env.NODE_ENV = "production";
const outDir = path.join(root, ".browser-dist");
const config = {
  configFile: false as const,
  root: path.join(root, "fixtures"),
  logLevel: "warn" as const,
  plugins: [react(), svelte({ compilerOptions: { css: "injected" }, emitCss: false })],
  resolve: {
    conditions: ["svelte", "browser", "import", "module", "default"],
    dedupe: ["svelte", "react", "react-dom"],
  },
  build: { outDir, emptyOutDir: true, target: "es2022" },
};
await build(config);
const server = await preview({
  ...config,
  preview: { host: "127.0.0.1", port: 5199, strictPort: true },
});

// Paint-inclusive timing uses a double-rAF; a vsync-locked compositor floors
// every cell at ~2 frames (~32 ms @60Hz) and hides real CPU differences.
// Unthrottle frame production so mount time reflects work, not refresh rate.
const browser = await chromium.launch({
  args: ["--disable-frame-rate-limit", "--disable-gpu-vsync"],
});
const provenance = measurementProvenance(browser.version());
let page = await browser.newPage();
page.setDefaultTimeout(120_000);

function wirePageDiagnostics(p: Page): void {
  p.on("pageerror", (e) => process.stderr.write(`PAGEERROR: ${String(e).slice(0, 800)}\n`));
  p.on("console", (m) => {
    if (m.type() === "error") {
      process.stderr.write(`CONSOLE-ERR: ${m.text().slice(0, 400)}\n`);
    }
  });
}
wirePageDiagnostics(page);

const results: Record<string, unknown>[] = [];
const matrix = pairs();
process.stderr.write(
  `competitive browser: ${matrix.length} cells (full=${full ? "yes" : "no"}, cases=${cases.length}, libs=${browserLibs.length})\n`,
);

async function waitForBenchApi(): Promise<void> {
  await page.waitForFunction(() => {
    const w = window as unknown as { competitiveBench?: BenchApi };
    return w.competitiveBench !== undefined;
  });
}

function isTimeout(err: unknown): boolean {
  return err instanceof Error && err.name === "TimeoutError";
}

/** Load the bench page and wait for the API, retrying once on goto timeout
 * (a cold vite dep-optimize can stall the first load past the page timeout). */
async function gotoBenchPage(p: Page): Promise<void> {
  try {
    await p.goto(benchUrl);
    await waitForBenchApi();
  } catch (err) {
    if (!isTimeout(err)) throw err;
    process.stderr.write("page load timed out; retrying once...\n");
    await p.goto(benchUrl);
    await waitForBenchApi();
  }
}

async function recoverPage(): Promise<void> {
  try {
    await page.reload();
    await waitForBenchApi();
  } catch {
    try {
      await page.close();
    } catch {
      // already closed
    }
    page = await browser.newPage();
    page.setDefaultTimeout(120_000);
    wirePageDiagnostics(page);
    await gotoBenchPage(page);
  }
}

await gotoBenchPage(page);

for (const cell of matrix) {
  // Load each GGPlot host only on its own page, keeping its registration
  // and framework state out of the lean core and other peer cells.
  const query =
    cell.lib.id === "ggsvelte-ggplot"
      ? "?ggplot=1"
      : cell.lib.id === "ggsvelte-react"
        ? "?ggreact=1"
        : "";
  benchUrl = `http://127.0.0.1:5199/${query}`;
  // A fresh page keeps each cell independent from framework state, detached
  // DOM, and garbage-collection pressure accumulated by earlier libraries.
  // The preview server and Chromium process stay warm; each cell still performs
  // its own two warmups before the recorded samples.
  await page.close();
  page = await browser.newPage();
  page.setDefaultTimeout(120_000);
  wirePageDiagnostics(page);
  await gotoBenchPage(page);

  const label = `${cell.lib.id} ${cell.caseId}`;
  process.stderr.write(`bench mount ${label}...\n`);
  try {
    const mountTiming = await medianTiming(() =>
      page.evaluate(
        async ({ library, caseId }) => {
          const w = window as unknown as { competitiveBench: BenchApi };
          return w.competitiveBench.mount(library, caseId);
        },
        { library: cell.lib.id, caseId: cell.caseId },
      ),
    );
    const mountStats = mountTiming.total;
    // replaceLib is a full remount alias of mountLib today — re-running the
    // median loop doubles wall time with no new information (#1357). replace*
    // columns below mirror mount stats; update* is the real second axis.
    const updateTiming = await medianTiming(() =>
      page.evaluate(
        async ({ library, caseId }) => {
          const w = window as unknown as { competitiveBench: BenchApi };
          return w.competitiveBench.update(library, caseId);
        },
        { library: cell.lib.id, caseId: cell.caseId },
      ),
    );
    const updateStats = updateTiming.total;
    // Teardown the live update handle for this cell (also automatic on the
    // next cell's first update call — belt and braces, no leaks across cells).
    await page.evaluate(() => {
      const w = window as unknown as { competitiveBench: BenchApi };
      w.competitiveBench.endUpdate();
    });
    const updateVerification = await page.evaluate(
      ({ library, caseId }) => {
        const w = window as unknown as { competitiveBench: BenchApi };
        return w.competitiveBench.verifyUpdate(library, caseId);
      },
      { library: cell.lib.id, caseId: cell.caseId },
    );
    if (!updateVerification.equal) {
      throw new Error(`update verification failed: ${updateVerification.detail}`);
    }
    // #1471 parity gate: after timing, prove the live patcher's DOM output
    // equals a fresh full render for this case (runs only for ggsvelte-svg;
    // a failed gate fails the cell so regressions block the scoreboard).
    if (cell.lib.id === "ggsvelte-svg") {
      const parity = await page.evaluate((caseId) => {
        const w = window as unknown as { competitiveBench: BenchApi };
        return w.competitiveBench.parityLiveSvg(caseId);
      }, cell.caseId);
      if (!parity.equal) {
        throw new Error(`live-SVG parity failed for ${cell.caseId}: ${parity.detail}`);
      }
    }
    results.push({
      lib: cell.lib.id,
      caseId: cell.caseId,
      scenario: cell.scenario,
      n: cell.n,
      ok: true,
      mountMedianMs: mountStats.median,
      mountMeanMs: mountStats.mean,
      mountP95Ms: mountStats.p95,
      mountSyncMedianMs: mountTiming.sync.median,
      mountSyncMeanMs: mountTiming.sync.mean,
      mountSyncP95Ms: mountTiming.sync.p95,
      replaceMedianMs: mountStats.median,
      replaceMeanMs: mountStats.mean,
      replaceP95Ms: mountStats.p95,
      replaceSyncMedianMs: mountTiming.sync.median,
      replaceSyncMeanMs: mountTiming.sync.mean,
      replaceSyncP95Ms: mountTiming.sync.p95,
      updateMedianMs: updateStats.median,
      updateMeanMs: updateStats.mean,
      updateP95Ms: updateStats.p95,
      updateSyncMedianMs: updateTiming.sync.median,
      updateSyncMeanMs: updateTiming.sync.mean,
      updateSyncP95Ms: updateTiming.sync.p95,
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
    // Recover page if a lib crashed the tab; rebind `page` so later cells run.
    await recoverPage();
  }
}

console.log("\n=== Competitive browser total / sync timing (Chromium, median) ===\n");
console.log(
  "lib".padEnd(18),
  "case".padEnd(22),
  "mount total".padStart(12),
  "mount sync".padStart(12),
  "update total".padStart(12),
  "update sync".padStart(12),
);
console.log("-".repeat(92));
for (const r of results) {
  if (!r["ok"]) {
    console.log(String(r["lib"]).padEnd(18), String(r["caseId"]).padEnd(22), "FAIL");
    continue;
  }
  console.log(
    String(r["lib"]).padEnd(18),
    String(r["caseId"]).padEnd(22),
    `${r["mountMedianMs"]}ms`.padStart(12),
    `${r["mountSyncMedianMs"]}ms`.padStart(12),
    `${r["updateMedianMs"]}ms`.padStart(12),
    `${r["updateSyncMedianMs"]}ms`.padStart(12),
  );
}

const payload = {
  generatedAt: new Date().toISOString(),
  provenance,
  full,
  measuresUpdate: true,
  measuresSync: true,
  caseCatalog: CASES,
  libs: LIBS,
  results,
};
writeFileSync(path.join(resultsDir, "browser.json"), JSON.stringify(payload, null, 2));
console.log("\nWrote results/browser.json");

await browser.close();
await new Promise<void>((resolve, reject) =>
  server.httpServer.close((error) => (error ? reject(error) : resolve())),
);
