import { describe, expect, it } from "bun:test";

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  COMMENT_MARKER,
  decideChangesetComment,
  discoverPublishedPackages,
  renderComment,
} from "./changeset-check";

const root = join(import.meta.dir, "..");

/** Fixture mirroring the real published workspace shape (see discovery test). */
const PACKAGES = [
  { dir: "packages/cli", name: "@ggsvelte/cli", shipped: ["dist", "bin", "src"] },
  { dir: "packages/compose", name: "@ggsvelte/compose", shipped: ["dist", "src"] },
  { dir: "packages/core", name: "@ggsvelte/core", shipped: ["dist", "src", "NOTICE"] },
  { dir: "packages/react", name: "@ggsvelte/react", shipped: ["dist"] },
  // @ggsvelte/skill ships root-level files, not only directories: SKILL.md is
  // a `files` entry that is not a path prefix (the isShippedPath file-entry
  // regression guard below keys off this). Sorted by dir: skill < spec.
  { dir: "packages/skill", name: "@ggsvelte/skill", shipped: ["SKILL.md", "references"] },
  { dir: "packages/spec", name: "@ggsvelte/spec", shipped: ["dist", "schema", "src"] },
  { dir: "packages/svelte", name: "@ggsvelte/svelte", shipped: ["dist", "bin"] },
];

