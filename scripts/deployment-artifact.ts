import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { resolveDocsBuildConfig } from "../apps/docs/build-mode.ts";
import { validateDocsCsp } from "./docs-csp.ts";
import { createDocsRouteInventory } from "./docs-route-inventory.ts";

export type DeploymentBuildMode = "cloudflare-preview" | "cloudflare-production";

export interface DeploymentRoute {
  readonly path: string;
  readonly canonicalPath: string;
  readonly kind: string;
  readonly index: boolean;
  readonly sitemap: boolean;
}

export interface DeploymentIdentity {
  readonly schemaVersion: 1;
  readonly sourceCommit: string;
  readonly routeInventorySha256: string;
  readonly buildMode: DeploymentBuildMode;
}

const COMMIT_SHA = /^[0-9a-f]{40}$/;
const REQUIRED_SECURITY_HEADERS = [
  "Content-Security-Policy: frame-ancestors 'none'",
  "Permissions-Policy:",
  "Referrer-Policy: strict-origin-when-cross-origin",
  "X-Content-Type-Options: nosniff",
  "X-Frame-Options: DENY",
] as const;

const REQUIRED_DEPLOYMENT_FILES = [
  "index.html",
  "404.html",
  "_headers",
  "_redirects",
  "robots.txt",
  "sitemap.xml",
  "artifact.json",
] as const;

/** True when `rule` appears as a full `_redirects` line (trim-insensitive). */
function hasRedirectRule(redirects: string, rule: string): boolean {
  return redirects.split(/\r?\n/).some((line) => line.trim() === rule);
}

/**
 * HTML/metadata cache policy: browser revalidate (`max-age=0` +
 * `must-revalidate`), optionally with edge `s-maxage=<seconds>`.
 *
 * Exact substring match on `max-age=0, must-revalidate` rejected the
 * production `_headers` line after #1167 (`…max-age=0, s-maxage=600,
 * must-revalidate`), which blocked every Cloudflare Pages deploy and left
 * production stuck on the pre-shell commit.
 */
export function hasHtmlRevalidateCacheControl(headers: string): boolean {
  return /Cache-Control:\s*public,\s*max-age=0(?:,\s*s-maxage=\d+)?,\s*must-revalidate/m.test(
    headers,
  );
}

export function routeInventoryDigest(routes: readonly DeploymentRoute[]): string {
  const inventory = routes
    .map((route) =>
      [
        route.path,
        route.canonicalPath,
        route.kind,
        route.index ? "index" : "noindex",
        route.sitemap ? "sitemap" : "no-sitemap",
      ].join("\0"),
    )
    .join("\n");
  return createHash("sha256").update(`${inventory}\n`).digest("hex");
}

function listFiles(root: string, directory = root): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((name) => {
    const absolute = join(directory, name);
    return statSync(absolute).isDirectory()
      ? listFiles(root, absolute)
      : [absolute.slice(root.length + 1)];
  });
}

export interface DeploymentExpectation {
  readonly sourceCommit: string;
  readonly buildMode: DeploymentBuildMode;
  readonly routes: readonly DeploymentRoute[];
  readonly analyticsToken?: string;
}

const NOT_FOUND_STYLE = `
      :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f5ef; color: #171714; }
      main { width: min(32rem, calc(100% - 3rem)); }
      h1 { margin: 0 0 0.75rem; font-family: ui-serif, Georgia, serif; font-size: clamp(2.5rem, 8vw, 5rem); line-height: 0.95; }
      p { color: #5a574f; font-size: 1.05rem; line-height: 1.6; }
      a { color: inherit; font-weight: 650; text-underline-offset: 0.2em; }
      @media (prefers-color-scheme: dark) { body { background: #171714; color: #f7f5ef; } p { color: #bdb8ad; } }
    `;

