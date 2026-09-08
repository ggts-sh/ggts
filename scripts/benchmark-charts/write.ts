/**
 * Build + write path — renders the card SVGs and regenerates the projection.
 * `build()` is shared with the --check freshness path.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildCards } from "./cards";
import {
  benchmarkChartDarkSiteSvg,
  benchmarkChartSvg,
} from "../../apps/docs/src/lib/benchmarks/charts";

import {
  bundleGzipKb,
  readSnapshot,
  validateSnapshot,
  SNAPSHOT,
  OUTPUT_DIR,
  PROJECTION,
  ROOT,
  readJson,
  type BundleResults,
  type BrowserResults,
  type PublishedSnapshot,
  type SsrResults,
  type HistoricalBrowserResults,
} from "./results";
import { projectionSource, readmeSource, type ShellFile } from "./projection";

export function build(snapshot: PublishedSnapshot = readSnapshot()) {
  const { browser, bundles } = snapshot;
  const cards = buildCards(snapshot.renderer ?? browser);
  const files: ShellFile[] = cards.flatMap((card) => {
    const light = benchmarkChartSvg(card.chart, { width: card.width, height: card.height });
    return [
      { filename: `bench-${card.id}.svg`, body: light },
      { filename: `bench-${card.id}-dark-site.svg`, body: benchmarkChartDarkSiteSvg(light) },
    ];
  });
  const bundleKb = {
    coreKb: bundleGzipKb(bundles, "ggsvelte-svg", "scatter-color"),
    svelteKb: bundleGzipKb(bundles, "ggsvelte-ggplot", "scatter-color"),
    svelteplotKb: bundleGzipKb(bundles, "svelteplot", "scatter-color"),
    layercakeKb: bundleGzipKb(bundles, "layercake", "scatter-color"),
    unovisKb: bundleGzipKb(bundles, "unovis", "scatter-color"),
    tanstackKb: bundleGzipKb(bundles, "tanstack-svelte", "scatter-color"),
  };
  const renderer = snapshot.renderer ?? browser;
  const generatedAt = `${renderer.generatedAt}; commit ${renderer.provenance.commit}`;
  return { files, cards, bundleKb, generatedAt };
}

export async function write(publish = false): Promise<void> {
  const snapshot = publish
    ? validateSnapshot({
        browser: readJson("browser.json") as BrowserResults,
        renderer: readSnapshot().renderer,
        bundles: readJson("bundles.json") as BundleResults,
        ssr: readJson("ssr.json") as SsrResults,
        highN: existsSync(SNAPSHOT)
          ? (JSON.parse(readFileSync(SNAPSHOT, "utf8")) as PublishedSnapshot).highN
          : (readJson("browser-100k-peers.json") as HistoricalBrowserResults),
      })
    : readSnapshot();
  const { files, cards, bundleKb, generatedAt } = build(snapshot);
  const readmePath = join(ROOT, "README.md");
  const readme = await readmeSource(readFileSync(readmePath, "utf8"), cards, bundleKb, readmePath);
  if (publish) {
    const { renderer: _renderer, ...fullSnapshot } = snapshot;
    writeFileSync(SNAPSHOT, JSON.stringify(fullSnapshot, null, 2) + "\n");
  }
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const file of files) {
    writeFileSync(join(OUTPUT_DIR, file.filename), file.body);
  }
  writeFileSync(PROJECTION, await projectionSource(files, cards, generatedAt));
  writeFileSync(readmePath, readme);
  console.log(`wrote ${String(files.length)} benchmark charts to ${OUTPUT_DIR}`);
}
