import { readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import {
  ArtifactError,
  defineArtifact,
  defineArtifactGroup,
  type ArtifactGroup,
} from "../artifact.ts";
import {
  benchmarkChartDarkSiteSvg,
  benchmarkChartSvg,
} from "../../apps/docs/src/lib/benchmarks/charts.ts";
import { buildCards } from "./cards.ts";
import { projectionSource, readmeSource, type ShellFile } from "./projection.ts";
import {
  bundleGzipKb,
  readJson,
  readSnapshot,
  ROOT,
  validateSnapshot,
  type BrowserResults,
  type BundleResults,
  type PublishedSnapshot,
  type SsrResults,
} from "./results.ts";

function build(snapshot: PublishedSnapshot) {
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

/** Prepare every output before allowing the artifact group to mutate files. */
export async function benchmarkChartArtifacts(
  root = ROOT,
  publish = false,
): Promise<ArtifactGroup> {
  const committed = readSnapshot(root);
  const snapshot = publish
    ? validateSnapshot({
        ...committed,
        browser: readJson("browser.json", root) as BrowserResults,
        bundles: readJson("bundles.json", root) as BundleResults,
        ssr: readJson("ssr.json", root) as SsrResults,
      })
    : committed;
  const { files, cards, bundleKb, generatedAt } = build(snapshot);
  const output = join(root, "apps/docs/static/benchmarks");
  const readmePath = join(root, "README.md");
  const outputs: [string, string][] = files.map((file) => [join(output, file.filename), file.body]);
  outputs.push(
    [
      join(root, "apps/docs/src/lib/generated/benchmark-charts.ts"),
      await projectionSource(files, cards, generatedAt),
    ],
    [readmePath, await readmeSource(readFileSync(readmePath, "utf8"), cards, bundleKb, readmePath)],
  );
  if (publish) {
    const { renderer: _renderer, ...fullSnapshot } = snapshot;
    outputs.push([
      join(root, "benchmarks/competitive/published.json"),
      JSON.stringify(fullSnapshot, null, 2) + "\n",
    ]);
  }
  const expected = new Set(files.map((file) => file.filename));
  const orphans = () =>
    readdirSync(output).filter((name) => name.endsWith(".svg") && !expected.has(name));
  return defineArtifactGroup({
    regenerateWith: "benchmark:charts:gen",
    members: outputs.map(([path, body]) =>
      defineArtifact({ path, build: () => body, regenerateWith: "benchmark:charts:gen" }),
    ),
    extraCheck: () => {
      const orphan = orphans()[0];
      if (orphan !== undefined) {
        throw new ArtifactError({
          status: "STALE",
          path: join(output, orphan),
          label: orphan,
          regenerateWith: "benchmark:charts:gen",
        });
      }
    },
    extraWrite: () => {
      for (const orphan of orphans()) rmSync(join(output, orphan));
    },
  });
}
