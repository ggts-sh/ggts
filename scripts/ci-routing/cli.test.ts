import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..", "..");

async function spawnCiRoutingCli(
  args: string[],
  env?: Record<string, string>,
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  const proc = Bun.spawn(["bun", "scripts/ci-routing.ts", ...args], {
    cwd: REPO_ROOT,
    // Omit the key entirely when there is no override — `env: undefined` means
    // "an env I am declining to describe" to SpawnOptions under
    // exactOptionalPropertyTypes, not "inherit the parent's".
    ...(env === undefined ? {} : { env: { ...process.env, ...env } }),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

const spawnCiGate = (env: Record<string, string>) => spawnCiRoutingCli(["ci-gate"], env);

/**
 * Spawn the routing CLI in a throwaway cwd so marker writes land there rather
 * than in the repo tree.
 */
async function spawnCiRoutingCliIn(
  cwd: string,
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", join(REPO_ROOT, "scripts", "ci-routing.ts"), ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

describe("success-marker CLI carries shard identity", () => {
  test("a shard validates only its own marker", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ci-routing-shard-"));
    try {
      const write = await spawnCiRoutingCliIn(cwd, [
        "write-success-marker",
        "--execution",
        "component_svelte_fx",
        "--hash",
        "abc123",
        "--shard",
        "1/3",
      ]);
      expect(write.exitCode).toBe(0);
      expect(write.stdout.trim()).toBe(".ci-content-hash/component_svelte_fx-1of3.ok");

      const own = await spawnCiRoutingCliIn(cwd, [
        "validate-success-marker",
        "--execution",
        "component_svelte_fx",
        "--hash",
        "abc123",
        "--shard",
        "1/3",
      ]);
      expect(own.stdout).toContain("hit=true");

      // Shard 2 has written no marker of its own: it must miss, not inherit
      // shard 1's success.
      const other = await spawnCiRoutingCliIn(cwd, [
        "validate-success-marker",
        "--execution",
        "component_svelte_fx",
        "--hash",
        "abc123",
        "--shard",
        "2/3",
      ]);
      expect(other.stdout).toContain("hit=false");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("hash-inputs emits a shard-scoped cache key and marker path", async () => {
    const out = await spawnCiRoutingCli([
      "hash-inputs",
      "--execution",
      "component_svelte_fx",
      "--os",
      "Linux",
      "--shard",
      "2/3",
    ]);
    expect(out.exitCode).toBe(0);
    expect(out.stdout).toContain("shard2of3");
    expect(out.stdout).toContain("marker_path=.ci-content-hash/component_svelte_fx-2of3.ok");
  });

  test("a malformed --shard is rejected rather than silently unsharded", async () => {
    for (const bad of ["0/3", "4/3", "1", "x/3", "1/0"]) {
      const out = await spawnCiRoutingCli([
        "write-success-marker",
        "--execution",
        "component_svelte_fx",
        "--hash",
        "abc123",
        "--shard",
        bad,
      ]);
      expect(out.exitCode, bad).not.toBe(0);
    }
  });
});

/**
 * GITHUB_OUTPUT append is shared via cli-io.writeGithubOutput. Spawn tests that
 * only assert stdout cannot catch a dropped append — cover hash-inputs,
 * emit-github-output, and validate-success-marker here (detect-changes has its
 * own smoke in detect-changes.test.ts).
 */
describe("CLI GITHUB_OUTPUT writes", () => {
  test("hash-inputs appends the same body it prints to GITHUB_OUTPUT", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ci-routing-gh-out-"));
    const outPath = join(dir, "github_output");
    try {
      const out = await spawnCiRoutingCli(
        ["hash-inputs", "--execution", "component_svelte_fx", "--os", "Linux", "--shard", "2/3"],
        { GITHUB_OUTPUT: outPath },
      );
      expect(out.exitCode).toBe(0);
      expect(readFileSync(outPath, "utf8")).toBe(out.stdout);
      expect(out.stdout).toContain("hash=");
      expect(out.stdout).toContain("cache_key=");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("emit-github-output appends the routing body to GITHUB_OUTPUT", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ci-routing-emit-out-"));
    const outPath = join(dir, "github_output");
    try {
      const proc = Bun.spawn(
        ["bun", "scripts/ci-routing.ts", "emit-github-output", "--force-all", "--stdin"],
        {
          cwd: REPO_ROOT,
          env: { ...process.env, GITHUB_OUTPUT: outPath },
          stdin: "pipe",
          stdout: "pipe",
          stderr: "pipe",
        },
      );
      await proc.stdin.write("packages/spec/src/index.ts\n");
      await proc.stdin.end();
      const [stdout, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
      expect(exitCode).toBe(0);
      expect(readFileSync(outPath, "utf8")).toBe(stdout);
      expect(stdout).toContain("unit=true");
      expect(stdout).toContain("bypass_content_cache=");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("validate-success-marker writes hit=… to GITHUB_OUTPUT", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ci-routing-validate-out-"));
    const outPath = join(dir, "github_output");
    try {
      // Miss path: no marker file under throwaway cwd → hit=false in both sinks.
      const proc = Bun.spawn(
        [
          "bun",
          join(REPO_ROOT, "scripts", "ci-routing.ts"),
          "validate-success-marker",
          "--execution",
          "unit",
          "--hash",
          "deadbeef",
        ],
        {
          cwd: dir,
          env: { ...process.env, GITHUB_OUTPUT: outPath },
          stdout: "pipe",
          stderr: "pipe",
        },
      );
      const [stdout, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
      expect(exitCode).toBe(0);
      expect(stdout).toBe("hit=false\n");
      expect(readFileSync(outPath, "utf8")).toBe("hit=false\n");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("CLI entrypoint", () => {
  test("help, plan, emit-github-output, and invalid command", async () => {
    const help = await spawnCiRoutingCli(["help"]);
    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("emit-github-output");

    const plan = await spawnCiRoutingCli(["plan", "--force-all"]);
    expect(plan.exitCode).toBe(0);
    const planJson = JSON.parse(plan.stdout) as Record<string, boolean>;
    expect(planJson["unit"]).toBe(true);
    expect(planJson["pages"]).toBe(true);

    const emit = Bun.spawn(["bun", "scripts/ci-routing.ts", "emit-github-output", "--stdin"], {
      cwd: REPO_ROOT,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    await emit.stdin.write("packages/spec/src/index.ts\n");
    await emit.stdin.end();
    const emitOut = await new Response(emit.stdout).text();
    const emitCode = await emit.exited;
    expect(emitCode).toBe(0);
    expect(emitOut).toContain("unit=true");
    expect(emitOut).toContain("bypass_content_cache=");

    const bad = await spawnCiRoutingCli(["not-a-command"]);
    expect(bad.exitCode).not.toBe(0);
  });

  test("ci-gate CLI reads env vars, aggregates component shards, and evaluates the PR guard rule", async () => {
    const ok = await spawnCiGate({
      EVENT_NAME: "pull_request",
      CHECKS_REQ: "true",
      CHECKS_RES: "success",
      COMPONENT_REQ: "true",
      COMPONENT_SVELTE_RES: "success",
      COMPONENT_SVELTE_FX_RES: "success",
      COMPONENT_SPIKES_RES: "success",
      VR_GUARD_RES: "success",
    });
    expect(ok.exitCode).toBe(0);
    expect(ok.stdout).toContain("ci-gate ok");

    // Only the middle shard (component-svelte-fx) fails — the other two
    // succeed. Confirms the CLI actually reads all three shard env vars
    // rather than silently dropping the third one added alongside it.
    const failed = await spawnCiGate({
      EVENT_NAME: "pull_request",
      CHECKS_REQ: "true",
      CHECKS_RES: "success",
      COMPONENT_REQ: "true",
      COMPONENT_SVELTE_RES: "success",
      COMPONENT_SVELTE_FX_RES: "failure",
      COMPONENT_SPIKES_RES: "success",
      VR_GUARD_RES: "skipped",
    });
    expect(failed.exitCode).not.toBe(0);
    expect(failed.stderr).toContain("ci-gate failed: component, vr-baseline-guard:skipped");

    const pushEvent = await spawnCiGate({
      EVENT_NAME: "push",
      CHECKS_REQ: "true",
      CHECKS_RES: "success",
      // VR_GUARD_RES intentionally omitted — must not be checked on push.
    });
    expect(pushEvent.exitCode).toBe(0);
    expect(pushEvent.stdout).toContain("ci-gate ok");
  });
});
