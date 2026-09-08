import sveltePackage from "../packages/svelte/package.json";

import { buildDocsCrumbs } from "./docs-breadcrumbs";
import { socialImageForRoute } from "./docs-seo-image";

const REPOSITORY_URL = "https://github.com/ggts-sh/ggts";

export interface SeoRoute {
  path: string;
  title: string;
  description: string;
  canonicalPath: string;
  shell: "site" | "docs";
  navigation?: { section: string; label: string };
  primaryNavigationOwner?: "reference";
}

export interface SeoImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

export interface SeoDocument {
  title: string;
  description: string;
  canonical: string;
  image: SeoImage;
  twitterCard: "summary_large_image";
  structuredData: object[];
}

function absoluteUrl(canonicalBase: string, path: string): string {
  return `${canonicalBase.replace(/\/$/, "")}${path}`;
}

export function serializeStructuredData(data: readonly object[]): string {
  return JSON.stringify(data)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

export function renderStructuredDataScript(data: readonly object[]): string {
  if (data.length === 0) return "";
  return `<script type="application/ld+json">${serializeStructuredData(data)}</script>`;
}

export function buildSeoDocument(route: SeoRoute, canonicalBase: string): SeoDocument {
  const canonical = absoluteUrl(canonicalBase, route.canonicalPath);
  const structuredData: object[] = [];
  if (route.path === "/") {
    structuredData.push(
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "ggts",
        url: canonical,
        description: route.description,
      },
      {
        "@context": "https://schema.org",
        "@type": "SoftwareSourceCode",
        name: "ggts",
        codeRepository: REPOSITORY_URL,
        programmingLanguage: ["TypeScript", "Svelte"],
        license: "https://spdx.org/licenses/MIT.html",
        runtimePlatform: "Node.js 22 or newer",
        url: canonical,
        version: sveltePackage.version,
      },
    );
  }
  if (route.shell === "docs") {
    const reference =
      route.primaryNavigationOwner === "reference" ||
      route.path.startsWith("/reference") ||
      route.navigation?.section === "Reference";
    const title = route.navigation?.label ?? route.title.replace(" — ggts", "");
    const crumbs = buildDocsCrumbs(route.path, title, reference);
    // Single-crumb pages (e.g. /reference alone) skip BreadcrumbList.
    if (crumbs.length > 1) {
      structuredData.push({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          // Last crumb has no href; use the page canonical. Intermediate crumbs always link.
          const path = crumb.href ?? (isLast ? route.canonicalPath : undefined);
          return {
            "@type": "ListItem",
            position: index + 1,
            name: crumb.label,
            ...(path === undefined ? {} : { item: absoluteUrl(canonicalBase, path) }),
          };
        }),
      });
    }
  }

  const social = socialImageForRoute(route);
  return {
    title: route.title,
    description: route.description,
    canonical,
    image: {
      url: absoluteUrl(canonicalBase, social.path),
      width: social.width,
      height: social.height,
      alt: social.alt,
    },
    twitterCard: "summary_large_image",
    structuredData,
  };
}
