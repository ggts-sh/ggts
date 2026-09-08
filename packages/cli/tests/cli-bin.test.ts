/**
 * ggts render bin smoke tests: spawn the workspace bin
 * (packages/cli/bin/ggts.js) directly — never network bunx.
 * Pure runCLI unit tests live in packages/core/tests/cli.test.ts.
 */
import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SPEC = {
  data: {
    values: [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ],
  },
  aes: { x: { field: "x" }, y: { field: "y" } },
  layers: [{ geom: "point" }],
};

describe("workspace bin smoke test", () => {
  it("reports the version of the CLI package that owns the bin", async () => {
    const packageDirectory = join(import.meta.dir, "..");
    const manifest = JSON.parse(readFileSync(join(packageDirectory, "package.json"), "utf8")) as {
      version: string;
    };
    const proc = Bun.spawn(["bun", join(packageDirectory, "bin", "ggts.js"), "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toBe(`${manifest.version}\n`);
    // Bun may emit a host CPU capability warning on stderr before the script runs.
    const cliStderr = stderr
      .split(/\r?\n/)
      .filter(
        (line) =>
          !line.startsWith("warn: CPU lacks AVX support") &&
          !line.includes("bun-darwin-x64-baseline.zip") &&
          line.trim() !== "",
      )
      .join("\n");
    expect(cliStderr).toBe("");
  });

  it("bun packages/cli/bin/ggts.js render spec.json > out.svg", async () => {
    const binPath = join(import.meta.dir, "..", "bin", "ggts.js");
    const dir = mkdtempSync(join(tmpdir(), "ggsvelte-cli-"));
    const specPath = join(dir, "spec.json");
    writeFileSync(specPath, JSON.stringify(SPEC));
    const proc = Bun.spawn(["bun", binPath, "render", specPath, "--width", "320"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
    expect(exitCode).toBe(0);
    expect(stdout).toStartWith("<svg ");
    expect(stdout.trimEnd()).toEndWith("</svg>");
    expect(stdout).toContain('width="320"');
  }, 20_000);
});
