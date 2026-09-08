import { CASES, LIBS, libSupports } from "../../benchmarks/competitive/scenarios";
/** Published benchmark snapshot plus machine-local inputs for --publish. */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const ROOT = resolve(import.meta.dir, "..", "..");
const COMPETITIVE = join(ROOT, "benchmarks", "competitive");
export const OUTPUT_DIR = join(ROOT, "apps", "docs", "static", "benchmarks");
export const PROJECTION = join(
  ROOT,
  "apps",
  "docs",
  "src",
  "lib",
  "generated",
  "benchmark-charts.ts",
);

interface MeasurementProvenance {
  readonly commit: string;
  readonly dirty: boolean;
  readonly mode: "production";
  readonly versions: Readonly<Record<string, string>>;
}

export interface BrowserResults {
  readonly libs: readonly { id: string; label: string; form: "svg" | "canvas"; note: string }[];
  readonly provenance: MeasurementProvenance;
  readonly generatedAt: string;
  readonly results: readonly {
    readonly lib: string;
    readonly caseId: string;
    readonly ok: boolean;
    readonly mountMedianMs?: number;
    readonly updateMedianMs?: number;
  }[];
}

export interface BundleResults {
  readonly generatedAt: string;
  readonly provenance: MeasurementProvenance;
  readonly results: readonly {
    readonly lib: string;
    readonly scenario: string;
    readonly ok: boolean;
    readonly gzipKB?: number;
  }[];
}

export function readJson(name: string): unknown {
  const path = join(COMPETITIVE, "results", name);
  if (!existsSync(path)) {
    throw new Error(
      `${name} is missing. Run the competitive benchmarks first:\n` +
        "  cd benchmarks/competitive && bun run measure:browser && bun run measure:bundles\n" +
        "  cd benchmarks/competitive && bun run measure-100k-peers.ts   # 100k form-factor cards",
    );
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

export interface SsrResults {
  readonly generatedAt: string;
  readonly provenance: MeasurementProvenance;
  readonly method: string;
  readonly results: readonly {
    readonly lib: string;
    readonly label: string;
    readonly caseId: string;
    readonly ok: boolean;
    readonly ssrCapable?: boolean;
    readonly medianMs?: number | null;
    readonly rendersPerSec?: number | null;
  }[];
}

export interface HistoricalBrowserResults {
  readonly generatedAt: string;
  readonly host: Readonly<Record<string, string>>;
  readonly protocol: Readonly<Record<string, string | number>>;
  readonly results: BrowserResults["results"];
}

export const SNAPSHOT = join(COMPETITIVE, "published.json");

export type PublishedSnapshot = {
  browser: BrowserResults;
  bundles: BundleResults;
  ssr: SsrResults;
  highN: HistoricalBrowserResults;
};

export function validateSnapshot(snapshot: PublishedSnapshot): PublishedSnapshot {
  for (const measurement of [snapshot.browser, snapshot.bundles, snapshot.ssr]) {
    if (
      measurement.provenance?.mode !== "production" ||
      !measurement.provenance.commit ||
      !measurement.generatedAt
    ) {
      throw new Error(
        "Published benchmarks require production measurements with commit, date and package versions.",
      );
    }
  }
  const runs = [snapshot.browser, snapshot.bundles, snapshot.ssr];
  if (
    runs.some((run) => run.provenance.dirty) ||
    new Set(runs.map((run) => run.provenance.commit)).size !== 1
  ) {
    throw new Error(
      "Publish browser, bundle and SSR measurements from the same clean source commit.",
    );
  }
  if (!snapshot.highN.generatedAt || !Array.isArray(snapshot.highN.results)) {
    throw new Error("Historical high-N results must retain their recorded date and rows.");
  }
  for (const lib of LIBS.filter((entry) => entry.browser)) {
    for (const scenario of CASES.filter(
      (entry) => entry.defaultBrowser && libSupports(lib, entry.scenario),
    )) {
      if (
        !snapshot.browser.results.some(
          (entry) => entry.lib === lib.id && entry.caseId === scenario.id,
        )
      ) {
        throw new Error(`Published benchmark matrix is incomplete: ${lib.id}/${scenario.id}`);
      }
    }
  }
  return snapshot;
}

export function readSnapshot(): PublishedSnapshot {
  return validateSnapshot(JSON.parse(readFileSync(SNAPSHOT, "utf8")) as PublishedSnapshot);
}

export function timingMs(
  browser: BrowserResults,
  lib: string,
  caseId: string,
  metric: "mount" | "update",
): number {
  const cell = browser.results.find((r) => r.lib === lib && r.caseId === caseId && r.ok);
  const value = metric === "mount" ? cell?.mountMedianMs : cell?.updateMedianMs;
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    throw new Error(
      `browser results missing valid ${lib}/${caseId}/${metric}. Re-run the competitive browser measure.`,
    );
  }
  return value;
}

export function bundleGzipKb(bundles: BundleResults, lib: string, scenario: string): number {
  const cell = bundles.results.find((r) => r.lib === lib && r.scenario === scenario && r.ok);
  if (cell?.gzipKB === undefined || !Number.isFinite(cell.gzipKB) || cell.gzipKB <= 0) {
    throw new Error(
      `bundle results missing ${lib}/${scenario}. Re-run: cd benchmarks/competitive && bun run measure:bundles`,
    );
  }
  return cell.gzipKB;
}
