/**
 * Server-side render throughput: data -> SVG string with NO browser.
 *
 * ggsvelte renders through its documented agent path — gg() spec ->
 * renderToSVGString (Node-safe, no DOM, no Svelte runtime). Svelte peers
 * render through the Svelte 5 server renderer (svelte/server render()) over
 * the SAME chart components the browser harness mounts (LayerCake via its
 * documented `ssr` prop + explicit width/height, components/layercake-ssr).
 * That is each library's real server story, e.g. a SvelteKit route SSR-ing a
 * chart vs an agent rendering a spec in a sandbox.
 *
 * Entries under entries/ssr__{lib}__{scenario}.ts are built once with Vite
 * (SSR/server compile, esbuild minify), imported, then timed in-process:
 * warmup 3, samples 15, median ms/render -> renders/sec.
 *
 * Every cell asserts a minimum mark count so an empty server render (e.g. a
 * component that only paints on mount) FAILS LOUDLY instead of "winning".
 *
 *   bun run measure-ssr.ts
 *   COMPETITIVE_LIBS=ggsvelte,layercake bun run measure-ssr.ts
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { svelte } from "@sveltejs/vite-plugin-svelte";
import { build } from "vite";
import { measurementProvenance } from "./provenance";

const root = import.meta.dirname;
const outRoot = path.join(root, "results", "ssr");
if (existsSync(outRoot)) rmSync(outRoot, { recursive: true });
mkdirSync(outRoot, { recursive: true });

type SsrLibId =
  | "ggsvelte"
  | "ggsvelte-react"
  | "ggsvelte-ggplot"
  | "svelteplot"
  | "layercake"
  | "unovis"
  | "tanstack-svelte";
type SsrScenario = "scatter-color" | "line-multiseries";

const LIBS: {
  id: SsrLibId;
  label: string;
  note: string;
  /** SveltePlot / Unovis paint marks from client-side lifecycle ($effect /
   * onMount), so the server render is documentedly an empty shell: record
   * ssrCapable:false instead of failing. Any OTHER lib rendering an empty
   * shell still fails loudly — an unexpected regression must not become a
   * silent "win". */
  expectEmptyShell?: boolean;
}[] = [
  {
    id: "ggsvelte",
    label: "ggts (headless)",
    note: "gg() -> renderToSVGString (@ggts-sh/core/render lean entry; no DOM, no Svelte runtime)",
  },
  {
    id: "ggsvelte-react",
    label: "ggts React (SSR)",
    note: "react-dom/server renderToString() of shipped GGPlot with spec prop and SVG marks",
  },
  {
    id: "ggsvelte-ggplot",
    label: "ggts Svelte (SSR)",
    note: "svelte/server render() of shipped GGPlot with spec prop and SVG marks",
  },
  {
    id: "svelteplot",
    label: "SveltePlot (SSR)",
    note: "svelte/server render() of components/svelteplot fixtures (browser-harness components)",
    expectEmptyShell: true,
  },
  {
    id: "layercake",
    label: "LayerCake (SSR)",
    note: "svelte/server render() of components/layercake-ssr (browser fixtures + documented ssr prop)",
  },
  {
    id: "unovis",
    label: "Unovis (SSR)",
    note: "svelte/server render() of components/unovis fixtures; marks paint in onMount (client-only)",
    expectEmptyShell: true,
  },
  {
    id: "tanstack-svelte",
    label: "TanStack Charts (Svelte SSR)",
    note: "svelte/server render() of components/tanstack-svelte fixtures (documented complete SVG SSR)",
  },
];

const CASES: {
  id: string;
  scenario: SsrScenario;
  label: string;
  /** Fail the cell if the rendered markup contains fewer marks — empty SSR
   * shells must not produce a meaningless throughput "win". */
  minMarks: number;
}[] = [
  {
    id: "scatter-color-1k",
    scenario: "scatter-color",
    label: "1,000-point colored scatter",
    minMarks: 900,
  },
  {
    id: "line-3x1k",
    scenario: "line-multiseries",
    label: "3-series × 1,000-point line",
    minMarks: 3,
  },
];

const onlyLibs = process.env["COMPETITIVE_LIBS"]
  ?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const libs = LIBS.filter((l) => !onlyLibs || onlyLibs.includes(l.id));

