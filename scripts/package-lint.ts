/**
 * publint + @arethetypeswrong/cli over the publishable workspace packages.
 *
 * Both tools validate BUILT output (dist/ + publish-shaped exports). Build
 * first: `bun run build`. Packages whose exports don't point at dist/ yet are
 * SKIPPED (reported, exit 0) so this script stays safe on fresh checkouts.
 *
 * attw runs with `--profile esm-only`: the workspace is ESM-only by plan
 * (no CJS artifacts, node10 resolution out of scope). The `@ggts-sh/svelte` package
 * is checked by publint ONLY: its d.ts files import `./*.svelte` modules,
 * which no node16 TS resolution mode can resolve — Svelte packages are
 * consumed through bundlers via the `svelte`/`import` conditions (svelte-kit
 * packaging convention), which attw cannot model. See decision 0007.
 *
 * Usage: bun scripts/package-lint.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

interface Target {
  dir: string;
  attw: boolean;
}

const targets: Target[] = [
  { dir: "packages/spec", attw: true },
  { dir: "packages/core", attw: true },
  { dir: "packages/compose", attw: true },
  { dir: "packages/svelte", attw: false }, // .svelte d.ts imports (see header)
  { dir: "packages/react", attw: true },
  { dir: "packages/cli", attw: true },
  // packages/skill is deliberately absent: markdown-only (no exports, no
  // dist), publint/attw have nothing to validate. Its pack shape is guarded
  // by scripts/skill-package.test.ts instead.
];

const root = process.cwd();
let failed = false;
let ran = 0;

for (const { dir, attw } of targets) {
  const dist = join(root, dir, "dist");
  const pkgJson: unknown = JSON.parse(readFileSync(join(root, dir, "package.json"), "utf8"));
  let manifest = "{}";
  if (pkgJson !== null && typeof pkgJson === "object" && "exports" in pkgJson) {
    manifest = JSON.stringify(pkgJson.exports ?? {});
  }
  if (!existsSync(dist) || !manifest.includes("dist/")) {
    console.log(`package-lint: SKIP ${dir} (no built dist/ — run \`bun run build\` first)`);
    continue;
  }
  ran += 1;
  const tools: [bin: string, args: string[]][] = [["publint", []]];
  if (attw) tools.push(["attw", ["--pack", "--profile", "esm-only"]]);
  for (const [bin, args] of tools) {
    const res = spawnSync(process.execPath, [join(root, "node_modules/.bin", bin), ...args], {
      cwd: join(root, dir),
      stdio: "inherit",
    });
    if (res.status !== 0) {
      console.error(`package-lint: ${bin} failed for ${dir}`);
      failed = true;
    }
  }
}

if (ran === 0) {
  console.log("package-lint: no built packages found; nothing to lint (exit 0).");
}
process.exit(failed ? 1 : 0);
