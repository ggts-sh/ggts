import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildDeploymentIdentity,
  deploymentBuildConfig,
  ensureNotFoundNoindex,
  ensurePreviewCleanupRedirects,
  ensurePreviewNoindexHeader,
  hasHtmlRevalidateCacheControl,
  validateDeploymentArtifact,
} from "./deployment-artifact.ts";

const REQUIRED_HEADERS = `/*
  Cache-Control: public, max-age=0, must-revalidate
  Content-Security-Policy: frame-ancestors 'none'
  Permissions-Policy: camera=(), geolocation=(), microphone=()
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY

/_app/immutable/*
  ! Cache-Control
  Cache-Control: public, max-age=31536000, immutable
`;

/** Production docs `_headers` after #1167 — edge s-maxage must still validate. */
const S_MAXAGE_HEADERS = `/*
  Cache-Control: public, max-age=0, s-maxage=600, must-revalidate
  Content-Security-Policy: frame-ancestors 'none'
  Permissions-Policy: camera=(), geolocation=(), microphone=()
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY

/_app/immutable/*
  ! Cache-Control
  Cache-Control: public, max-age=31536000, immutable

/theme-shells/*
  ! Cache-Control
  Cache-Control: public, max-age=0, s-maxage=86400, must-revalidate
`;

const PRODUCTION_REDIRECTS = `/ggsvelte https://ggts.sh/ 301
/ggsvelte/* https://ggts.sh/:splat 301
`;

const CSP_META = `<meta http-equiv="content-security-policy" content="default-src 'self'; base-uri 'self'; connect-src 'self' https://cloudflareinsights.com; font-src 'self'; form-action 'self'; frame-src 'none'; img-src 'self' data:; manifest-src 'self'; media-src 'self'; object-src 'none'; script-src 'self' https://static.cloudflareinsights.com; script-src-attr 'none'; style-src 'self'; style-src-attr 'unsafe-inline'; upgrade-insecure-requests">`;
const NOT_FOUND_CSP_META = `<meta http-equiv="content-security-policy" content="default-src 'self'; base-uri 'self'; form-action 'self'; frame-src 'none'; img-src 'self' data:; object-src 'none'; script-src 'none'; script-src-attr 'none'; style-src 'self'; style-src-attr 'none'; upgrade-insecure-requests">`;

const PREVIEW_REDIRECTS = `/ggsvelte / 301
/ggsvelte/* /:splat 301
`;

const SOURCE_COMMIT = "0123456789abcdef0123456789abcdef01234567";
const ROUTES = [
  {
    path: "/",
    canonicalPath: "/",
    kind: "page",
    index: true,
    sitemap: true,
  },
  {
    path: "/guide/getting-started",
    canonicalPath: "/guide/getting-started",
    kind: "page",
    index: true,
    sitemap: true,
  },
] as const;

const expectedArtifact = (buildMode: "cloudflare-preview" | "cloudflare-production") => ({
  buildMode,
  sourceCommit: SOURCE_COMMIT,
  routes: ROUTES,
});

function makeCompleteArtifact(buildMode: "cloudflare-preview" | "cloudflare-production") {
  const buildDirectory = mkdtempSync(join(tmpdir(), "ggsvelte-cloudflare-artifact-"));
  for (const [path, contents] of [
    ["index.html", `${CSP_META}<link rel="canonical" href="https://ggts.sh/">`],
    [
      "404.html",
      `${NOT_FOUND_CSP_META}<meta name="robots" content="noindex,follow"><main><h1>Not found</h1></main>`,
    ],
    [
      "_headers",
      buildMode === "cloudflare-preview"
        ? REQUIRED_HEADERS.replace("/*\n", "/*\n  X-Robots-Tag: noindex, nofollow\n")
        : REQUIRED_HEADERS,
    ],
    ["_redirects", buildMode === "cloudflare-preview" ? PREVIEW_REDIRECTS : PRODUCTION_REDIRECTS],
    ["robots.txt", "Sitemap: https://ggts.sh/sitemap.xml"],
    ["sitemap.xml", "<loc>https://ggts.sh/</loc>"],
    ["artifact.json", `${JSON.stringify(buildDeploymentIdentity(expectedArtifact(buildMode)))}\n`],
  ] as const) {
    writeFileSync(join(buildDirectory, path), contents);
  }
  return buildDirectory;
}

