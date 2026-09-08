import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { cpus, platform, release, arch } from "node:os";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const require = createRequire(import.meta.url);

export function measurementProvenance(browser?: string) {
  const manifest = JSON.parse(readFileSync(resolve(import.meta.dir, "package.json"), "utf8")) as {
    dependencies: Record<string, string>;
  };
  const versions = Object.fromEntries(
    Object.keys(manifest.dependencies).map((name) => {
      const file = name.startsWith("@ggsvelte/")
        ? resolve(root, "packages", name.split("/")[1]!, "package.json")
        : require.resolve(`${name}/package.json`);
      const pkg = JSON.parse(readFileSync(file, "utf8")) as { version: string };
      return [name, pkg.version];
    }),
  );
  return {
    commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    dirty:
      execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim() !== "",
    lockfileSha256: createHash("sha256")
      .update(readFileSync(resolve(root, "bun.lock")))
      .digest("hex"),
    mode: "production" as const,
    runtime: `Bun ${Bun.version}`,
    browser: browser ?? null,
    machine: {
      platform: platform(),
      release: release(),
      arch: arch(),
      cpu: cpus()[0]?.model ?? "unknown",
    },
    versions,
  };
}
