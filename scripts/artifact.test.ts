/**
 * Shared generated-artifact protocol (#783).
 *
 * Behavior through the public defineArtifact / defineArtifactGroup surface —
 * not implementation details of individual generators.
 */
import { afterEach, describe, expect, mock, test } from "bun:test";
import { rejects } from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  type Artifact,
  ArtifactError,
  defineArtifact,
  defineArtifactGroup,
  formatGeneratedSource,
} from "./artifact.ts";

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "ggsvelte-artifact-"));
  temps.push(dir);
  return dir;
}

describe("defineArtifact check/write", () => {
  test("check passes when file bytes match build()", async () => {
    const dir = tempDir();
    const path = join(dir, "out.txt");
    writeFileSync(path, "fresh\n");
    const artifact = defineArtifact({
      path,
      build: () => "fresh\n",
      regenerateWith: "demo:gen",
    });
    await artifact.check();
  });

  test("check fails MISSING when the file is absent", async () => {
    const dir = tempDir();
    const path = join(dir, "missing.txt");
    const artifact = defineArtifact({
      path,
      build: () => "x\n",
      regenerateWith: "demo:gen",
      label: "missing.txt",
    });
    try {
      await artifact.check();
      expect.unreachable("expected ArtifactError");
    } catch (error) {
      expect(error).toBeInstanceOf(ArtifactError);
      const e = error as ArtifactError;
      expect(e.status).toBe("MISSING");
      expect(e.message).toContain("MISSING");
      expect(e.message).toContain("bun run demo:gen");
      expect(e.message).toContain("missing.txt");
    }
  });

  test("check fails STALE when content differs", async () => {
    const dir = tempDir();
    const path = join(dir, "stale.txt");
    writeFileSync(path, "old\n");
    const artifact = defineArtifact({
      path,
      build: () => "new\n",
      regenerateWith: "demo:gen",
      label: "stale.txt",
    });
    try {
      await artifact.check();
      expect.unreachable("expected ArtifactError");
    } catch (error) {
      expect(error).toBeInstanceOf(ArtifactError);
      const e = error as ArtifactError;
      expect(e.status).toBe("STALE");
      expect(e.message).toContain("STALE");
      expect(e.message).toContain("bun run demo:gen");
    }
  });

  test("write creates parent dirs and writes build() bytes", async () => {
    const dir = tempDir();
    const path = join(dir, "nested", "out.txt");
    const artifact = defineArtifact({
      path,
      build: () => "payload\n",
      regenerateWith: "demo:gen",
    });
    const result = await artifact.write();
    expect(result.wrote).toBe(true);
    expect(readFileSync(path, "utf8")).toBe("payload\n");
  });

  test("write is a no-op when already current", async () => {
    const dir = tempDir();
    const path = join(dir, "out.txt");
    writeFileSync(path, "same\n");
    const artifact = defineArtifact({
      path,
      build: () => "same\n",
      regenerateWith: "demo:gen",
    });
    const result = await artifact.write();
    expect(result.wrote).toBe(false);
    expect(readFileSync(path, "utf8")).toBe("same\n");
  });
});

