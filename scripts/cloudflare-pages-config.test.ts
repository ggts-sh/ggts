import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface PagesConfig {
  schemaVersion: number;
  integration: string;
  workflow: string;
  projectName: string;
  productionBranch: string;
  buildCommand: string;
  destinationDirectory: string;
  rootDirectory: string;
  runtimes: Record<string, string>;
  environments: Record<string, Record<string, string>>;
  externalRedirects: readonly {
    source: string;
    target: string;
    status: number;
    preserveQueryString: boolean;
    subpathMatching: boolean;
    preservePathSuffix: boolean;
    includeSubdomains: boolean;
  }[];
  watchPaths: readonly string[];
}

const ROOT = join(import.meta.dir, "..");

describe("Cloudflare Pages project contract", () => {
  it("pins a GitHub Actions direct-upload build with distinct production and preview modes", () => {
    const path = join(ROOT, "apps", "docs", "deployment", "cloudflare-pages.json");
    const config = JSON.parse(readFileSync(path, "utf8")) as PagesConfig;

    expect(config).toMatchObject({
      schemaVersion: 1,
      integration: "github-actions-direct-upload",
      workflow: ".github/workflows/cloudflare-pages.yml",
      projectName: "ggsvelte",
      productionBranch: "main",
      buildCommand: "bun run build:cloudflare",
      destinationDirectory: "apps/docs/build",
      rootDirectory: "",
      runtimes: { BUN_VERSION: "1.4.0", NODE_VERSION: "22" },
      environments: {
        production: { DOCS_BUILD_MODE: "cloudflare-production" },
        preview: { DOCS_BUILD_MODE: "cloudflare-preview" },
      },
    });
    expect(config.externalRedirects).toEqual([
      {
        source: "https://ggsvelte.pages.dev",
        target: "https://ggts.sh",
        status: 301,
        preserveQueryString: true,
        subpathMatching: true,
        preservePathSuffix: true,
        includeSubdomains: false,
      },
      {
        source: "https://www.ggts.sh",
        target: "https://ggts.sh",
        status: 301,
        preserveQueryString: true,
        subpathMatching: true,
        preservePathSuffix: true,
        includeSubdomains: false,
      },
    ]);
    expect(config.watchPaths).toEqual([
      "apps/docs/**",
      "packages/**",
      "examples/**",
      "scripts/**",
      "lifecycle.json",
      "support-matrix.json",
      "package.json",
      "bun.lock",
      "tsconfig.json",
      "tsconfig.base.json",
      "mise.toml",
    ]);

    const workflow = readFileSync(join(ROOT, config.workflow), "utf8");
    expect(workflow).toContain("support-matrix.json");
    expect(workflow).toContain("node-version: 22");
    expect(workflow).toContain("bun run build:cloudflare");
    expect(workflow).toContain("bunx wrangler pages deploy apps/docs/build");
    expect(workflow).toContain("CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}");
    expect(workflow).toContain("CLOUDFLARE_ACCOUNT_ID: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}");
    expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
    expect(workflow).toContain("ref: ${{ github.sha }}");
    expect(workflow).not.toContain("pull_request:");
    // Superseded builds cancel; deploy/smoke does not cancel mid-flight.
    expect(workflow).toContain("group: cloudflare-pages-build");
    expect(workflow).toMatch(/cancel-in-progress:\s*true/);
    expect(workflow).toContain("group: cloudflare-pages-deploy");
    expect(workflow).toMatch(/cancel-in-progress:\s*false/);
    // Build keeps the production environment so env secrets (analytics token)
    // still inject after the job split.
    expect(workflow).toMatch(/build:[\s\S]*environment:\s*\n\s*name: cloudflare-production/);
    expect(workflow).toContain("bun scripts/deployment-asset-smoke-cli.ts");
  });

  it("ships a CSP-safe deploy-recovery bootstrap from static assets", () => {
    const appHtml = readFileSync(join(ROOT, "apps", "docs", "src", "app.html"), "utf8");
    const recovery = readFileSync(
      join(ROOT, "apps", "docs", "static", "deploy-recovery.js"),
      "utf8",
    );
    expect(appHtml).toContain('src="%sveltekit.assets%/deploy-recovery.js"');
    expect(recovery).toContain("vite:preloadError");
    expect(recovery).toContain("Failed to fetch dynamically imported module");
    expect(recovery).toContain("ggsvelte-deploy-recovery-at");
    // Storage-blocked clients use a timestamped query flag with cooldown;
    // only preventDefault when recovery is still available.
    expect(recovery).toContain("ggsvelte_deploy_recovery");
    expect(recovery).toContain("withinCooldown");
    expect(recovery).toContain("if (recentlyReloaded()) return;");
  });

  it("does not keep a GitHub Pages deployment workflow or legacy migration scripts", () => {
    expect(existsSync(join(ROOT, ".github", "workflows", "pages.yml"))).toBe(false);
    expect(existsSync(join(ROOT, "scripts", "legacy-migration.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "scripts", "legacy-artifact.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "scripts", "legacy-routes.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "scripts", "gen-legacy-routes.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "apps", "docs", "deployment", "legacy-routes.json"))).toBe(false);
  });

  it("keeps GitHub Pages and mutable benchmark history out of the Cloudflare build command", () => {
    const rootPackage = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const command = rootPackage.scripts["build:cloudflare"] ?? "";
    expect(command).toContain("bun scripts/deployment-artifact.ts");
    expect(command).not.toContain("gh-pages");
    expect(command).not.toContain("git fetch");
    expect(command).not.toContain("legacy");
  });
});