describe("deployment artifact identity", () => {
  it("passes the configured production analytics token into artifact validation", () => {
    expect(
      deploymentBuildConfig({
        DOCS_BUILD_MODE: "cloudflare-production",
        DOCS_ANALYTICS_TOKEN: "0123456789abcdef0123456789abcdef",
      }),
    ).toMatchObject({
      mode: "cloudflare-production",
      analytics: true,
      analyticsToken: "0123456789abcdef0123456789abcdef",
    });
  });

  it("binds a Cloudflare artifact to its source commit, route inventory, and build mode", () => {
    expect(buildDeploymentIdentity(expectedArtifact("cloudflare-production"))).toEqual({
      schemaVersion: 1,
      sourceCommit: SOURCE_COMMIT,
      routeInventorySha256: "551f91a657675079d79b86099a7e1cd00bd773952b44c4565ae3154084fe56bc",
      buildMode: "cloudflare-production",
    });
  });

  it("accepts a complete reproducible Cloudflare artifact", () => {
    const buildDirectory = makeCompleteArtifact("cloudflare-production");
    try {
      expect(
        validateDeploymentArtifact(buildDirectory, expectedArtifact("cloudflare-production")),
      ).toEqual([]);
    } finally {
      rmSync(buildDirectory, { recursive: true, force: true });
    }
  });

  it("rejects mutable benchmark history in the Cloudflare artifact", () => {
    const buildDirectory = makeCompleteArtifact("cloudflare-production");
    try {
      mkdirSync(join(buildDirectory, "bench"));
      writeFileSync(join(buildDirectory, "bench", "index.html"), "mutable history");
      expect(
        validateDeploymentArtifact(buildDirectory, expectedArtifact("cloudflare-production")),
      ).toContain(
        "Cloudflare artifact must not contain mutable benchmark history: bench/index.html",
      );
    } finally {
      rmSync(buildDirectory, { recursive: true, force: true });
    }
  });

  it("rejects an incomplete Cloudflare artifact before deployment", () => {
    const buildDirectory = mkdtempSync(join(tmpdir(), "ggsvelte-cloudflare-artifact-"));
    try {
      expect(
        validateDeploymentArtifact(buildDirectory, expectedArtifact("cloudflare-production")),
      ).toEqual([
        "missing required deployment file: index.html",
        "missing required deployment file: 404.html",
        "missing required deployment file: _headers",
        "missing required deployment file: _redirects",
        "missing required deployment file: robots.txt",
        "missing required deployment file: sitemap.xml",
        "missing required deployment file: artifact.json",
      ]);
    } finally {
      rmSync(buildDirectory, { recursive: true, force: true });
    }
  });

  it("makes the unknown-route fallback index-safe and useful without JavaScript", () => {
    const buildDirectory = mkdtempSync(join(tmpdir(), "ggsvelte-cloudflare-not-found-"));
    try {
      writeFileSync(
        join(buildDirectory, "404.html"),
        '<html><head></head><body><div style="display: contents"><script>start()</script></div></body></html>',
      );
      ensureNotFoundNoindex(buildDirectory);
      const html = readFileSync(join(buildDirectory, "404.html"), "utf8");
      expect(html).toContain('<meta name="robots" content="noindex,follow" />');
      expect(html).toContain("<main><h1>Not found</h1>");
      expect(html).toContain('<a href="/">Go to the ggts documentation</a>');
      expect(html).not.toContain("<script");
    } finally {
      rmSync(buildDirectory, { recursive: true, force: true });
    }
  });

  it("injects a broad noindex header only into preview artifacts", () => {
    const preview = mkdtempSync(join(tmpdir(), "ggsvelte-cloudflare-preview-"));
    const production = mkdtempSync(join(tmpdir(), "ggsvelte-cloudflare-production-"));
    try {
      writeFileSync(join(preview, "_headers"), REQUIRED_HEADERS);
      writeFileSync(join(production, "_headers"), REQUIRED_HEADERS);
      ensurePreviewNoindexHeader(preview, "cloudflare-preview");
      ensurePreviewNoindexHeader(production, "cloudflare-production");
      expect(readFileSync(join(preview, "_headers"), "utf8")).toContain(
        "X-Robots-Tag: noindex, nofollow",
      );
      expect(readFileSync(join(production, "_headers"), "utf8")).not.toContain("X-Robots-Tag");
    } finally {
      rmSync(preview, { recursive: true, force: true });
      rmSync(production, { recursive: true, force: true });
    }
  });

  it("rewrites absolute /ggsvelte cleanup redirects to same-origin only for preview", () => {
    const preview = mkdtempSync(join(tmpdir(), "ggsvelte-preview-redirects-"));
    const production = mkdtempSync(join(tmpdir(), "ggsvelte-production-redirects-"));
    try {
      writeFileSync(join(preview, "_redirects"), PRODUCTION_REDIRECTS);
      writeFileSync(join(production, "_redirects"), PRODUCTION_REDIRECTS);
      ensurePreviewCleanupRedirects(preview, "cloudflare-preview");
      ensurePreviewCleanupRedirects(production, "cloudflare-production");
      expect(readFileSync(join(preview, "_redirects"), "utf8")).toBe(PREVIEW_REDIRECTS);
      expect(readFileSync(join(production, "_redirects"), "utf8")).toBe(PRODUCTION_REDIRECTS);
    } finally {
      rmSync(preview, { recursive: true, force: true });
      rmSync(production, { recursive: true, force: true });
    }
  });

  it("rejects preview artifacts that send /ggsvelte cleanup traffic to production", () => {
    const buildDirectory = makeCompleteArtifact("cloudflare-preview");
    try {
      writeFileSync(join(buildDirectory, "_redirects"), PRODUCTION_REDIRECTS);
      const problems = validateDeploymentArtifact(
        buildDirectory,
        expectedArtifact("cloudflare-preview"),
      );
      expect(problems).toContain(
        "preview _redirects must not send /ggsvelte cleanup traffic to production",
      );
    } finally {
      rmSync(buildDirectory, { recursive: true, force: true });
    }
  });

  it("requires same-origin /ggsvelte cleanup redirects on preview artifacts", () => {
    const buildDirectory = makeCompleteArtifact("cloudflare-preview");
    try {
      writeFileSync(join(buildDirectory, "_redirects"), "");
      expect(
        validateDeploymentArtifact(buildDirectory, expectedArtifact("cloudflare-preview")),
      ).toContain("_redirects is missing the same-origin /ggsvelte cleanup redirect");
    } finally {
      rmSync(buildDirectory, { recursive: true, force: true });
    }
  });

  it("requires the exact bare /ggsvelte same-origin cleanup on preview, not only the wildcard", () => {
    const buildDirectory = makeCompleteArtifact("cloudflare-preview");
    try {
      writeFileSync(join(buildDirectory, "_redirects"), `/ggsvelte/* /:splat 301\n`);
      expect(
        validateDeploymentArtifact(buildDirectory, expectedArtifact("cloudflare-preview")),
      ).toContain("_redirects is missing the same-origin /ggsvelte cleanup redirect");
    } finally {
      rmSync(buildDirectory, { recursive: true, force: true });
    }
  });

  it("requires the exact bare /ggsvelte absolute cleanup on production, not only the wildcard", () => {
    const buildDirectory = makeCompleteArtifact("cloudflare-production");
    try {
      writeFileSync(join(buildDirectory, "_redirects"), `/ggsvelte/* https://ggts.sh/:splat 301\n`);
      expect(
        validateDeploymentArtifact(buildDirectory, expectedArtifact("cloudflare-production")),
      ).toContain("_redirects is missing the absolute /ggsvelte cleanup redirect");
    } finally {
      rmSync(buildDirectory, { recursive: true, force: true });
    }
  });

  it("requires a line-anchored bare /ggsvelte production cleanup, not a substring match", () => {
    const buildDirectory = makeCompleteArtifact("cloudflare-production");
    try {
      writeFileSync(
        join(buildDirectory, "_redirects"),
        `/old/ggsvelte https://ggts.sh/ 301
/ggsvelte/* https://ggts.sh/:splat 301
`,
      );
      expect(
        validateDeploymentArtifact(buildDirectory, expectedArtifact("cloudflare-production")),
      ).toContain("_redirects is missing the absolute /ggsvelte cleanup redirect");
    } finally {
      rmSync(buildDirectory, { recursive: true, force: true });
    }
  });

  it("rejects preview artifacts without a broad noindex header", () => {
    const buildDirectory = makeCompleteArtifact("cloudflare-preview");
    try {
      writeFileSync(join(buildDirectory, "_headers"), REQUIRED_HEADERS);
      expect(
        validateDeploymentArtifact(buildDirectory, expectedArtifact("cloudflare-preview")),
      ).toContain("preview _headers must apply X-Robots-Tag: noindex to every route");
    } finally {
      rmSync(buildDirectory, { recursive: true, force: true });
    }
  });

  it("requires the unknown-route fallback to remain noindex", () => {
    const buildDirectory = makeCompleteArtifact("cloudflare-production");
    try {
      writeFileSync(join(buildDirectory, "404.html"), "Not found");
      expect(
        validateDeploymentArtifact(buildDirectory, expectedArtifact("cloudflare-production")),
      ).toContain("404.html must contain a noindex robots policy");
    } finally {
      rmSync(buildDirectory, { recursive: true, force: true });
    }
  });

  it("rejects an unknown-route fallback with no no-JavaScript message", () => {
    const buildDirectory = makeCompleteArtifact("cloudflare-production");
    try {
      writeFileSync(
        join(buildDirectory, "404.html"),
        '<meta name="robots" content="noindex,follow">',
      );
      expect(
        validateDeploymentArtifact(buildDirectory, expectedArtifact("cloudflare-production")),
      ).toContain("404.html must render Not found without JavaScript");
    } finally {
      rmSync(buildDirectory, { recursive: true, force: true });
    }
  });

  it("rejects a scripted unknown-route fallback", () => {
    const buildDirectory = makeCompleteArtifact("cloudflare-production");
    try {
      writeFileSync(
        join(buildDirectory, "404.html"),
        '<meta name="robots" content="noindex,follow"><main><h1>Not found</h1></main><script>start()</script>',
      );
      expect(
        validateDeploymentArtifact(buildDirectory, expectedArtifact("cloudflare-production")),
      ).toContain("404.html must remain useful without client scripts");
    } finally {
      rmSync(buildDirectory, { recursive: true, force: true });
    }
  });

  it("rejects missing security, cache, and fixed-destination redirect policies", () => {
    const buildDirectory = makeCompleteArtifact("cloudflare-production");
    try {
      writeFileSync(join(buildDirectory, "_headers"), "/*\n  Cache-Control: no-store\n");
      writeFileSync(join(buildDirectory, "_redirects"), "/bench /somewhere 301\n");
      const problems = validateDeploymentArtifact(
        buildDirectory,
        expectedArtifact("cloudflare-production"),
      );
      expect(problems).toContain(
        "_headers is missing required security policy: X-Content-Type-Options: nosniff",
      );
      expect(problems).toContain("_headers must revalidate public HTML and metadata");
      expect(problems).toContain(
        "_headers must cache only SvelteKit immutable assets for one year",
      );
      expect(problems).toContain(
        "_redirects must not preserve /bench GitHub Pages history redirects",
      );
      expect(problems).toContain("_redirects is missing the absolute /ggsvelte cleanup redirect");
    } finally {
      rmSync(buildDirectory, { recursive: true, force: true });
    }
  });

  it("rejects GitHub Pages destinations in _redirects", () => {
    const buildDirectory = makeCompleteArtifact("cloudflare-production");
    try {
      writeFileSync(
        join(buildDirectory, "_redirects"),
        `/bench/* https://ljodea.github.io/ggsvelte/bench/:splat 302
/ggsvelte https://ggts.sh/ 301
/ggsvelte/* https://ggts.sh/:splat 301
`,
      );
      const problems = validateDeploymentArtifact(
        buildDirectory,
        expectedArtifact("cloudflare-production"),
      );
      expect(problems).toContain("_redirects must not send traffic to GitHub Pages");
      expect(problems).toContain(
        "_redirects must not preserve /bench GitHub Pages history redirects",
      );
    } finally {
      rmSync(buildDirectory, { recursive: true, force: true });
    }
  });

  it("rejects unsupported domain-level sources in Pages _redirects", () => {
    const buildDirectory = makeCompleteArtifact("cloudflare-production");
    try {
      writeFileSync(
        join(buildDirectory, "_redirects"),
        `https://ggsvelte.pages.dev/* https://ggts.sh/:splat 301\n${PRODUCTION_REDIRECTS}`,
      );
      expect(
        validateDeploymentArtifact(buildDirectory, expectedArtifact("cloudflare-production")),
      ).toContain("_redirects must not contain unsupported domain-level source URLs");
    } finally {
      rmSync(buildDirectory, { recursive: true, force: true });
    }
  });

  it("requires immutable assets to detach the inherited HTML cache policy", () => {
    const buildDirectory = makeCompleteArtifact("cloudflare-production");
    try {
      writeFileSync(
        join(buildDirectory, "_headers"),
        REQUIRED_HEADERS.replace("  ! Cache-Control\n", ""),
      );
      expect(
        validateDeploymentArtifact(buildDirectory, expectedArtifact("cloudflare-production")),
      ).toContain("_headers must detach the inherited HTML cache policy from immutable assets");
    } finally {
      rmSync(buildDirectory, { recursive: true, force: true });
    }
  });

  it("accepts HTML Cache-Control with optional edge s-maxage", () => {
    expect(hasHtmlRevalidateCacheControl(REQUIRED_HEADERS)).toBe(true);
    expect(hasHtmlRevalidateCacheControl(S_MAXAGE_HEADERS)).toBe(true);
    expect(
      hasHtmlRevalidateCacheControl("/*\n  Cache-Control: public, max-age=3600, must-revalidate\n"),
    ).toBe(false);

    const buildDirectory = makeCompleteArtifact("cloudflare-production");
    try {
      writeFileSync(join(buildDirectory, "_headers"), S_MAXAGE_HEADERS);
      expect(
        validateDeploymentArtifact(buildDirectory, expectedArtifact("cloudflare-production")),
      ).toEqual([]);
    } finally {
      rmSync(buildDirectory, { recursive: true, force: true });
    }
  });

  it("rejects legacy canonical and project-base leakage from root builds", () => {
    const buildDirectory = makeCompleteArtifact("cloudflare-production");
    try {
      writeFileSync(
        join(buildDirectory, "index.html"),
        '<link rel="canonical" href="https://ljodea.github.io/ggsvelte/"><a href="/ggsvelte/docs">Docs</a>',
      );
      const problems = validateDeploymentArtifact(
        buildDirectory,
        expectedArtifact("cloudflare-production"),
      );
      expect(problems).toContain("index.html leaks the legacy documentation origin");
      expect(problems).toContain("index.html contains a /ggsvelte project-base URL");
    } finally {
      rmSync(buildDirectory, { recursive: true, force: true });
    }
  });

  it("requires the standard beacon only for explicitly configured production builds", () => {
    const production = makeCompleteArtifact("cloudflare-production");
    const preview = makeCompleteArtifact("cloudflare-preview");
    try {
      expect(
        validateDeploymentArtifact(production, {
          ...expectedArtifact("cloudflare-production"),
          analyticsToken: "0123456789abcdef0123456789abcdef",
        }),
      ).toContain("production artifact is missing the configured Cloudflare Web Analytics beacon");
      writeFileSync(
        join(preview, "index.html"),
        '<script src="https://static.cloudflareinsights.com/beacon.min.js"></script>',
      );
      expect(validateDeploymentArtifact(preview, expectedArtifact("cloudflare-preview"))).toContain(
        "preview artifact must not contain the Cloudflare Web Analytics beacon",
      );
    } finally {
      rmSync(production, { recursive: true, force: true });
      rmSync(preview, { recursive: true, force: true });
    }
  });

  it("rejects artifact identity that does not match the deployed source", () => {
    const buildDirectory = makeCompleteArtifact("cloudflare-preview");
    try {
      expect(
        validateDeploymentArtifact(buildDirectory, expectedArtifact("cloudflare-production")),
      ).toContain("artifact.json does not match the expected source, routes, and build mode");
    } finally {
      rmSync(buildDirectory, { recursive: true, force: true });
    }
  });
});
