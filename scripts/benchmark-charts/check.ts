/** Reproduce committed chart artifacts from the published measurement snapshot. */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { projectionSource, readmeSource } from "./projection";
import { OUTPUT_DIR, PROJECTION, ROOT } from "./results";
import { build } from "./write";

export async function check(): Promise<void> {
  if (!existsSync(OUTPUT_DIR) || !existsSync(PROJECTION)) {
    throw new Error("benchmark charts are MISSING. Run: bun scripts/gen-benchmark-charts.ts");
  }

  const { files, cards, versions, bundleKb, generatedAt, snapshot } = build();
  const wantNames = new Set(files.map((f) => f.filename));
  const haveNames = new Set(readdirSync(OUTPUT_DIR).filter((n) => n.endsWith(".svg")));
  for (const name of wantNames) {
    if (!haveNames.has(name)) {
      throw new Error(
        `benchmark charts STALE (missing ${name}). Run: bun scripts/gen-benchmark-charts.ts`,
      );
    }
    const onDisk = readFileSync(join(OUTPUT_DIR, name), "utf8");
    const want = files.find((f) => f.filename === name)!.body;
    if (onDisk !== want) {
      throw new Error(
        `benchmark charts STALE (${name} content). Run: bun scripts/gen-benchmark-charts.ts`,
      );
    }
  }
  for (const name of haveNames) {
    if (!wantNames.has(name)) {
      throw new Error(
        `benchmark charts STALE (orphan ${name}). Run: bun scripts/gen-benchmark-charts.ts`,
      );
    }
  }
  const wantProj = await projectionSource(files, cards, versions, bundleKb, generatedAt, snapshot);
  const haveProj = readFileSync(PROJECTION, "utf8");
  if (haveProj !== wantProj) {
    throw new Error("benchmark-charts projection STALE. Run: bun scripts/gen-benchmark-charts.ts");
  }
  const readmePath = join(ROOT, "README.md");
  const readme = readFileSync(readmePath, "utf8");
  if (readme !== (await readmeSource(readme, cards, bundleKb, readmePath))) {
    throw new Error(
      "README benchmark charts or bundle values are stale. Run: bun scripts/gen-benchmark-charts.ts",
    );
  }
  console.log("benchmark:charts artifacts are current.");
}
