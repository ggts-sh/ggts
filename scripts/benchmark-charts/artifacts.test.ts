import { afterEach, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ArtifactError } from "../artifact.ts";
import { benchmarkChartArtifacts } from "./artifacts.ts";
import { readSnapshot, ROOT } from "./results.ts";

const roots: string[] = [];
const README = `# Publication fixture\n\nKeep this paragraph.\n\n<!-- framework-benchmark-charts:start -->\nold charts\n<!-- framework-benchmark-charts:end -->\n\n| **Bundle size** (old) | 999 KB |\n`;

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "ggts-benchmark-artifacts-"));
  roots.push(root);
  const competitive = join(root, "benchmarks", "competitive");
  mkdirSync(competitive, { recursive: true });
  for (const name of ["published.json", "published-svg.json"]) {
    copyFileSync(join(ROOT, "benchmarks", "competitive", name), join(competitive, name));
  }
  writeFileSync(join(root, "README.md"), README);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test("reports a missing published SVG through the artifact error contract", async () => {
  const root = fixture();
  const artifacts = await benchmarkChartArtifacts(root);
  await artifacts.write();
  const path = join(root, "apps/docs/static/benchmarks/bench-core-scatter-10k-mount.svg");
  rmSync(path);

  const failure = await artifacts.check().catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(ArtifactError);
  expect(failure).toMatchObject({ status: "MISSING", artifactPath: path });
});

test("checks published bytes and preserves README content outside generated sections", async () => {
  const root = fixture();
  const artifacts = await benchmarkChartArtifacts(root);
  await artifacts.write();
  await (await benchmarkChartArtifacts(root)).check();
  expect(readFileSync(join(root, "README.md"), "utf8")).toContain("Keep this paragraph.");
  const projection = join(root, "apps/docs/src/lib/generated/benchmark-charts.ts");
  writeFileSync(projection, "stale projection");
  const failure = await artifacts.check().catch((error: unknown) => error);
  expect(failure).toMatchObject({
    status: "STALE",
    artifactPath: projection,
  });
});

test("rejects and removes orphan SVGs without deleting unrelated files", async () => {
  const root = fixture();
  const artifacts = await benchmarkChartArtifacts(root);
  await artifacts.write();
  const output = join(root, "apps/docs/static/benchmarks");
  const orphan = join(output, "retired.svg");
  const sentinel = join(output, "notes.txt");
  writeFileSync(orphan, "<svg />");
  writeFileSync(sentinel, "keep");
  const failure = await artifacts.check().catch((error: unknown) => error);
  expect(failure).toMatchObject({
    status: "STALE",
    artifactPath: orphan,
  });
  await artifacts.write();
  await artifacts.check();
  expect(readFileSync(sentinel, "utf8")).toBe("keep");
});

test("publishes new measurements while retaining historical and focused SVG provenance", async () => {
  const root = fixture();
  const snapshot = readSnapshot(root);
  const competitive = join(root, "benchmarks/competitive");
  const results = join(competitive, "results");
  mkdirSync(results);
  for (const [name, run] of Object.entries({
    browser: snapshot.browser,
    bundles: snapshot.bundles,
    ssr: snapshot.ssr,
  })) {
    writeFileSync(
      join(results, `${name}.json`),
      JSON.stringify({ ...run, provenance: { ...run.provenance, commit: "new-clean-run" } }),
    );
  }
  const renderer = readFileSync(join(competitive, "published-svg.json"), "utf8");
  await (await benchmarkChartArtifacts(root, true)).write();
  const published = readSnapshot(root);
  expect(published.browser.provenance.commit).toBe("new-clean-run");
  expect(published.bundles.provenance.commit).toBe("new-clean-run");
  expect(published.ssr.provenance.commit).toBe("new-clean-run");
  expect(published.highN).toEqual(snapshot.highN);
  expect(readFileSync(join(competitive, "published-svg.json"), "utf8")).toBe(renderer);
  expect(JSON.parse(readFileSync(join(competitive, "published.json"), "utf8"))).not.toHaveProperty(
    "renderer",
  );
  await (await benchmarkChartArtifacts(root)).check();
});

test("rejects invalid publication inputs before changing committed output", async () => {
  const root = fixture();
  await (await benchmarkChartArtifacts(root)).write();
  const snapshot = readSnapshot(root);
  const competitive = join(root, "benchmarks/competitive");
  const results = join(competitive, "results");
  mkdirSync(results);
  for (const [name, run] of Object.entries({
    browser: snapshot.browser,
    bundles: snapshot.bundles,
    ssr: snapshot.ssr,
  })) {
    writeFileSync(
      join(results, `${name}.json`),
      JSON.stringify({ ...run, provenance: { ...run.provenance, dirty: true } }),
    );
  }
  const snapshotPath = join(competitive, "published.json");
  const before = readFileSync(snapshotPath, "utf8");
  const failure = await benchmarkChartArtifacts(root, true).catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(Error);
  expect(readFileSync(snapshotPath, "utf8")).toBe(before);
  await (await benchmarkChartArtifacts(root)).check();
});
