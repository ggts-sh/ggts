import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "bun:test";

const guard = resolve(import.meta.dir, "guards/block-output-paths.sh");
const sandboxes: string[] = [];
const systemPath = "/usr/bin:/bin";

const baseline = "tests/visual/__screenshots__/plot.png";
const coverageArtifact = "packages/svelte/coverage/browser/index.html";

afterEach(() => {
  for (const sandbox of sandboxes.splice(0)) rmSync(sandbox, { recursive: true, force: true });
});

function runGuard(
  branch: string,
  staged: string,
  hookArg: string | string[] = baseline,
  failedMatcher: "none" | "batch" | "all" = "none",
): SpawnSyncReturns<string> & { grepCalls: number } {
  const sandbox = mkdtempSync(resolve(tmpdir(), "ggsvelte-output-guard-"));
  const bin = resolve(sandbox, "bin");
  sandboxes.push(sandbox);
  mkdirSync(bin);
  const fakeGit = resolve(bin, "git");
  writeFileSync(
    fakeGit,
    `#!/bin/sh
case "$1" in
  symbolic-ref) printf '%s\\n' "$FAKE_BRANCH" ;;
  diff) printf '%s\\n' "$FAKE_STAGED" ;;
  *) exit 2 ;;
esac
`,
  );
  chmodSync(fakeGit, 0o755);
  const systemGrep = Bun.which("grep", { PATH: systemPath });
  if (systemGrep === null) throw new Error(`grep not found on ${systemPath}`);
  const grep = resolve(bin, "grep");
  writeFileSync(
    grep,
    `#!/bin/sh
printf . >> .grep-calls
case "$GGTS_TEST_FAILED_MATCHER:$1" in all:* | batch:-aFxf) exit 2 ;; esac
exec "$GGTS_TEST_GREP" "$@"
`,
  );
  chmodSync(grep, 0o755);

  const args = Array.isArray(hookArg) ? hookArg : [hookArg];
  // Minimal env only: spreading process.env on CI leaves GITHUB_* / locale /
  // BASH_ENV values that can change branch resolution or stderr decoding.
  // Empty-string overrides are also unreliable across Node/Bun spawn impls.
  const result = spawnSync("bash", [guard, ...args], {
    cwd: sandbox,
    encoding: "utf8",
    env: {
      PATH: `${bin}:${systemPath}`,
      GGTS_TEST_GREP: systemGrep,
      GGTS_TEST_FAILED_MATCHER: failedMatcher,
      FAKE_BRANCH: branch,
      FAKE_STAGED: staged,
      HOME: sandbox,
      TMPDIR: tmpdir(),
      LC_ALL: "C.UTF-8",
      LANG: "C.UTF-8",
    },
  });
  const calls = resolve(sandbox, ".grep-calls");
  return { ...result, grepCalls: existsSync(calls) ? readFileSync(calls).length : 0 };
}

function combinedOutput(result: SpawnSyncReturns<string>): string {
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

describe("block-output-paths guard", () => {
  it("allows clean tracked baselines during all-files CI", () => {
    expect(runGuard("main", "").status).toBe(0);
  });

  it("blocks a newly staged baseline on an ordinary branch", () => {
    const result = runGuard("feature/ordinary", baseline);
    expect(result.status).toBe(1);
    expect(combinedOutput(result)).toContain("plot.png");
  });

  it("allows the audited visual-update branch", () => {
    expect(runGuard("vr-update/pr-11", baseline).status).toBe(0);
  });

  it("blocks a newly staged coverage report on an ordinary branch", () => {
    const result = runGuard("feature/ordinary", coverageArtifact, coverageArtifact);
    expect(result.status).toBe(1);
    expect(combinedOutput(result)).toContain(coverageArtifact);
  });

  it("blocks coverage reports on audited visual-update branches", () => {
    const result = runGuard("vr-update/pr-11", coverageArtifact, coverageArtifact);
    expect(result.status).toBe(1);
    // vr-update/* only exempts screenshot baselines; coverage stays blocked.
    expect(combinedOutput(result)).toContain(coverageArtifact);
  });

  it("matches staged output paths once, preserving argument order and duplicates", () => {
    const report = "-reports/playwright-report/a b.txt";
    const staged = [report, baseline, coverageArtifact].join("\n");
    const result = runGuard("vr-update/pr-11", staged, [
      coverageArtifact,
      "not-staged",
      baseline,
      report,
      coverageArtifact,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr.split("\n").filter((line) => line.startsWith("  "))).toEqual([
      `  ${coverageArtifact}`,
      `  ${report}`,
      `  ${coverageArtifact}`,
    ]);
    expect(result.grepCalls).toBe(1);
  });

  it("checks each path if the batch matcher fails", () => {
    const result = runGuard(
      "feature/ordinary",
      coverageArtifact,
      ["other", coverageArtifact],
      "batch",
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(coverageArtifact);
    expect(result.grepCalls).toBe(3);
  });

  it("refuses the commit if neither matcher can verify the staged output paths", () => {
    const result = runGuard(
      "feature/ordinary",
      coverageArtifact,
      [coverageArtifact, "other"],
      "all",
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Could not verify staged output path: ${coverageArtifact}`);
    expect(result.grepCalls).toBe(2);
  });

  it("finds an early match even with a large staged set", () => {
    const staged = [
      coverageArtifact,
      ...Array.from({ length: 3_000 }, (_, index) => `files/staged-item-${String(index)}.txt`),
    ].join("\n");
    const result = runGuard("feature/ordinary", staged, coverageArtifact);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(coverageArtifact);
  });

  it("keeps multiline arguments in the same diagnostics as single-pattern checks", () => {
    const multiline = `unmatched\n${baseline}`;
    const result = runGuard("vr-update/pr-11", baseline, [multiline, "unmatched"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`  ${multiline}\n`);
  });

  it("allows same-PR smoke baselines when packages/examples/visual tests are staged", () => {
    const staged = `${baseline}\ntests/visual/smoke-matrix.ts\n`;
    expect(runGuard("ci/vr-smoke-throughput", staged).status).toBe(0);
    expect(
      runGuard("feature/ordinary", `${baseline}\npackages/svelte/src/lib/Plot.svelte\n`).status,
    ).toBe(0);
  });

  it("still blocks baselines justified only by docs content-only paths", () => {
    const staged = `${baseline}\napps/docs/src/lib/catalog/guide.ts\n`;
    const result = runGuard("feature/ordinary", staged);
    expect(result.status).toBe(1);
    expect(combinedOutput(result)).toContain("plot.png");
  });
});
