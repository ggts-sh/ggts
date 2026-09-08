import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import sveltePackage from "../packages/svelte/package.json";
import { createDocsRouteInventory } from "./docs-route-inventory.ts";
import {
  OG_HOME_ALT,
  OG_HOME_FILENAME,
  OG_HOME_HEIGHT,
  OG_HOME_PATH,
  OG_HOME_WIDTH,
} from "./docs-seo-image.ts";
import {
  buildSeoDocument,
  renderStructuredDataScript,
  serializeStructuredData,
} from "./docs-seo.ts";

describe("generated docs SEO", () => {
  it("describes the canonical home page and repository with truthful structured data", () => {
    const home = createDocsRouteInventory().find((route) => route.path === "/")!;
    const seo = buildSeoDocument(home, "https://ggts.sh");

    expect(seo).toMatchObject({
      title: "ggts — grammar of graphics in TypeScript",
      description:
        "ggts is a fast agent-native implementation of the grammar of graphics in TypeScript.",
      canonical: "https://ggts.sh/",
      image: {
        url: `https://ggts.sh${OG_HOME_PATH}`,
        width: OG_HOME_WIDTH,
        height: OG_HOME_HEIGHT,
        alt: OG_HOME_ALT,
      },
      twitterCard: "summary_large_image",
    });
    const socialImage = readFileSync(
      join(import.meta.dir, "..", "apps", "docs", "static", "og", OG_HOME_FILENAME),
    );
    expect([socialImage.readUInt32BE(16), socialImage.readUInt32BE(20)]).toEqual([
      seo.image.width,
      seo.image.height,
    ]);
    expect(seo.structuredData).toEqual([
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "ggts",
        url: "https://ggts.sh/",
        description:
          "ggts is a fast agent-native implementation of the grammar of graphics in TypeScript.",
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
  });

  it("uses each gallery example's preview as its social card image", () => {
    const routes = createDocsRouteInventory();
    const tooltip = routes.find((route) => route.path === "/examples/interaction/tooltip")!;
    const seo = buildSeoDocument(tooltip, "https://ggts.sh");

    expect(seo.image.url).toBe("https://ggts.sh/previews/interaction-tooltip-light.png");
    expect(seo.image.alt).toBe("Inspect and pin data");
    // interaction/tooltip declares vrHeight: 740 in the example manifest.
    expect(seo.image.width).toBe(640);
    expect(seo.image.height).toBe(740);
  });

  it("resolves legacy example aliases to the canonical gallery preview", () => {
    const alias = createDocsRouteInventory().find(
      (route) => route.path === "/examples/interactions/inspection",
    )!;
    const seo = buildSeoDocument(alias, "https://ggts.sh");
    expect(alias.canonicalPath).toBe("/examples/interaction/tooltip");
    expect(seo.image.url).toBe("https://ggts.sh/previews/interaction-tooltip-light.png");
  });

  it("falls back to the home social card for non-example routes", () => {
    const docs = createDocsRouteInventory().find((route) => route.path === "/docs")!;
    const seo = buildSeoDocument(docs, "https://ggts.sh");
    expect(seo.image.url).toBe(`https://ggts.sh${OG_HOME_PATH}`);
    expect(seo.image.width).toBe(OG_HOME_WIDTH);
    expect(seo.image.height).toBe(OG_HOME_HEIGHT);
  });

  it("serializes structured data without allowing script termination", () => {
    const json = serializeStructuredData([{ name: "</script><script>alert(1)</script>" }]);

    expect(json).toBe('[{"name":"\\u003c/script>\\u003cscript>alert(1)\\u003c/script>"}]');
    expect(json).not.toContain("<script");
    expect(renderStructuredDataScript([{ name: "</script>" }])).toBe(
      '<script type="application/ld+json">[{"name":"\\u003c/script>"}]</script>',
    );
  });

  it("emits breadcrumbs only for routes that render the visible docs breadcrumb", () => {
    const routes = createDocsRouteInventory();
    const guide = routes.find((route) => route.path === "/guide/getting-started")!;
    const docs = routes.find((route) => route.path === "/docs")!;
    const gallery = routes.find((route) => route.path === "/examples")!;
    const scaleDetail = routes.find((route) => route.path === "/reference/scales/fill_distiller")!;
    const scaleIndex = routes.find((route) => route.path === "/reference/scales")!;

    expect(buildSeoDocument(guide, "https://ggts.sh").structuredData).toEqual([
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Docs",
            item: "https://ggts.sh/docs",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Getting started",
            item: "https://ggts.sh/guide/getting-started",
          },
        ],
      },
    ]);
    expect(buildSeoDocument(docs, "https://ggts.sh").structuredData).toEqual([]);
    expect(buildSeoDocument(gallery, "https://ggts.sh").structuredData).toEqual([]);

    // Scale detail: Reference / Scales / ScaleFillDistiller (middle section linked)
    expect(buildSeoDocument(scaleDetail, "https://ggts.sh").structuredData).toEqual([
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Reference",
            item: "https://ggts.sh/reference",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Scales",
            item: "https://ggts.sh/reference/scales",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: scaleDetail.navigation?.label ?? "ScaleFillDistiller",
            item: "https://ggts.sh/reference/scales/fill_distiller",
          },
        ],
      },
    ]);
    // Section index stays two-level (no duplicate "Scales" under itself).
    expect(buildSeoDocument(scaleIndex, "https://ggts.sh").structuredData).toEqual([
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Reference",
            item: "https://ggts.sh/reference",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Scales",
            item: "https://ggts.sh/reference/scales",
          },
        ],
      },
    ]);
  });
});