function cachedGroup(members: readonly Artifact[]) {
  return defineArtifactGroup({ cacheCheck: true, regenerateWith: "group:gen", members });
}
describe("defineArtifact dependsOn", () => {
  test("checks a shared artifact once per dependency walk and per group check", async () => {
    const path = join(tempDir(), "same.txt");
    writeFileSync(path, "current\n");
    let sharedChecks = 0;
    const shared = defineArtifact({
      path,
      cacheCheck: true,
      build: () => {
        sharedChecks++;
        return "current\n";
      },
      regenerateWith: "shared:gen",
    });
    const left = defineArtifact({
      path,
      cacheCheck: true,
      build: () => "current\n",
      regenerateWith: "left:gen",
      dependsOn: [shared],
    });
    const top = defineArtifact({
      path,
      cacheCheck: true,
      build: () => "current\n",
      regenerateWith: "top:gen",
      dependsOn: [left, shared],
    });
    await top.check();
    expect(sharedChecks).toBe(1);
    const group = cachedGroup([left, shared]);
    await group.check();
    expect(sharedChecks).toBe(2);
    await group.check();
    expect(sharedChecks).toBe(3);
  });
  test("checks shared artifacts again after an external check changes the files", async () => {
    const path = join(tempDir(), "shared.txt");
    writeFileSync(path, "current\n");
    const shared = defineArtifact({
      path,
      cacheCheck: true,
      build: () => "current\n",
      regenerateWith: "shared:gen",
    });
    const external = {
      ...shared,
      check() {
        expect(this).toBe(external);
        writeFileSync(path, "stale\n");
        return Promise.resolve();
      },
    };
    const group = cachedGroup([shared, external, shared]);
    await rejects(group.check(), /shared\.txt is STALE/);
  });

  test.each([false, true])("runs getters returning a factory method", async (sameArtifact) => {
    const path = join(tempDir(), "shared.txt");
    writeFileSync(path, "current\n");
    const shared = defineArtifact({
      path,
      cacheCheck: true,
      build: () => {
        Object.defineProperty(member, "check", {
          configurable: true,
          get() {
            writeFileSync(path, "stale\n");
            return check;
          },
        });
        return "current\n";
      },
      regenerateWith: "shared:gen",
    });
    // oxlint-disable-next-line typescript/unbound-method -- the getter must return the original method.
    const check = shared.check;
    const member = sameArtifact ? shared : { ...shared };
    const group = cachedGroup([shared, member]);
    await rejects(group.check(), /shared\.txt is STALE/);
  });

  test.each(["build", "dependsOn"])("refreshes checks around unmarked %s", async (phase) => {
    const dir = tempDir();
    const path = join(dir, "shared.txt");
    const otherPath = join(dir, "other.txt");
    writeFileSync(path, "current\n");
    writeFileSync(otherPath, "other\n");
    const shared = defineArtifact({
      path,
      build: () => "current\n",
      regenerateWith: "shared:gen",
      cacheCheck: true,
    });
    const mutator = defineArtifact({
      path: otherPath,
      build: () => {
        if (phase === "build") writeFileSync(path, "stale\n");
        return "other\n";
      },
      get dependsOn() {
        if (phase === "build") return [];
        writeFileSync(path, "stale\n");
        return [shared];
      },
      regenerateWith: "other:gen",
    });
    const group = cachedGroup([shared, mutator, shared]);
    const error =
      phase === "build" ? /shared\.txt is STALE/ : /bun run shared:gen && bun run other:gen/;
    await rejects(group.check(), error);
  });

  test("rechecks a parent with an unmarked dependency", async () => {
    const path = join(tempDir(), "same.txt");
    writeFileSync(path, "current\n");
    let dependencyChecks = 0;
    const dependency = defineArtifact({
      path,
      build: () => {
        dependencyChecks++;
        return "current\n";
      },
      regenerateWith: "dependency:gen",
    });
    const parent = defineArtifact({
      path,
      build: () => "current\n",
      regenerateWith: "parent:gen",
      dependsOn: [dependency],
      cacheCheck: true,
    });
    await cachedGroup([parent, parent]).check();
    expect(dependencyChecks).toBe(2);
  });

  test("check attributes a stale dependency instead of blaming the child", async () => {
    const dir = tempDir();
    const depPath = join(dir, "dep.txt");
    const childPath = join(dir, "child.txt");
    writeFileSync(depPath, "old-dep\n");
    writeFileSync(childPath, "child-current\n");
    const dep = defineArtifact({
      path: depPath,
      build: () => "new-dep\n",
      regenerateWith: "dep:gen",
      label: "dep.txt",
    });
    const child = defineArtifact({
      path: childPath,
      build: () => "child-current\n",
      regenerateWith: "child:gen",
      label: "child.txt",
      dependsOn: [dep],
    });
    try {
      await child.check();
      expect.unreachable("expected ArtifactError");
    } catch (error) {
      expect(error).toBeInstanceOf(ArtifactError);
      const e = error as ArtifactError;
      expect(e.status).toBe("STALE");
      expect(e.because?.status).toBe("STALE");
      expect(e.because?.regenerateWith).toBe("dep:gen");
      expect(e.message).toContain("dep.txt");
      expect(e.message).toContain("bun run dep:gen");
      // Do not only blame the child when the dep is the cause.
      expect(e.message).toMatch(/because/i);
    }
  });

  test("multi-hop dependsOn keeps intermediate gens in the fix chain", async () => {
    const dir = tempDir();
    const rootPath = join(dir, "root.txt");
    const midPath = join(dir, "mid.txt");
    const leafPath = join(dir, "leaf.txt");
    writeFileSync(rootPath, "old-root\n");
    writeFileSync(midPath, "mid-ok\n");
    writeFileSync(leafPath, "leaf-ok\n");
    const root = defineArtifact({
      path: rootPath,
      build: () => "new-root\n",
      regenerateWith: "root:gen",
      label: "root.txt",
    });
    const mid = defineArtifact({
      path: midPath,
      build: () => "mid-ok\n",
      regenerateWith: "mid:gen",
      label: "mid.txt",
      dependsOn: [root],
    });
    const leaf = defineArtifact({
      path: leafPath,
      build: () => "leaf-ok\n",
      regenerateWith: "leaf:gen",
      label: "leaf.txt",
      dependsOn: [mid],
    });
    try {
      await leaf.check();
      expect.unreachable("expected ArtifactError");
    } catch (error) {
      expect(error).toBeInstanceOf(ArtifactError);
      const e = error as ArtifactError;
      expect(e.because?.regenerateWith).toBe("mid:gen");
      expect(e.because?.because?.regenerateWith).toBe("root:gen");
      // Full order: root first, then mid, then leaf — not root then leaf alone.
      expect(e.message).toContain("bun run root:gen && bun run mid:gen && bun run leaf:gen");
      expect(e.message).toContain("root.txt");
    }
  });

  test("write fails loudly when a dependency is stale (no in-process cascade)", async () => {
    const dir = tempDir();
    const depPath = join(dir, "dep.txt");
    const childPath = join(dir, "child.txt");
    writeFileSync(depPath, "old-dep\n");
    writeFileSync(childPath, "old-child\n");
    let childBuildCalls = 0;
    const dep = defineArtifact({
      path: depPath,
      build: () => "new-dep\n",
      regenerateWith: "dep:gen",
      label: "dep.txt",
    });
    const child = defineArtifact({
      path: childPath,
      build: () => {
        childBuildCalls += 1;
        return "new-child\n";
      },
      regenerateWith: "child:gen",
      label: "child.txt",
      dependsOn: [dep],
    });
    try {
      await child.write();
      expect.unreachable("expected ArtifactError");
    } catch (error) {
      expect(error).toBeInstanceOf(ArtifactError);
      const e = error as ArtifactError;
      expect(e.because?.regenerateWith).toBe("dep:gen");
      expect(e.message).toContain("bun run dep:gen");
    }
    // Static-import safety: do not write the child from a stale dep graph.
    expect(childBuildCalls).toBe(0);
    expect(readFileSync(depPath, "utf8")).toBe("old-dep\n");
    expect(readFileSync(childPath, "utf8")).toBe("old-child\n");
  });

  test("write succeeds when dependencies are already current", async () => {
    const dir = tempDir();
    const depPath = join(dir, "dep.txt");
    const childPath = join(dir, "child.txt");
    writeFileSync(depPath, "dep\n");
    const dep = defineArtifact({
      path: depPath,
      build: () => "dep\n",
      regenerateWith: "dep:gen",
    });
    const child = defineArtifact({
      path: childPath,
      build: () => "child\n",
      regenerateWith: "child:gen",
      dependsOn: [dep],
    });
    const result = await child.write();
    expect(result.wrote).toBe(true);
    expect(readFileSync(childPath, "utf8")).toBe("child\n");
  });
});

