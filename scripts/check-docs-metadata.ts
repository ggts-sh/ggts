import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { resolveDocsBuildConfig, type DocsBuildConfig } from "../apps/docs/build-mode.ts";
import {
  createDocsRouteInventory,
  routeCanonicalUrl,
  type DocsRouteRecord,
} from "./docs-route-inventory.ts";
import { buildSeoDocument } from "./docs-seo.ts";
import { docsDiscoveryFacts, markdownOutsideFences } from "./gen-llms.ts";

function fail(message: string): never {
  throw new Error(`Docs metadata check failed: ${message}`);
}

function htmlPath(buildDir: string, routePath: string): string {
  return routePath === "/"
    ? join(buildDir, "index.html")
    : join(buildDir, `${routePath.slice(1)}.html`);
}

function matches(html: string, pattern: RegExp): string[] {
  return html.match(pattern) ?? [];
}

function escapeHtmlAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function requireHeadValue(head: string, markup: string, routePath: string, kind: string): void {
  if (!head.includes(markup)) fail(`${routePath} social metadata is missing or disagrees: ${kind}`);
}

function listHtmlFiles(root: string, directory = root): string[] {
  return readdirSync(directory).flatMap((name) => {
    const absolute = join(directory, name);
    if (statSync(absolute).isDirectory()) return listHtmlFiles(root, absolute);
    return absolute.endsWith(".html") ? [absolute.slice(root.length + 1)] : [];
  });
}

function validateStructuredData(
  route: DocsRouteRecord,
  head: string,
  expectedStructuredData: readonly unknown[],
): void {
  const scripts = [...head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (scripts.length !== (expectedStructuredData.length === 0 ? 0 : 1)) {
    fail(`${route.path} structured data script count does not match the visible page`);
  }
  if (scripts.length === 0) return;
  let actual: unknown;
  try {
    actual = JSON.parse(scripts[0]![1]!);
  } catch {
    fail(`${route.path} structured data is not valid JSON`);
  }
  if (JSON.stringify(actual) !== JSON.stringify(expectedStructuredData)) {
    fail(`${route.path} structured data disagrees with generated route and package facts`);
  }
}

function validateBuiltRoute(
  buildDir: string,
  config: DocsBuildConfig,
  route: DocsRouteRecord,
): void {
  const path = htmlPath(buildDir, route.path);
  const html = readFileSync(path, "utf8");
  const head = html.slice(0, html.indexOf("</head>"));
  const titles = matches(head, /<title>[^<]*<\/title>/g);
  const descriptions = matches(head, /<meta name="description" content="[^"]*"\s*\/>/g);
  const canonicals = matches(head, /<link rel="canonical" href="[^"]*"\s*\/>/g);
  const robots = matches(head, /<meta name="robots" content="[^"]*"\s*\/>/g);
  if (titles.length !== 1) fail(`${route.path} has ${String(titles.length)} title tags`);
  if (descriptions.length !== 1) {
    fail(`${route.path} has ${String(descriptions.length)} descriptions`);
  }
  if (canonicals.length !== 1) fail(`${route.path} has ${String(canonicals.length)} canonicals`);
  const canonical = routeCanonicalUrl(route, config.canonicalBase);
  if (!canonicals[0]!.includes(`href="${canonical}"`)) {
    fail(`${route.path} canonical does not match ${canonical}`);
  }
  const title = escapeHtmlAttribute(route.title);
  const description = escapeHtmlAttribute(route.description);
  const expectedSeo = buildSeoDocument(route, config.canonicalBase);
  const socialImage = expectedSeo.image.url;
  for (const [kind, markup] of [
    ["Open Graph site name", '<meta property="og:site_name" content="ggts"/>'],
    ["Open Graph type", '<meta property="og:type" content="website"/>'],
    ["Open Graph title", `<meta property="og:title" content="${title}"/>`],
    ["Open Graph description", `<meta property="og:description" content="${description}"/>`],
    ["Open Graph URL", `<meta property="og:url" content="${canonical}"/>`],
    ["Open Graph image", `<meta property="og:image" content="${socialImage}"/>`],
    [
      "Open Graph image width",
      `<meta property="og:image:width" content="${String(expectedSeo.image.width)}"/>`,
    ],
    [
      "Open Graph image height",
      `<meta property="og:image:height" content="${String(expectedSeo.image.height)}"/>`,
    ],
    [
      "Open Graph image alternative",
      `<meta property="og:image:alt" content="${escapeHtmlAttribute(expectedSeo.image.alt)}"/>`,
    ],
    ["Twitter card", '<meta name="twitter:card" content="summary_large_image"/>'],
    ["Twitter title", `<meta name="twitter:title" content="${title}"/>`],
    ["Twitter description", `<meta name="twitter:description" content="${description}"/>`],
    ["Twitter image", `<meta name="twitter:image" content="${socialImage}"/>`],
    [
      "Twitter image alternative",
      `<meta name="twitter:image:alt" content="${escapeHtmlAttribute(expectedSeo.image.alt)}"/>`,
    ],
  ] as const) {
    requireHeadValue(head, markup, route.path, kind);
  }
  validateStructuredData(route, head, expectedSeo.structuredData);
  const shouldNoindex = !config.indexable || !route.index;
  if (robots.length !== (shouldNoindex ? 1 : 0)) {
    fail(`${route.path} robots policy does not match mode ${config.mode}`);
  }
}

function validateSitemap(
  buildDir: string,
  config: DocsBuildConfig,
  routes: readonly DocsRouteRecord[],
): void {
  const sitemap = readFileSync(join(buildDir, "sitemap.xml"), "utf8");
  const actualUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]!);
  const expectedUrls = routes
    .filter((route) => route.sitemap)
    .map((route) => routeCanonicalUrl(route, config.canonicalBase));
  if (JSON.stringify(actualUrls) !== JSON.stringify(expectedUrls)) {
    fail("sitemap URLs do not match the canonical route inventory");
  }
}

