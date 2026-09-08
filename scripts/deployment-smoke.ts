export interface SmokeExpectation {
  readonly name: string;
  readonly url: string;
  readonly status: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly redirectTo?: string;
  readonly bodyIncludes?: readonly string[];
}

export interface CutoverSmokeInput {
  readonly apexOrigin: string;
  readonly wwwOrigin: string;
  readonly productionPagesOrigin: string;
  readonly sourceCommit: string;
}

export interface SmokeResponse {
  readonly status: number;
  readonly headers: Headers;
  readonly body: string;
}

function origin(value: string): string {
  const parsed = new URL(value);
  if (
    parsed.protocol !== "https:" ||
    parsed.pathname !== "/" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    throw new Error(`Smoke origin must be an HTTPS origin without a path: ${value}`);
  }
  return parsed.origin;
}

const securityHeaders = {
  "content-security-policy": "frame-ancestors 'none'",
  "permissions-policy": "camera=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
} as const;

export function previewSmokePlan(baseUrl: string, sourceCommit: string): SmokeExpectation[] {
  const base = origin(baseUrl);
  const noindex = { "x-robots-tag": "noindex" } as const;
  return [
    { name: "preview home", url: `${base}/`, status: 200, headers: noindex, bodyIncludes: ["<h1"] },
    {
      name: "preview deep route",
      url: `${base}/guide/getting-started`,
      status: 200,
      headers: noindex,
      bodyIncludes: ["Getting started"],
    },
    { name: "preview schema", url: `${base}/schema/v0.json`, status: 200, headers: noindex },
    {
      name: "preview llms",
      url: `${base}/llms.txt`,
      status: 200,
      headers: noindex,
      bodyIncludes: ["# ggts"],
    },
    {
      name: "preview sitemap",
      url: `${base}/sitemap.xml`,
      status: 200,
      headers: noindex,
      bodyIncludes: ["https://ggts.sh/"],
    },
    {
      name: "preview robots",
      url: `${base}/robots.txt`,
      status: 200,
      headers: noindex,
      bodyIncludes: ["Disallow: /"],
    },
    {
      name: "preview unknown route",
      url: `${base}/__cutover-missing`,
      status: 404,
      headers: noindex,
    },
    {
      name: "preview artifact identity",
      url: `${base}/artifact.json`,
      status: 200,
      headers: noindex,
      bodyIncludes: [sourceCommit, '"buildMode": "cloudflare-preview"'],
    },
  ];
}

export function cutoverSmokePlan(input: CutoverSmokeInput): SmokeExpectation[] {
  const apex = origin(input.apexOrigin);
  const www = origin(input.wwwOrigin);
  const pages = origin(input.productionPagesOrigin);
  return [
    {
      name: "apex home",
      url: `${apex}/`,
      status: 200,
      headers: securityHeaders,
      bodyIncludes: ["<h1"],
    },
    {
      name: "apex deep route",
      url: `${apex}/guide/getting-started`,
      status: 200,
      headers: securityHeaders,
      bodyIncludes: ["Getting started"],
    },
    {
      name: "apex schema",
      url: `${apex}/schema/v0.json`,
      status: 200,
      headers: { "x-content-type-options": "nosniff" },
    },
    { name: "apex llms", url: `${apex}/llms.txt`, status: 200, bodyIncludes: ["# ggts"] },
    {
      name: "apex sitemap",
      url: `${apex}/sitemap.xml`,
      status: 200,
      bodyIncludes: [`<loc>${apex}/</loc>`],
    },
    {
      name: "apex robots",
      url: `${apex}/robots.txt`,
      status: 200,
      bodyIncludes: ["Allow: /", `Sitemap: ${apex}/sitemap.xml`],
    },
    {
      name: "apex unknown route",
      url: `${apex}/__cutover-missing`,
      status: 404,
      bodyIncludes: ["Not found"],
    },
    {
      name: "apex artifact identity",
      url: `${apex}/artifact.json`,
      status: 200,
      bodyIncludes: [input.sourceCommit, '"buildMode": "cloudflare-production"'],
    },
    {
      name: "www path and query redirect",
      url: `${www}/guide/getting-started?from=www`,
      status: 301,
      redirectTo: `${apex}/guide/getting-started?from=www`,
    },
    {
      name: "production pages.dev path and query redirect",
      url: `${pages}/guide/getting-started?from=pages`,
      status: 301,
      redirectTo: `${apex}/guide/getting-started?from=pages`,
    },
    {
      name: "old apex path and query redirect",
      url: "https://ggsvelte.sh/guide/getting-started?from=old-apex",
      status: 301,
      redirectTo: `${apex}/guide/getting-started?from=old-apex`,
    },
    {
      name: "old www path and query redirect",
      url: "https://www.ggsvelte.sh/schema/v0.json?from=old-www",
      status: 301,
      redirectTo: `${apex}/schema/v0.json?from=old-www`,
    },
    {
      name: "legacy-base cleanup redirect",
      url: `${apex}/ggsvelte/guide/getting-started?from=legacy-base`,
      status: 301,
      redirectTo: `${apex}/guide/getting-started?from=legacy-base`,
    },
  ];
}

export function evaluateSmokeResponse(expected: SmokeExpectation, actual: SmokeResponse): string[] {
  const problems: string[] = [];
  if (actual.status !== expected.status) {
    problems.push(
      `${expected.name}: expected HTTP ${String(expected.status)}, received ${String(actual.status)}`,
    );
  }
  for (const [name, value] of Object.entries(expected.headers ?? {})) {
    const actualValue = actual.headers.get(name);
    if (actualValue === null || !actualValue.toLowerCase().includes(value.toLowerCase())) {
      problems.push(
        `${expected.name}: expected ${name} to include ${JSON.stringify(value)}, received ${JSON.stringify(actualValue)}`,
      );
    }
  }
  if (expected.redirectTo !== undefined) {
    const location = actual.headers.get("location");
    let resolvedLocation: string | null = null;
    if (location !== null) {
      try {
        resolvedLocation = new URL(location, expected.url).href;
      } catch {
        resolvedLocation = null;
      }
    }
    if (resolvedLocation !== expected.redirectTo) {
      problems.push(
        `${expected.name}: expected redirect ${expected.redirectTo}, received ${location ?? "no Location header"}`,
      );
    }
  }
  for (const text of expected.bodyIncludes ?? []) {
    if (!actual.body.includes(text)) {
      problems.push(`${expected.name}: response body is missing ${JSON.stringify(text)}`);
    }
  }
  return problems;
}