describe("defineArtifactGroup", () => {
  test("starts the extra check immediately for an empty default group", async () => {
    const extraCheck = mock(() => {
      /* Track invocation. */
    });
    const group = defineArtifactGroup({ regenerateWith: "group:gen", members: [], extraCheck });
    const check = group.check();
    expect(extraCheck).toHaveBeenCalledTimes(1);
    await check;
  });

  test("check fails on the first stale member with that member's message", async () => {
    const dir = tempDir();
    const aPath = join(dir, "a.txt");
    const bPath = join(dir, "b.txt");
    writeFileSync(aPath, "a\n");
    writeFileSync(bPath, "old-b\n");
    const group = defineArtifactGroup({
      regenerateWith: "group:gen",
      members: [
        defineArtifact({
          path: aPath,
          build: () => "a\n",
          regenerateWith: "group:gen",
          label: "a.txt",
        }),
        defineArtifact({
          path: bPath,
          build: () => "b\n",
          regenerateWith: "group:gen",
          label: "b.txt",
        }),
      ],
    });
    try {
      await group.check();
      expect.unreachable("expected ArtifactError");
    } catch (error) {
      expect(error).toBeInstanceOf(ArtifactError);
      expect((error as ArtifactError).message).toContain("b.txt");
    }
  });

  test("write runs extraWrite after members and check runs extraCheck after members", async () => {
    const dir = tempDir();
    const path = join(dir, "m.txt");
    const side = join(dir, "side.txt");
    let extraCheckRan = false;
    const group = defineArtifactGroup({
      regenerateWith: "group:gen",
      members: [defineArtifact({ path, build: () => "m\n", regenerateWith: "group:gen" })],
      extraWrite: () => {
        writeFileSync(side, "side\n");
      },
      extraCheck: () => {
        extraCheckRan = true;
        if (!existsSync(side)) throw new Error("side missing");
      },
    });
    await group.write();
    expect(readFileSync(path, "utf8")).toBe("m\n");
    expect(readFileSync(side, "utf8")).toBe("side\n");
    await group.check();
    expect(extraCheckRan).toBe(true);
  });
});