describe("decideChangesetComment", () => {
  it("reports changeset-present when the PR adds a changeset and shipped code", () => {
    const decision = decideChangesetComment(
      [".changeset/my-change.md", "packages/core/src/scales.ts"],
      PACKAGES,
    );
    expect(decision.verdict).toBe("changeset-present");
  });

  it("reports unwarranted when a changeset lands without shipped package paths", () => {
    // Regression: #1116 quickstart-only + kyoto-annotation-polish changeset.
    const decision = decideChangesetComment(
      [
        ".changeset/kyoto-annotation-polish.md",
        "scripts/quickstart/steps.ts",
        "tests/visual/docs-progressive-search.spec.ts",
      ],
      PACKAGES,
    );
    expect(decision.verdict).toBe("unwarranted");
    expect(decision.touched).toEqual([]);
  });

  it("reports unwarranted for examples-only changesets (example trim)", () => {
    const decision = decideChangesetComment(
      [
        ".changeset/example-trim.md",
        "examples/point/scatter-color/Example.svelte",
        "examples/point/scatter-color/data.ts",
        "examples/manifest.ts",
      ],
      PACKAGES,
    );
    expect(decision.verdict).toBe("unwarranted");
  });

  it("reports missing when shipped package code changes without a changeset", () => {
    const decision = decideChangesetComment(
      ["packages/core/src/scales.ts", "packages/cli/bin/ggsvelte-render.js", "README.md"],
      PACKAGES,
    );
    expect(decision.verdict).toBe("missing");
    expect(decision.touched).toEqual([
      "packages/core/src/scales.ts",
      "packages/cli/bin/ggsvelte-render.js",
    ]);
  });

  it("treats a published package.json change as shipped surface", () => {
    const decision = decideChangesetComment(["packages/svelte/package.json"], PACKAGES);
    expect(decision.verdict).toBe("missing");
    expect(decision.touched).toEqual(["packages/svelte/package.json"]);
  });

  it("treats packaged agent skills as shipped (changeset ok)", () => {
    const decision = decideChangesetComment(
      [".changeset/skill-rewrite.md", "packages/skill/references/geoms-and-stats.md"],
      PACKAGES,
    );
    expect(decision.verdict).toBe("changeset-present");
  });

  it("treats root-level `files` entries as shipped (SKILL.md, not only dirs)", () => {
    // Regression: isShippedPath used to prefix-match `files` entries as
    // directories only, so packages/skill/SKILL.md was invisible — a skill
    // rewrite + changeset read as `unwarranted` and blocked the PR.
    const withChangeset = decideChangesetComment(
      [".changeset/skill-rewrite.md", "packages/skill/SKILL.md"],
      PACKAGES,
    );
    expect(withChangeset.verdict).toBe("changeset-present");

    const without = decideChangesetComment(["packages/skill/SKILL.md"], PACKAGES);
    expect(without.verdict).toBe("missing");
    expect(without.touched).toEqual(["packages/skill/SKILL.md"]);
  });

  // Regression: Devin review on #1132 — @ggsvelte/svelte publishes compiled
  // dist/ (gitignored), so files is [dist, bin] with no src. Without
  // mapping src → shipped surface, real svelte fixes + changesets got
  // unwarranted and the new gate blocked them.
  it("treats svelte src as shipped when package only lists dist (compiled)", () => {
    const decision = decideChangesetComment(
      [".changeset/interval-bounds-editor.md", "packages/svelte/src/lib/interval/bounds-editor.ts"],
      PACKAGES,
    );
    expect(decision.verdict).toBe("changeset-present");
  });

  it("reports missing for svelte src-only edits without a changeset", () => {
    const decision = decideChangesetComment(
      ["packages/svelte/src/lib/interval/bounds-editor.ts"],
      PACKAGES,
    );
    expect(decision.verdict).toBe("missing");
    expect(decision.touched).toEqual(["packages/svelte/src/lib/interval/bounds-editor.ts"]);
  });

  it("stays quiet for changes outside shipped package surfaces", () => {
    const decision = decideChangesetComment(
      [
        "apps/docs/src/routes/+page.svelte",
        "packages/core/tests/scales.test.ts",
        "packages/svelte/vitest.config.ts",
        "packages/spec/CHANGELOG.md",
        ".github/workflows/ci.yml",
        "scripts/ci-routing.ts",
      ],
      PACKAGES,
    );
    expect(decision.verdict).toBe("not-needed");
  });

  it("treats package README.md as shipped (npm always packs it)", () => {
    const decision = decideChangesetComment(["packages/spec/README.md"], PACKAGES);
    expect(decision.verdict).toBe("missing");
    expect(decision.touched).toEqual(["packages/spec/README.md"]);
  });

  it("stays quiet for test files colocated inside shipped dirs", () => {
    const decision = decideChangesetComment(
      ["packages/core/src/scales.test.ts", "packages/spec/src/lint.spec.ts"],
      PACKAGES,
    );
    expect(decision.verdict).toBe("not-needed");
  });

  it("does not count .changeset/README.md as a changeset", () => {
    const decision = decideChangesetComment(
      [".changeset/README.md", "packages/core/src/scales.ts"],
      PACKAGES,
    );
    expect(decision.verdict).toBe("missing");
  });

  it("unwarranted ignores .changeset/README.md alone", () => {
    const decision = decideChangesetComment(
      [".changeset/README.md", "apps/docs/src/routes/+page.svelte"],
      PACKAGES,
    );
    expect(decision.verdict).toBe("not-needed");
  });

  // Regression: #1194 reclassified pending theme/palette changesets
  // patch → minor without touching package src. That is a legitimate release
  // fix, not docs pollution — only *added* changesets without package code
  // are unwarranted.
  it("allows modifying already-queued changesets without package code", () => {
    const decision = decideChangesetComment(
      [
        "M\t.changeset/economist-palette.md",
        "M\t.changeset/solarized-themes-palette.md",
        "M\tCONTRIBUTING.md",
        "M\tscripts/deprecation-wiring.test.ts",
      ],
      PACKAGES,
    );
    expect(decision.verdict).toBe("not-needed");
  });

  it("still blocks newly added changesets without package code (name-status)", () => {
    const decision = decideChangesetComment(
      ["A\t.changeset/docs-only.md", "M\tapps/docs/src/routes/+page.svelte"],
      PACKAGES,
    );
    expect(decision.verdict).toBe("unwarranted");
  });

  it("treats a newly added changeset with shipped code as present (name-status)", () => {
    const decision = decideChangesetComment(
      ["A\t.changeset/my-change.md", "M\tpackages/core/src/scales.ts"],
      PACKAGES,
    );
    expect(decision.verdict).toBe("changeset-present");
  });
});

describe("changeset-check workflow wiring", () => {
  const workflow = readFileSync(join(root, ".github/workflows/changeset-check.yml"), "utf8");

  it("routes the PR diff through the tested script", () => {
    expect(workflow).toContain("bun scripts/changeset-check.ts emit --stdin");
  });

  it("can write PR comments but nothing else", () => {
    expect(workflow).toContain("permissions: {}");
    expect(workflow).toContain("pull-requests: write");
    expect(workflow).toContain("persist-credentials: false");
  });

  it("skips the bot's own Version Packages PR and fork PRs", () => {
    expect(workflow).toContain("changeset-release/main");
    expect(workflow).toContain(
      "github.event.pull_request.head.repo.full_name == github.repository",
    );
  });

  it("syncs sticky comments for missing and unwarranted; fails only on unwarranted", () => {
    expect(workflow).toContain(COMMENT_MARKER);
    // Comment both advisory-missing and blocking-unwarranted.
    expect(workflow).toContain('"${VERDICT}" = "missing"');
    expect(workflow).toContain('"${VERDICT}" = "unwarranted"');
    // Hard fail only for the docs/examples false-positive path.
    expect(workflow).toContain("steps.decide.outputs.verdict == 'unwarranted'");
    expect(workflow).toContain("exit 1");
    // Missing remains advisory — the fail step is gated on unwarranted only.
    expect(workflow).not.toContain("steps.decide.outputs.verdict == 'missing'");
  });
});

