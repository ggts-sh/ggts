import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import {
  changelogSectionForVersion,
  filterUnpublished,
  formatUnpublishedFailure,
  npmVersionExists,
  npmVersionUrl,
  packageReleaseTag,
  parseNewTags,
  parsePackageReleaseTag,
  planGithubReleaseStaging,
  readPublishedPackageVersions,
  type PackageVersion,
} from "./npm-publish-state";
import { commitForPackageVersion } from "./stage-github-releases";

const root = join(import.meta.dir, "..");

describe("readPublishedPackageVersions", () => {
  it("returns the lockstep packages with name+version", () => {
    const pkgs = readPublishedPackageVersions(root);
    const names = pkgs.map((p) => p.name).toSorted();
    expect(names).toEqual([
      "@ggts-sh/cli",
      "@ggts-sh/compose",
      "@ggts-sh/core",
      "@ggts-sh/react",
      "@ggts-sh/skill",
      "@ggts-sh/spec",
      "@ggts-sh/svelte",
    ]);
    for (const pkg of pkgs) {
      expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
      expect(pkg.dir.startsWith("packages/")).toBe(true);
    }
  });
});

describe("npmVersionUrl", () => {
  it("encodes scoped package names for the registry path", () => {
    expect(npmVersionUrl("@ggts-sh/core", "0.24.1")).toBe(
      "https://registry.npmjs.org/@ggts-sh%2Fcore/0.24.1",
    );
  });

  it("leaves unscoped names alone", () => {
    expect(npmVersionUrl("left-pad", "1.0.0", "https://example.test/")).toBe(
      "https://example.test/left-pad/1.0.0",
    );
  });
});

describe("filterUnpublished", () => {
  const local: PackageVersion[] = [
    { dir: "packages/core", name: "@ggts-sh/core", version: "0.24.1" },
    { dir: "packages/spec", name: "@ggts-sh/spec", version: "0.24.1" },
  ];

  it("returns packages whose name@version is not in the published set", () => {
    const published = new Set(["@ggts-sh/core@0.24.1"]);
    expect(filterUnpublished(local, published)).toEqual([
      { dir: "packages/spec", name: "@ggts-sh/spec", version: "0.24.1" },
    ]);
  });

  it("returns empty when everything is published", () => {
    const published = new Set(["@ggts-sh/core@0.24.1", "@ggts-sh/spec@0.24.1"]);
    expect(filterUnpublished(local, published)).toEqual([]);
  });
});

describe("parseNewTags", () => {
  it("extracts scoped and unscoped tags from changeset publish output", () => {
    const stdout = `
🦋  info npm info @ggts-sh/core
New tag: @ggts-sh/core@0.24.1
New tag: @ggts-sh/spec@0.24.1
Creating git tags...
New tag:  left-pad@1.0.0
`;
    expect(parseNewTags(stdout)).toEqual([
      "@ggts-sh/core@0.24.1",
      "@ggts-sh/spec@0.24.1",
      "left-pad@1.0.0",
    ]);
  });

  it("returns empty when nothing was published", () => {
    expect(parseNewTags("No unpublished packages to publish\n")).toEqual([]);
  });
});

describe("changelogSectionForVersion", () => {
  const sample = `# @ggts-sh/core

## 0.24.1

### Patch Changes

- abc: fix the thing

## 0.24.0

### Patch Changes

- def: earlier
`;

  it("returns the body between this version header and the next", () => {
    expect(changelogSectionForVersion(sample, "0.24.1")).toBe(
      "### Patch Changes\n\n- abc: fix the thing",
    );
  });

  it("returns the last section when there is no following H2", () => {
    expect(changelogSectionForVersion(sample, "0.24.0")).toBe(
      "### Patch Changes\n\n- def: earlier",
    );
  });

  it("returns null when the version is absent", () => {
    expect(changelogSectionForVersion(sample, "9.9.9")).toBeNull();
  });

  it("does not treat ## 0.24.10 as ## 0.24.1 (prefix collision)", () => {
    const withTen = `# pkg

## 0.24.10

### Patch Changes

- ten

## 0.24.1

### Patch Changes

- one
`;
    expect(changelogSectionForVersion(withTen, "0.24.1")).toBe("### Patch Changes\n\n- one");
    expect(changelogSectionForVersion(withTen, "0.24.10")).toBe("### Patch Changes\n\n- ten");
  });
});

describe("formatUnpublishedFailure", () => {
  it("names every unpublished package and explains the race", () => {
    const msg = formatUnpublishedFailure([
      { dir: "packages/core", name: "@ggts-sh/core", version: "0.24.1" },
    ]);
    expect(msg).toContain("@ggts-sh/core@0.24.1");
    expect(msg).toContain("changesets/action");
    expect(msg).toContain("ERROR:");
  });
});