function validateRobots(buildDir: string, config: DocsBuildConfig): void {
  const robots = readFileSync(join(buildDir, "robots.txt"), "utf8");
  const expectedPolicy = config.indexable ? "Allow: /" : "Disallow: /";
  if (!robots.includes(expectedPolicy)) fail(`robots.txt is missing ${expectedPolicy}`);
  if (!robots.includes(`Sitemap: ${config.canonicalBase}/sitemap.xml`)) {
    fail("robots.txt is missing the absolute mode-specific sitemap URL");
  }
}

function validateDiscoveryFiles(buildDir: string, config: DocsBuildConfig): void {
  const facts = docsDiscoveryFacts(config.canonicalBase);
  for (const filename of ["llms.txt", "llms-full.txt"] as const) {
    const text = readFileSync(join(buildDir, filename), "utf8");
    const discoveryText = markdownOutsideFences(text);
    if (discoveryText.includes("](/")) fail(`${filename} contains a root-relative discovery link`);
    if (config.base === "" && discoveryText.includes("https://ljodea.github.io/ggsvelte")) {
      fail(`${filename} leaks the legacy production prefix into a root build`);
    }
    for (const expected of [
      `Package version: ${facts.packageVersion}`,
      `Defaults edition: ${String(facts.currentEdition)}`,
      `Registered chart themes (${String(facts.themeNames.length)}): ${facts.themeNames.join(", ")}`,
    ]) {
      if (!text.includes(expected))
        fail(`${filename} is missing current release fact: ${expected}`);
    }
  }
}

export function validateDocsBuildMetadata(
  buildDir: string,
  config: DocsBuildConfig,
  routes: readonly DocsRouteRecord[],
): void {
  const pageRoutes = routes.filter((route) => route.kind !== "endpoint");
  const actualFiles = listHtmlFiles(buildDir)
    .filter((path) => path !== "404.html")
    .toSorted();
  const expectedFiles = pageRoutes
    .map((route) => htmlPath(buildDir, route.path).slice(buildDir.length + 1))
    .toSorted();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    fail("built HTML routes do not match the route inventory");
  }

  for (const route of pageRoutes) validateBuiltRoute(buildDir, config, route);
  validateSitemap(buildDir, config, routes);
  validateRobots(buildDir, config);
  validateDiscoveryFiles(buildDir, config);
}

if (import.meta.main) {
  const mode = process.env["DOCS_BUILD_MODE"];
  const basePath = process.env["BASE_PATH"];
  const config = resolveDocsBuildConfig({
    ...(mode !== undefined && { mode }),
    ...(basePath !== undefined && { basePath }),
  });
  validateDocsBuildMetadata(
    join(import.meta.dir, "..", "apps", "docs", "build"),
    config,
    createDocsRouteInventory(),
  );
  console.log(`docs metadata is valid for ${config.mode}`);
}