describe("emit CLI", () => {
  it("writes the verdict to GITHUB_OUTPUT and the comment body to --body-out", () => {
    const dir = mkdtempSync(join(tmpdir(), "changeset-check-"));
    const outputFile = join(dir, "github-output");
    const bodyFile = join(dir, "comment.md");
    writeFileSync(outputFile, "");
    const result = Bun.spawnSync({
      cmd: [
        "bun",
        join(root, "scripts/changeset-check.ts"),
        "emit",
        "--stdin",
        "--body-out",
        bodyFile,
      ],
      stdin: Buffer.from("packages/core/src/scales.ts\n"),
      env: { ...process.env, GITHUB_OUTPUT: outputFile },
    });
    expect(result.exitCode).toBe(0);
    expect(readFileSync(outputFile, "utf8")).toContain("verdict=missing");
    expect(readFileSync(bodyFile, "utf8")).toContain("packages/core/src/scales.ts");
  });

  it("emits unwarranted for docs-only + changeset without failing the emit process", () => {
    // Fail happens in the workflow after the sticky comment syncs.
    const dir = mkdtempSync(join(tmpdir(), "changeset-check-unw-"));
    const outputFile = join(dir, "github-output");
    const bodyFile = join(dir, "comment.md");
    writeFileSync(outputFile, "");
    const result = Bun.spawnSync({
      cmd: [
        "bun",
        join(root, "scripts/changeset-check.ts"),
        "emit",
        "--stdin",
        "--body-out",
        bodyFile,
      ],
      stdin: Buffer.from(".changeset/docs-only.md\napps/docs/src/routes/+page.svelte\n"),
      env: { ...process.env, GITHUB_OUTPUT: outputFile },
    });
    expect(result.exitCode).toBe(0);
    expect(readFileSync(outputFile, "utf8")).toContain("verdict=unwarranted");
    expect(readFileSync(bodyFile, "utf8")).toContain("Changeset not allowed");
  });
});

describe("discoverPublishedPackages", () => {
  it("finds exactly the npm-published workspace packages with their shipped dirs", () => {
    // Real-repo fixture: if a package is added, made private, or reshapes its
    // npm `files`, this test is the reminder to reconfirm the check's scope.
    expect(discoverPublishedPackages(root)).toEqual(PACKAGES);
  });
});

describe("renderComment", () => {
  it("explains a missing changeset without blocking, and lists touched files", () => {
    const body = renderComment({
      verdict: "missing",
      touched: ["packages/core/src/scales.ts", "packages/core/src/theme.ts"],
    });
    expect(body).toContain(COMMENT_MARKER);
    expect(body).toContain("bun changeset");
    expect(body).toContain("packages/core/src/scales.ts");
    expect(body).toContain("not block");
  });

  it("caps the touched-file listing at 10 and reports the remainder", () => {
    const touched = Array.from({ length: 14 }, (_, i) => `packages/core/src/mod-${i}.ts`);
    const body = renderComment({ verdict: "missing", touched });
    expect(body).toContain("packages/core/src/mod-9.ts");
    expect(body).not.toContain("packages/core/src/mod-10.ts");
    expect(body).toContain("4 more");
  });

  it("acknowledges a changeset once one is added with shipped code", () => {
    const body = renderComment({ verdict: "changeset-present", touched: [] });
    expect(body).toContain(COMMENT_MARKER);
    expect(body).toContain("Changeset detected");
  });

  it("marks internal-only PRs as needing nothing", () => {
    const body = renderComment({ verdict: "not-needed", touched: [] });
    expect(body).toContain(COMMENT_MARKER);
    expect(body).toContain("No changeset needed");
  });

  it("explains and blocks an unwarranted docs/examples changeset", () => {
    const body = renderComment({ verdict: "unwarranted", touched: [] });
    expect(body).toContain(COMMENT_MARKER);
    expect(body).toContain("Changeset not allowed");
    expect(body).toContain("delete the `.changeset/*.md`");
    expect(body).toContain("blocks");
  });
});
