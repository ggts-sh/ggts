import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { DocsBuildConfig } from "../apps/docs/build-mode.ts";
import sveltePackage from "../packages/svelte/package.json";
import { validateDocsBuildMetadata } from "./check-docs-metadata.ts";
import type { DocsRouteRecord } from "./docs-route-inventory.ts";
import { OG_HOME_ALT, OG_HOME_HEIGHT, OG_HOME_PATH, OG_HOME_WIDTH } from "./docs-seo-image.ts";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const config: DocsBuildConfig = {
  mode: "cloudflare-production",
  base: "",
  canonicalBase: "https://ggts.sh",
  indexable: true,
  analytics: true,
  analyticsToken: "0123456789abcdef0123456789abcdef",
};
const route: DocsRouteRecord = {
  path: "/",
  title: "Home — ggts",
  description: "A distinct description.",
  canonicalPath: "/",
  kind: "page",
  index: true,
  sitemap: true,
  shell: "site",
};

function fixture(html: string): string {
  const root = mkdtempSync(join(tmpdir(), "ggsvelte-metadata-"));
  roots.push(root);
  writeFileSync(join(root, "index.html"), html);
  writeFileSync(
    join(root, "sitemap.xml"),
    '<?xml version="1.0"?><urlset><url><loc>https://ggts.sh/</loc></url></urlset>',
  );
  writeFileSync(
    join(root, "robots.txt"),
    "User-agent: *\nAllow: /\nSitemap: https://ggts.sh/sitemap.xml\n",
  );
  const facts = [
    `Package version: ${sveltePackage.version}`,
    "Defaults edition: 2",
    "Registered chart themes (33): default, light, dark, minimal, ggplot2, classic, bw, hrbr, few, clean, fivethirtyeight, economist, tufte, linedraw, void, stata, stata_s1color, solarized, solarizeddark, economist_white, solarized_2, solarized_2dark, wsj, hc, hcdark, pander, base, igray, map, solid, grey, gray, test",
    "[Docs](https://ggts.sh/docs)",
  ].join("\n");
  writeFileSync(join(root, "llms.txt"), facts);
  writeFileSync(join(root, "llms-full.txt"), facts);
  return root;
}

function socialHead(structured = true): string {
  const data = JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "ggts",
      url: "https://ggts.sh/",
      description: "A distinct description.",
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareSourceCode",
      name: "ggts",
      codeRepository: "https://github.com/ggts-sh/ggts",
      programmingLanguage: ["TypeScript", "Svelte"],
      license: "https://spdx.org/licenses/MIT.html",
      runtimePlatform: "Node.js 22 or newer",
      url: "https://ggts.sh/",
      version: sveltePackage.version,
    },
  ]);
  return [
    "<title>Home — ggts</title>",
    '<meta name="description" content="A distinct description."/>',
    '<link rel="canonical" href="https://ggts.sh/"/>',
    '<meta property="og:site_name" content="ggts"/>',
    '<meta property="og:type" content="website"/>',
    '<meta property="og:title" content="Home — ggts"/>',
    '<meta property="og:description" content="A distinct description."/>',
    '<meta property="og:url" content="https://ggts.sh/"/>',
    `<meta property="og:image" content="https://ggts.sh${OG_HOME_PATH}"/>`,
    `<meta property="og:image:width" content="${String(OG_HOME_WIDTH)}"/>`,
    `<meta property="og:image:height" content="${String(OG_HOME_HEIGHT)}"/>`,
    `<meta property="og:image:alt" content="${OG_HOME_ALT.replaceAll('"', "&quot;")}"/>`,
    '<meta name="twitter:card" content="summary_large_image"/>',
    '<meta name="twitter:title" content="Home — ggts"/>',
    '<meta name="twitter:description" content="A distinct description."/>',
    `<meta name="twitter:image" content="https://ggts.sh${OG_HOME_PATH}"/>`,
    `<meta name="twitter:image:alt" content="${OG_HOME_ALT.replaceAll('"', "&quot;")}"/>`,
    structured ? `<script type="application/ld+json">${data}</script>` : "",
  ].join("");
}

describe("built docs metadata", () => {
  it("accepts the adapter fallback outside the canonical route inventory", () => {
    const root = fixture(`<html><head>${socialHead()}</head><body></body></html>`);
    writeFileSync(
      join(root, "404.html"),
      '<html><head><meta name="robots" content="noindex,follow"></head></html>',
    );

    expect(() => {
      validateDocsBuildMetadata(root, config, [route]);
    }).not.toThrow();
  });

  it("preserves fenced source that names the legacy host without treating it as metadata", () => {
    const root = fixture(`<html><head>${socialHead()}</head><body></body></html>`);
    const llmsFull = readFileSync(join(root, "llms-full.txt"), "utf8");
    writeFileSync(
      join(root, "llms-full.txt"),
      `${llmsFull}\n\n\`\`\`ts\nconst docs = "https://ljodea.github.io/ggsvelte/guide/errors";\n\`\`\`\n`,
    );

    expect(() => {
      validateDocsBuildMetadata(root, config, [route]);
    }).not.toThrow();
  });

  it("rejects relative or wrong-origin links in generated LLM discovery files", () => {
    const root = fixture(`<html><head>${socialHead()}</head><body></body></html>`);
    writeFileSync(join(root, "llms.txt"), "[Docs](/docs)");

    expect(() => {
      validateDocsBuildMetadata(root, config, [route]);
    }).toThrow("llms.txt");
  });

  it("rejects a public home page that omits required structured data", () => {
    const root = fixture(`<html><head>${socialHead(false)}</head><body></body></html>`);

    expect(() => {
      validateDocsBuildMetadata(root, config, [route]);
    }).toThrow("structured data");
  });

  it("rejects a public page that omits social metadata", () => {
    const root = fixture(
      '<html><head><title>Home — ggts</title><meta name="description" content="A distinct description."/><link rel="canonical" href="https://ggts.sh/"/></head><body></body></html>',
    );

    expect(() => {
      validateDocsBuildMetadata(root, config, [route]);
    }).toThrow("social metadata");
  });
});
