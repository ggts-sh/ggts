/**
 * Pack-shape contract for @ggsvelte/skill (packages/skill/).
 *
 * The package root IS the skill directory: SKILL.md + references/ ship as the
 * whole consumer surface, and the package versions in lock-step with the other
 * four @ggsvelte/* packages (changesets fixed group). Guards:
 *
 * 1. Identity — name, publishConfig (access public + provenance, required for
 *    OIDC trusted publishing after the one-time hand-publish; see decision
 *    0023), and repository.directory matching the monorepo location.
 * 2. Lock-step version — version equals every sibling's. Changesets keeps the
 *    fixed group equal at release time; this fails fast on a botched manual
 *    bump or a hand-publish at the wrong version.
 * 3. Pack completeness — `files` covers SKILL.md and references/, and every
 *    skill source file under the package dir is reachable through a `files`
 *    entry (no silently unpackaged reference doc).
 * 4. SKILL.md frontmatter — `name: ggsvelte` present; NO version key. The
 *    package.json version is the single version source (dependabot reads it);
 *    a frontmatter stamp would drift on every changesets Version Packages PR.
 */
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");
const PKG_DIR = join(ROOT, "packages", "skill");

const manifest = JSON.parse(readFileSync(join(PKG_DIR, "package.json"), "utf8")) as {
  name: string;
  version: string;
  files?: string[];
  publishConfig?: { access?: string; provenance?: boolean };
  repository?: { directory?: string };
};

const SIBLINGS = ["cli", "compose", "core", "react", "spec", "svelte"] as const;

function siblingVersion(dir: string): string {
  const pkg = JSON.parse(readFileSync(join(ROOT, "packages", dir, "package.json"), "utf8")) as {
    version: string;
  };
  return pkg.version;
}

function walk(dir: string, base: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path, base);
    return [relative(base, path)];
  });
}

describe("@ggsvelte/skill package identity", () => {
  it("is named @ggsvelte/skill with public OIDC publish config", () => {
    expect(manifest.name).toBe("@ggsvelte/skill");
    expect(manifest.publishConfig).toEqual({ access: "public", provenance: true });
    expect(manifest.repository?.directory).toBe("packages/skill");
  });

  it("versions in lock-step with the fixed group", () => {
    for (const sibling of SIBLINGS) {
      expect(manifest.version).toBe(siblingVersion(sibling));
    }
  });
});

describe("@ggsvelte/skill pack completeness", () => {
  const files = manifest.files ?? [];

  it("lists SKILL.md and references/ in files", () => {
    expect(files).toContain("SKILL.md");
    expect(files).toContain("references");
  });

  it("every skill source file is reachable through a files entry", () => {
    const skillFiles = walk(PKG_DIR, PKG_DIR).filter(
      (path) => path === "SKILL.md" || path.startsWith("references/"),
    );
    expect(skillFiles.length).toBeGreaterThan(1); // SKILL.md + at least one reference
    for (const path of skillFiles) {
      const covered = files.some((entry) => path === entry || path.startsWith(`${entry}/`));
      expect({ path, covered }).toEqual({ path, covered: true });
    }
  });
});

describe("@ggsvelte/skill SKILL.md frontmatter", () => {
  const skill = readFileSync(join(PKG_DIR, "SKILL.md"), "utf8");
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";

  it("names the skill ggsvelte", () => {
    expect(frontmatter).toMatch(/^name: ggsvelte$/m);
  });

  it("carries no version stamp (package.json is the single version source)", () => {
    expect(frontmatter).not.toMatch(/^version:/m);
  });
});