describe("formatGeneratedSource", () => {
  test("formats a trivial TS module without errors", async () => {
    const dir = tempDir();
    const path = join(dir, "proj.ts");
    const formatted = await formatGeneratedSource(path, "export const x=1\n");
    expect(formatted).toContain("export const x");
    expect(typeof formatted).toBe("string");
    expect(formatted.length).toBeGreaterThan(0);
  });
});

describe("docs generator freshness gates stay individually invokable", () => {
  test("apps/docs build and check still invoke each generator --check (CI hash inputs)", () => {
    // Do not collapse these into one umbrella script: ci-routing expands
    // docsPackageInvokedScripts for content-hash invalidation.
    const manifest = JSON.parse(
      readFileSync(join(import.meta.dir, "..", "apps", "docs", "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    const required = [
      "gen-docs-routes.ts --check",
      "gen-docs-search.ts --check",
      "gen-gallery-previews.ts --check",
      "gen-og-home.ts --check",
    ];
    for (const script of [manifest.scripts["build"], manifest.scripts["check"]]) {
      for (const needle of required) {
        expect(script, script).toContain(needle);
      }
    }
  });

  test("root check chains lifecycle:check (script gate, not only unit assertion)", () => {
    const pkg = JSON.parse(readFileSync(join(import.meta.dir, "..", "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["check"]).toContain("lifecycle:check");
    expect(pkg.scripts["lifecycle:check"]).toContain("gen-lifecycle.ts --check");
  });
});
