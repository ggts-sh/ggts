import { describe, expect, it } from "bun:test";
import { read } from "./test-helpers";

describe("R0 release wiring — dependencies", () => {
  it("wires Dependabot for bun workspaces and GitHub Actions", () => {
    const dependabot = read(".github/dependabot.yml");
    expect(dependabot).toContain('package-ecosystem: "bun"');
    expect(dependabot).toContain('package-ecosystem: "github-actions"');
    // Monorepo manifests Dependabot should visit (single bun.lock at root).
    for (const directory of [
      '"/"',
      '"/packages/core"',
      '"/packages/compose"',
      '"/packages/react"',
      '"/packages/skill"',
      '"/packages/spec"',
      '"/packages/svelte"',
      '"/packages/cli"',
      '"/apps/docs"',
      '"/examples"',
      '"/benchmarks"',
      '"/spikes/browser"',
      '"/spikes/pure"',
    ]) {
      expect(dependabot).toContain(directory);
    }
    // github-actions "/" only covers workflows; composites need their own dirs.
    expect(dependabot).toContain('"/.github/actions/ci-content-hash-restore"');
    expect(dependabot).toContain('"/.github/actions/ci-content-hash-write"');
    expect(dependabot).toContain('"/.github/actions/ci-setup-bun"');
    expect(dependabot).toContain('"/.github/actions/ci-bun-install"');
    expect(dependabot).toContain('"/.github/actions/ci-download-packages-dist"');
    expect(dependabot).toContain('"/.github/actions/ci-assert-playwright-version-sync"');
    // Human-authored locksteps / Changesets-owned internal ranges.
    expect(dependabot).toContain('dependency-name: "playwright"');
    expect(dependabot).toContain('dependency-name: "@playwright/test"');
    expect(dependabot).toContain('dependency-name: "pnpm"');
    expect(dependabot).toContain('dependency-name: "@ggts-sh/*"');
    // Action bumps group by dependency name across workflows + composites.
    expect(dependabot).toContain("github-actions:");
    expect(dependabot).toContain('patterns: ["*"]');
    expect(dependabot).toContain("group-by: dependency-name");
  });

  it("keeps internal dependencies installable in npm-published manifests", () => {
    for (const path of [
      "packages/core/package.json",
      "packages/compose/package.json",
      "packages/svelte/package.json",
      "packages/react/package.json",
      "packages/cli/package.json",
    ]) {
      const manifest = JSON.parse(read(path)) as { dependencies?: Record<string, string> };
      for (const [name, range] of Object.entries(manifest.dependencies ?? {})) {
        if (!name.startsWith("@ggts-sh/")) continue;
        expect(range, `${path}: ${name} must be a registry semver range`).not.toStartWith(
          "workspace:",
        );
      }
    }
  });
});
