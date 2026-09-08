import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import {
  auditAliasCommitRange,
  diffTextIsSubstantive,
  findSubstantiveRuntimePaths,
  isRuntimeBehaviorPath,
  isSkippableCommentLine,
  listChangedFilesFromNameStatus,
  packageVersionAtCommit,
  runtimeBehaviorPaths,
} from "./manual-at-alias-audit.ts";

const repoRoot = join(import.meta.dir, "..", "..", "..");

describe("manual AT alias commit audit", () => {
  it("classifies chart and core sources as runtime behavior paths", () => {
    expect(isRuntimeBehaviorPath("packages/svelte/src/lib/GGPlot.svelte")).toBe(true);
    expect(isRuntimeBehaviorPath("packages/core/src/pipeline.ts")).toBe(true);
    expect(isRuntimeBehaviorPath("packages/spec/src/artifact.ts")).toBe(false);
    expect(isRuntimeBehaviorPath("packages/svelte/package.json")).toBe(false);
    expect(isRuntimeBehaviorPath("docs/accessibility/manual-at/README.md")).toBe(false);
    expect(
      runtimeBehaviorPaths([
        "packages/svelte/package.json",
        "packages/svelte/src/lib/interaction/interaction.ts",
        "packages/core/CHANGELOG.md",
        "packages/core/src/theme.ts",
      ]),
    ).toEqual(["packages/svelte/src/lib/interaction/interaction.ts", "packages/core/src/theme.ts"]);
  });

  it("does not treat CSS universal-selector edits as JSDoc noise", () => {
    expect(isSkippableCommentLine(" * inherited matrix remains applicable")).toBe(true);
    expect(isSkippableCommentLine(" *")).toBe(true);
    expect(isSkippableCommentLine(" // re-export surface")).toBe(true);
    expect(isSkippableCommentLine(" * { pointer-events: none; }")).toBe(false);
    expect(isSkippableCommentLine("*.mark { opacity: 0.4; }")).toBe(false);
    // Combinators after `*` must stay substantive (not JSDoc).
    expect(isSkippableCommentLine(" * + * { margin: 0; }")).toBe(false);
    expect(isSkippableCommentLine("* > .mark { opacity: 1; }")).toBe(false);
    expect(isSkippableCommentLine("* ~ * { display: none; }")).toBe(false);
    // JSDoc/Markdown list and blockquote markers after `*` are documentation, not CSS.
    expect(isSkippableCommentLine(" * + positive values are kept")).toBe(true);
    expect(isSkippableCommentLine(" * > Note: domain is shared")).toBe(true);
    expect(isSkippableCommentLine(" * > Note")).toBe(true);
    // Bare lowercase type selectors (incl. multi-line CSS with `{` on the next line).
    expect(isSkippableCommentLine(" * + p")).toBe(false);
    expect(isSkippableCommentLine("* + section")).toBe(false);
    expect(isSkippableCommentLine("* > div")).toBe(false);
    // Descendant chains after combinators with CSS structure are CSS, not JSDoc.
    expect(isSkippableCommentLine("* > ul li { list-style: none; }")).toBe(false);
    expect(isSkippableCommentLine("* + section a { color: red; }")).toBe(false);
    expect(isSkippableCommentLine("* > ul * { margin: 0; }")).toBe(false);
    expect(isSkippableCommentLine("* > ul *")).toBe(false);
    expect(isSkippableCommentLine("* > svg use { fill: currentColor; }")).toBe(false);
    expect(isSkippableCommentLine("* > svg use")).toBe(false);
    // Multi-word English / tag-word prose after combinators stays documentation.
    expect(isSkippableCommentLine("* + positive values, if any")).toBe(true);
    expect(isSkippableCommentLine("* + positive values. Kept")).toBe(true);
    // "a button" is valid CSS (`a button` descendant); prefer AT false-positive on docs.
    expect(isSkippableCommentLine("* + a button")).toBe(false);
    expect(isSkippableCommentLine("* + data table")).toBe(true);
    expect(isSkippableCommentLine("* + source code")).toBe(true);
    // Arbitrary lowercase prose (not HTML/SVG/custom tags) is documentation.
    expect(isSkippableCommentLine("* + minimum latency")).toBe(true);
    expect(isSkippableCommentLine("* > fallback content")).toBe(true);
    // Real bare HTML/SVG/custom tag chains stay CSS (incl. anchor-led, missing SVG, CE).
    expect(isSkippableCommentLine("* + section a")).toBe(false);
    expect(isSkippableCommentLine("* > main nav")).toBe(false);
    expect(isSkippableCommentLine("* > svg linearGradient")).toBe(false);
    expect(isSkippableCommentLine("* > svg polygon")).toBe(false);
    expect(isSkippableCommentLine("* > svg animateMotion")).toBe(false);
    expect(isSkippableCommentLine("* > svg mpath")).toBe(false);
    expect(isSkippableCommentLine("* > svg metadata")).toBe(false);
    // Do not treat camelCase prose or SVG token mid-phrase as CSS.
    expect(isSkippableCommentLine("* + minValue maxValue")).toBe(true);
    expect(isSkippableCommentLine("* + svg fallback content")).toBe(true);
    expect(isSkippableCommentLine("* + g scale")).toBe(true);
    expect(isSkippableCommentLine("* > my-widget path")).toBe(false);
    expect(isSkippableCommentLine("* + a span")).toBe(false);
    expect(isSkippableCommentLine("* > a img")).toBe(false);
    // Continuations after multi-token chains (comma / nested combinators).
    expect(isSkippableCommentLine("* > ul li, ol li { margin: 0; }")).toBe(false);
    expect(isSkippableCommentLine("* > ul li > a { color: red; }")).toBe(false);
    expect(isSkippableCommentLine("* > ul li > a")).toBe(false);
    expect(
      diffTextIsSubstantive(`diff --git a/x.svelte b/x.svelte
--- a/x.svelte
+++ b/x.svelte
@@ -1 +1 @@
-* > ul li { margin: 0; }
+* > ul div { margin: 0; }
`),
    ).toBe(true);
    expect(
      diffTextIsSubstantive(`diff --git a/x.ts b/x.ts
--- a/x.ts
+++ b/x.ts
@@ -1,3 +1,3 @@
 /**
- * + old list item
+ * + positive values are kept
  */
`),
    ).toBe(false);
    expect(
      diffTextIsSubstantive(`diff --git a/x.svelte b/x.svelte
--- a/x.svelte
+++ b/x.svelte
@@ -1 +1 @@
-* { pointer-events: auto; }
+* { pointer-events: none; }
`),
    ).toBe(true);
    expect(
      diffTextIsSubstantive(`diff --git a/x.svelte b/x.svelte
--- a/x.svelte
+++ b/x.svelte
@@ -1 +1 @@
-* + * { margin: 0; }
+* + * { margin: 4px; }
`),
    ).toBe(true);
    expect(
      diffTextIsSubstantive(`diff --git a/cli.ts b/cli.ts
--- a/cli.ts
+++ b/cli.ts
@@ -1,3 +1,3 @@
 /**
- * old package name
+ * new package name
  */
`),
    ).toBe(false);
    expect(
      diffTextIsSubstantive(
        "Binary files a/packages/svelte/src/lib/icon.png and b/packages/svelte/src/lib/icon.png differ\n",
      ),
    ).toBe(true);
  });

  it("accepts the packaging-only v0.1.0→v0.1.1 alias range", () => {
    // Inherited testedCommit (v0.1.0) .. releaseCommit (v0.1.1).
    const base = "7f95673c2c72ddfd10329acc3195f62ef8ecea87";
    const head = "68f29f80b22b91d301378b4e6e17d2abd7b093ec";
    expect(packageVersionAtCommit(repoRoot, head)).toBe("0.1.1");
    expect(findSubstantiveRuntimePaths(repoRoot, base, head)).toEqual([]);
    expect(() => {
      auditAliasCommitRange({
        repoRoot,
        baseCommit: base,
        releaseCommit: head,
        releaseVersion: "0.1.1",
      });
    }).not.toThrow();
  });

  it("rejects a releaseCommit that does not publish the claimed release version", () => {
    const packagingTip = "68f29f80b22b91d301378b4e6e17d2abd7b093ec";
    const base = "7f95673c2c72ddfd10329acc3195f62ef8ecea87";
    expect(() => {
      auditAliasCommitRange({
        repoRoot,
        baseCommit: base,
        releaseCommit: packagingTip,
        releaseVersion: "0.1.2",
      });
    }).toThrow(/@ggts-sh\/svelte is 0\.1\.1/);
  });

  it("rejects a commit range that substantively edits runtime sources", () => {
    // v0.1.1 packaging tip .. linked interaction controller (#43).
    const packagingTip = "68f29f80b22b91d301378b4e6e17d2abd7b093ec";
    const withRuntime = "1fc7b4d0847b5c9664806b4dd40c7db8e306a2fa";
    const offenders = findSubstantiveRuntimePaths(repoRoot, packagingTip, withRuntime);
    expect(offenders.some((path) => path.includes("interaction"))).toBe(true);
    // Interaction commit still reports package version 0.1.1, so bind a matching
    // version and still fail on the runtime path audit.
    expect(() => {
      auditAliasCommitRange({
        repoRoot,
        baseCommit: packagingTip,
        releaseCommit: withRuntime,
        releaseVersion: packageVersionAtCommit(repoRoot, withRuntime),
      });
    }).toThrow(/requires a complete record/);
  });

  it("lists both sides of renames when collecting changed paths", () => {
    // Rename out of packages/svelte/src must still surface the source path.
    expect(
      listChangedFilesFromNameStatus(
        [
          "M\tpackages/spec/src/artifact.ts",
          "R100\tpackages/svelte/src/lib/Old.svelte\tpackages/docs/Old.svelte",
          "A\tpackages/core/src/new.ts",
          "D\tpackages/core/src/gone.ts",
        ].join("\n"),
      ).toSorted(),
    ).toEqual(
      [
        "packages/spec/src/artifact.ts",
        "packages/svelte/src/lib/Old.svelte",
        "packages/docs/Old.svelte",
        "packages/core/src/new.ts",
        "packages/core/src/gone.ts",
      ].toSorted(),
    );
  });
});