export function ensureNotFoundNoindex(buildDirectory: string): void {
  const styleHash = createHash("sha256").update(NOT_FOUND_STYLE).digest("base64");
  writeFileSync(
    join(buildDirectory, "404.html"),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,follow" />
    <meta http-equiv="content-security-policy" content="default-src 'self'; base-uri 'self'; form-action 'self'; frame-src 'none'; img-src 'self' data:; object-src 'none'; script-src 'none'; script-src-attr 'none'; style-src 'self' 'sha256-${styleHash}'; style-src-attr 'none'; upgrade-insecure-requests" />
    <title>Not found — ggts</title>
    <style>${NOT_FOUND_STYLE}</style>
  </head>
  <body>
    <main><h1>Not found</h1><p>This page does not exist.</p><p><a href="/">Go to the ggts documentation</a></p></main>
  </body>
</html>
`,
  );
}

export function ensurePreviewNoindexHeader(
  buildDirectory: string,
  buildMode: DeploymentBuildMode,
): void {
  if (buildMode !== "cloudflare-preview") return;
  const path = join(buildDirectory, "_headers");
  const headers = readFileSync(path, "utf8");
  if (headers.includes("X-Robots-Tag: noindex")) return;
  if (!headers.startsWith("/*\n")) {
    throw new Error("_headers must begin with the broad /* route before preview noindex injection");
  }
  writeFileSync(path, headers.replace("/*\n", "/*\n  X-Robots-Tag: noindex, nofollow\n"));
}

/**
 * Production keeps absolute `/ggsvelte` cleanup redirects so cutover smoke sees
 * canonical `Location: https://ggts.sh/...`. Preview must stay on the
 * preview origin — rewrite those rules to same-host targets so trusted
 * previews never force traffic onto production.
 */
export function ensurePreviewCleanupRedirects(
  buildDirectory: string,
  buildMode: DeploymentBuildMode,
): void {
  if (buildMode !== "cloudflare-preview") return;
  const path = join(buildDirectory, "_redirects");
  if (!existsSync(path)) return;
  const redirects = readFileSync(path, "utf8")
    .replaceAll("/ggsvelte https://ggts.sh/ 301", "/ggsvelte / 301")
    .replaceAll("/ggsvelte/* https://ggts.sh/:splat 301", "/ggsvelte/* /:splat 301");
  writeFileSync(path, redirects);
}

function validateHtmlDocuments(
  buildDirectory: string,
  expected: DeploymentExpectation,
  problems: string[],
): { hasAnalyticsBeacon: boolean; hasExpectedAnalyticsToken: boolean } {
  let hasAnalyticsBeacon = false;
  let hasExpectedAnalyticsToken = false;
  for (const path of listFiles(buildDirectory).filter((file) => file.endsWith(".html"))) {
    const html = readFileSync(join(buildDirectory, path), "utf8");
    if (/\b(?:href|src)=["']https:\/\/ljodea\.github\.io\/ggsvelte(?:\/|["'])/i.test(html)) {
      problems.push(`${path} leaks the legacy documentation origin`);
    }
    if (/\b(?:href|src)=["']\/ggsvelte(?:\/|["'])/i.test(html)) {
      problems.push(`${path} contains a /ggsvelte project-base URL`);
    }
    if (!html.includes("https://static.cloudflareinsights.com/beacon.min.js")) continue;
    hasAnalyticsBeacon = true;
    if (expected.analyticsToken !== undefined && html.includes(expected.analyticsToken)) {
      hasExpectedAnalyticsToken = true;
    }
  }
  return { hasAnalyticsBeacon, hasExpectedAnalyticsToken };
}

function validateNotFound(buildDirectory: string, problems: string[]): void {
  const path = join(buildDirectory, "404.html");
  if (!existsSync(path)) return;
  const html = readFileSync(path, "utf8");
  if (!html.includes('name="robots" content="noindex')) {
    problems.push("404.html must contain a noindex robots policy");
  }
  if (!html.includes("<main><h1>Not found</h1>")) {
    problems.push("404.html must render Not found without JavaScript");
  }
  if (html.includes("<script")) problems.push("404.html must remain useful without client scripts");
}

function validateAnalytics(
  expected: DeploymentExpectation,
  state: { hasAnalyticsBeacon: boolean; hasExpectedAnalyticsToken: boolean },
  problems: string[],
): void {
  if (expected.buildMode === "cloudflare-preview" && state.hasAnalyticsBeacon) {
    problems.push("preview artifact must not contain the Cloudflare Web Analytics beacon");
  }
  if (
    expected.buildMode === "cloudflare-production" &&
    expected.analyticsToken !== undefined &&
    (!state.hasAnalyticsBeacon || !state.hasExpectedAnalyticsToken)
  ) {
    problems.push("production artifact is missing the configured Cloudflare Web Analytics beacon");
  }
}

function validateHeaders(
  buildDirectory: string,
  expected: DeploymentExpectation,
  problems: string[],
): boolean {
  const path = join(buildDirectory, "_headers");
  if (!existsSync(path)) return false;
  const headers = readFileSync(path, "utf8");
  for (const policy of REQUIRED_SECURITY_HEADERS) {
    if (!headers.includes(policy)) {
      problems.push(`_headers is missing required security policy: ${policy}`);
    }
  }
  if (!hasHtmlRevalidateCacheControl(headers)) {
    problems.push("_headers must revalidate public HTML and metadata");
  }
  if (
    expected.buildMode === "cloudflare-preview" &&
    !headers.includes("/*\n  X-Robots-Tag: noindex")
  ) {
    problems.push("preview _headers must apply X-Robots-Tag: noindex to every route");
  }
  if (
    !headers.includes("/_app/immutable/*") ||
    !headers.includes("Cache-Control: public, max-age=31536000, immutable")
  ) {
    problems.push("_headers must cache only SvelteKit immutable assets for one year");
  }
  if (!headers.includes("/_app/immutable/*\n  ! Cache-Control\n")) {
    problems.push("_headers must detach the inherited HTML cache policy from immutable assets");
  }
  return true;
}

function validateRedirects(
  buildDirectory: string,
  expected: DeploymentExpectation,
  problems: string[],
): void {
  const path = join(buildDirectory, "_redirects");
  if (!existsSync(path)) return;
  const redirects = readFileSync(path, "utf8");
  if (/^https:\/\/\S+\s+/m.test(redirects)) {
    problems.push("_redirects must not contain unsupported domain-level source URLs");
  }
  if (redirects.includes("ljodea.github.io") || redirects.includes("github.io/ggsvelte")) {
    problems.push("_redirects must not send traffic to GitHub Pages");
  }
  if (/^\/bench(?:\s|\/\*)/m.test(redirects)) {
    problems.push("_redirects must not preserve /bench GitHub Pages history redirects");
  }
  if (expected.buildMode === "cloudflare-production") {
    if (
      !hasRedirectRule(redirects, "/ggsvelte https://ggts.sh/ 301") ||
      !hasRedirectRule(redirects, "/ggsvelte/* https://ggts.sh/:splat 301")
    ) {
      problems.push("_redirects is missing the absolute /ggsvelte cleanup redirect");
    }
    return;
  }
  if (expected.buildMode !== "cloudflare-preview") return;
  if (
    hasRedirectRule(redirects, "/ggsvelte https://ggts.sh/ 301") ||
    hasRedirectRule(redirects, "/ggsvelte/* https://ggts.sh/:splat 301")
  ) {
    problems.push("preview _redirects must not send /ggsvelte cleanup traffic to production");
  }
  if (
    !hasRedirectRule(redirects, "/ggsvelte / 301") ||
    !hasRedirectRule(redirects, "/ggsvelte/* /:splat 301")
  ) {
    problems.push("_redirects is missing the same-origin /ggsvelte cleanup redirect");
  }
}

function validateIdentity(
  buildDirectory: string,
  expected: DeploymentExpectation,
  problems: string[],
): void {
  const path = join(buildDirectory, "artifact.json");
  if (!existsSync(path)) return;
  let actual: unknown;
  try {
    actual = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    problems.push("artifact.json is not valid JSON");
  }
  if (
    actual !== undefined &&
    JSON.stringify(actual) !== JSON.stringify(buildDeploymentIdentity(expected))
  ) {
    problems.push("artifact.json does not match the expected source, routes, and build mode");
  }
}

export function validateDeploymentArtifact(
  buildDirectory: string,
  expected: DeploymentExpectation,
): string[] {
  const problems = REQUIRED_DEPLOYMENT_FILES.filter(
    (path) => !existsSync(join(buildDirectory, path)),
  ).map((path) => `missing required deployment file: ${path}`);
  for (const path of listFiles(buildDirectory, join(buildDirectory, "bench"))) {
    problems.push(`Cloudflare artifact must not contain mutable benchmark history: ${path}`);
  }
  const analytics = validateHtmlDocuments(buildDirectory, expected, problems);
  validateNotFound(buildDirectory, problems);
  validateAnalytics(expected, analytics, problems);
  const hasHeaders = validateHeaders(buildDirectory, expected, problems);
  validateRedirects(buildDirectory, expected, problems);
  if (hasHeaders) problems.push(...validateDocsCsp(buildDirectory));
  validateIdentity(buildDirectory, expected, problems);
  return problems;
}

export function buildDeploymentIdentity(input: {
  readonly sourceCommit: string;
  readonly buildMode: DeploymentBuildMode;
  readonly routes: readonly DeploymentRoute[];
}): DeploymentIdentity {
  if (!COMMIT_SHA.test(input.sourceCommit)) {
    throw new Error(
      `Deployment source commit must be a lowercase 40-character SHA: ${input.sourceCommit}`,
    );
  }
  return {
    schemaVersion: 1,
    sourceCommit: input.sourceCommit,
    routeInventorySha256: routeInventoryDigest(input.routes),
    buildMode: input.buildMode,
  };
}

function sourceCommit(): string {
  return (
    process.env["CF_PAGES_COMMIT_SHA"] ??
    process.env["GITHUB_SHA"] ??
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
  );
}

export function deploymentBuildConfig(environment: Readonly<Record<string, string | undefined>>) {
  return resolveDocsBuildConfig({
    ...(environment["DOCS_BUILD_MODE"] === undefined
      ? {}
      : { mode: environment["DOCS_BUILD_MODE"] }),
    ...(environment["BASE_PATH"] === undefined ? {} : { basePath: environment["BASE_PATH"] }),
    ...(environment["DOCS_ANALYTICS_TOKEN"] === undefined
      ? {}
      : { analyticsToken: environment["DOCS_ANALYTICS_TOKEN"] }),
  });
}

function main(): void {
  const config = deploymentBuildConfig(process.env);
  if (config.mode !== "cloudflare-preview" && config.mode !== "cloudflare-production") {
    throw new Error(
      `Deployment artifact generation requires a Cloudflare build mode, received ${config.mode}`,
    );
  }

  const buildDirectory = join(import.meta.dir, "..", "apps", "docs", "build");
  const expected: DeploymentExpectation = {
    sourceCommit: sourceCommit(),
    buildMode: config.mode,
    routes: createDocsRouteInventory(),
    ...(config.analyticsToken === null ? {} : { analyticsToken: config.analyticsToken }),
  };
  ensureNotFoundNoindex(buildDirectory);
  ensurePreviewNoindexHeader(buildDirectory, config.mode);
  ensurePreviewCleanupRedirects(buildDirectory, config.mode);
  writeFileSync(
    join(buildDirectory, "artifact.json"),
    `${JSON.stringify(buildDeploymentIdentity(expected), null, 2)}\n`,
  );
  const problems = validateDeploymentArtifact(buildDirectory, expected);
  if (problems.length > 0) {
    throw new Error(
      `Cloudflare deployment artifact is invalid:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`,
    );
  }
  console.log(
    `Cloudflare artifact is valid for ${config.mode} at ${expected.sourceCommit.slice(0, 12)}.`,
  );
}

if (import.meta.main) main();