describe("packageReleaseTag", () => {
  it("joins scoped name and version the way changesets tags them", () => {
    expect(packageReleaseTag("@ggts-sh/core", "0.24.1")).toBe("@ggts-sh/core@0.24.1");
  });
});

describe("planGithubReleaseStaging", () => {
  const local: PackageVersion[] = [
    { dir: "packages/core", name: "@ggts-sh/core", version: "0.24.1" },
    { dir: "packages/spec", name: "@ggts-sh/spec", version: "0.24.1" },
  ];

  it("stages only packages already on npm and uses caller notes", () => {
    const onNpm = new Set(["@ggts-sh/core@0.24.1"]);
    const planned = planGithubReleaseStaging(local, onNpm, (pkg) => `notes for ${pkg.name}`);
    expect(planned).toEqual([{ tag: "@ggts-sh/core@0.24.1", notes: "notes for @ggts-sh/core" }]);
  });

  it("stages every local package when all are on npm (release recovery)", () => {
    const onNpm = new Set(["@ggts-sh/core@0.24.1", "@ggts-sh/spec@0.24.1"]);
    const planned = planGithubReleaseStaging(local, onNpm, () => "body");
    expect(planned.map((e) => e.tag)).toEqual(["@ggts-sh/core@0.24.1", "@ggts-sh/spec@0.24.1"]);
  });

  it("returns empty when nothing is on npm yet", () => {
    expect(planGithubReleaseStaging(local, new Set(), () => "x")).toEqual([]);
  });
});

describe("npmVersionExists", () => {
  it("returns true on 200", async () => {
    const fetchImpl = (() =>
      Promise.resolve(new Response("{}", { status: 200 }))) as unknown as typeof fetch;
    expect(await npmVersionExists("@ggts-sh/core", "0.24.0", { fetchImpl })).toBe(true);
  });

  it("returns false on 404", async () => {
    const fetchImpl = (() =>
      Promise.resolve(new Response("Not Found", { status: 404 }))) as unknown as typeof fetch;
    expect(await npmVersionExists("@ggts-sh/core", "9.9.9", { fetchImpl })).toBe(false);
  });

  it("throws on non-404 errors so the assert cannot green on outages", async () => {
    const fetchImpl = (() =>
      Promise.resolve(new Response("nope", { status: 500 }))) as unknown as typeof fetch;
    let threw: unknown;
    try {
      await npmVersionExists("@ggts-sh/core", "0.24.0", { fetchImpl });
    } catch (err) {
      threw = err;
    }
    expect(threw).toBeInstanceOf(Error);
    expect(String(threw)).toMatch(/npm registry 500/);
  });
});

describe("parsePackageReleaseTag", () => {
  it("parses scoped and unscoped tags", () => {
    expect(parsePackageReleaseTag("@ggts-sh/core@0.24.1")).toEqual({
      name: "@ggts-sh/core",
      version: "0.24.1",
    });
    expect(parsePackageReleaseTag("left-pad@1.0.0")).toEqual({
      name: "left-pad",
      version: "1.0.0",
    });
    expect(parsePackageReleaseTag("bad")).toBeNull();
  });
});

describe("npmVersionExists retries", () => {
  it("retries 404s then succeeds", async () => {
    let calls = 0;
    const fetchImpl = (() => {
      calls += 1;
      if (calls < 3) return Promise.resolve(new Response("no", { status: 404 }));
      return Promise.resolve(new Response("{}", { status: 200 }));
    }) as unknown as typeof fetch;
    const sleeps: number[] = [];
    const ok = await npmVersionExists("@ggts-sh/core", "0.24.1", {
      fetchImpl,
      retries: 4,
      retryDelayMs: 10,
      sleep: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
    });
    expect(ok).toBe(true);
    expect(calls).toBe(3);
    expect(sleeps.length).toBe(2);
  });
});

describe("commitForPackageVersion", () => {
  it("returns git-log result when present", () => {
    const sha = commitForPackageVersion(
      { dir: "packages/core", name: "@ggts-sh/core", version: "0.24.1" },
      "HEADSHA",
      () => "abc123",
    );
    expect(sha).toBe("abc123");
  });

  it("falls back to HEAD when git finds nothing", () => {
    const sha = commitForPackageVersion(
      { dir: "packages/core", name: "@ggts-sh/core", version: "0.24.1" },
      "HEADSHA",
      () => null,
    );
    expect(sha).toBe("HEADSHA");
  });
});