type SsrResult = {
  id: string;
  lib: string;
  label: string;
  caseId: string;
  ok: boolean;
  note?: string;
  /** False when the lib's server render is a documented empty shell (no
   * marks server-side). Throughput fields are then null, never 0 — an absent
   * capability is not a slow bar. */
  ssrCapable?: boolean;
  medianMs?: number | null;
  rendersPerSec?: number | null;
  bytes?: number;
  marks?: number;
  head?: string;
  samples?: number[];
  error?: string;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

process.env.NODE_ENV = "production";
const provenance = measurementProvenance();
const results: SsrResult[] = [];

for (const c of CASES) {
  for (const lib of libs) {
    const id = `ssr__${lib.id}__${c.scenario}`;
    const entry = path.join(root, "entries", `${id}.ts`);
    const outDir = path.join(outRoot, `${lib.id}__${c.id}`);
    process.stderr.write(`building ${id}...\n`);
    try {
      await build({
        configFile: false,
        logLevel: "error",
        plugins:
          lib.id === "ggsvelte" || lib.id === "ggsvelte-react"
            ? []
            : [svelte({ compilerOptions: { css: "external" }, emitCss: false })],
        build: {
          ssr: entry,
          outDir,
          emptyOutDir: true,
          minify: "esbuild",
          target: "es2022",
          rollupOptions: {
            external: [],
            output: { format: "es", entryFileNames: "bundle.mjs" },
          },
          write: true,
        },
        resolve: {
          conditions: ["svelte", "node", "import", "module", "default"],
        },
      });

      const bundlePath = path.join(outDir, "bundle.mjs");
      const mod = (await import(`${pathToFileURL(bundlePath).href}?t=${Date.now()}`)) as {
        renderOnce: () => { bytes: number; marks: number; head: string };
      };

      for (let i = 0; i < 3; i++) mod.renderOnce(); // warmup
      const samples: number[] = [];
      let bytes = 0;
      let marks = 0;
      let head = "";
      for (let i = 0; i < 15; i++) {
        const t0 = performance.now();
        const out = mod.renderOnce();
        samples.push(+(performance.now() - t0).toFixed(3));
        bytes = out.bytes;
        marks = out.marks;
        head = out.head;
      }
      if (marks < c.minMarks) {
        if (lib.expectEmptyShell === true) {
          results.push({
            id,
            lib: lib.id,
            label: lib.label,
            caseId: c.id,
            ok: true,
            note: lib.note,
            ssrCapable: false,
            medianMs: null,
            rendersPerSec: null,
            bytes,
            marks,
            head,
          });
          continue;
        }
        results.push({
          id,
          lib: lib.id,
          label: lib.label,
          caseId: c.id,
          ok: false,
          note: lib.note,
          head,
          error: `only ${marks} marks rendered (expected >= ${c.minMarks}) — server render produced an empty shell; refusing to report a meaningless throughput number`,
        });
        continue;
      }
      const medianMs = +median(samples).toFixed(3);
      results.push({
        id,
        lib: lib.id,
        label: lib.label,
        caseId: c.id,
        ok: true,
        note: lib.note,
        ssrCapable: true,
        medianMs,
        rendersPerSec: Math.round(1000 / medianMs),
        bytes,
        marks,
        head,
        samples,
      });
    } catch (err) {
      results.push({
        id,
        lib: lib.id,
        label: lib.label,
        caseId: c.id,
        ok: false,
        note: lib.note,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

console.log("\n=== Server-side SVG render throughput (median of 15, warmup 3) ===\n");
console.log(
  "case".padEnd(20),
  "lib".padEnd(12),
  "ms/render".padStart(10),
  "renders/s".padStart(10),
  "marks".padStart(7),
  "KB".padStart(8),
);
console.log("-".repeat(70));
for (const r of results) {
  if (!r.ok) {
    console.log(r.caseId.padEnd(20), r.lib.padEnd(12), "FAIL", "-", r.error);
    continue;
  }
  if (r.ssrCapable === false) {
    console.log(
      r.caseId.padEnd(20),
      r.lib.padEnd(12),
      "—".padStart(10),
      "no SSR".padStart(10),
      String(r.marks).padStart(7),
      (r.bytes! / 1024).toFixed(1).padStart(8),
    );
    continue;
  }
  console.log(
    r.caseId.padEnd(20),
    r.lib.padEnd(12),
    String(r.medianMs).padStart(10),
    String(r.rendersPerSec).padStart(10),
    String(r.marks).padStart(7),
    (r.bytes! / 1024).toFixed(1).padStart(8),
  );
}

const failed = results.filter((r) => !r.ok);
const payload = {
  generatedAt: new Date().toISOString(),
  provenance,
  method:
    "data -> SVG markup, no browser. Headless: gg() -> renderToSVGString. React: react-dom/server renderToString(GGPlot). Svelte GGPlot and Svelte peers: svelte/server render() of fixture components (LayerCake with its ssr prop). Warmup 3, samples 15, median.",
  cases: CASES.map(({ id, scenario, label }) => ({ id, scenario, label })),
  results,
};
writeFileSync(path.join(root, "results", "ssr.json"), JSON.stringify(payload, null, 2));
console.log("\nWrote results/ssr.json");

if (failed.length > 0) {
  console.error(`\nmeasure-ssr: ${failed.length} cell(s) FAILED`);
  process.exit(1);
}
