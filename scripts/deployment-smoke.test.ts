import { describe, expect, it } from "bun:test";

import { cutoverSmokePlan, evaluateSmokeResponse, previewSmokePlan } from "./deployment-smoke.ts";

describe("deployment HTTP smoke assertions", () => {
  it("accepts a response only when status, headers, redirect, and body identity agree", () => {
    expect(
      evaluateSmokeResponse(
        {
          name: "preview artifact",
          url: "https://abc.ggsvelte.pages.dev/artifact.json",
          status: 200,
          headers: { "x-robots-tag": "noindex" },
          bodyIncludes: ["0123456789abcdef"],
        },
        {
          status: 200,
          headers: new Headers({ "X-Robots-Tag": "noindex, nofollow" }),
          body: '{"sourceCommit":"0123456789abcdef"}',
        },
      ),
    ).toEqual([]);
  });

  it("accepts a same-origin relative Location with the expected absolute destination", () => {
    expect(
      evaluateSmokeResponse(
        {
          name: "legacy-base cleanup redirect",
          url: "https://ggts.sh/ggsvelte/guide/getting-started?from=legacy-base",
          status: 301,
          redirectTo: "https://ggts.sh/guide/getting-started?from=legacy-base",
        },
        {
          status: 301,
          headers: new Headers({
            Location: "/guide/getting-started?from=legacy-base",
          }),
          body: "",
        },
      ),
    ).toEqual([]);
  });

  it("covers immutable preview routes and blocks promotion without noindex", () => {
    const plan = previewSmokePlan(
      "https://feature-cloudflare.ggsvelte.pages.dev",
      "0123456789abcdef0123456789abcdef01234567",
    );

    expect(plan.map(({ name }) => name)).toEqual([
      "preview home",
      "preview deep route",
      "preview schema",
      "preview llms",
      "preview sitemap",
      "preview robots",
      "preview unknown route",
      "preview artifact identity",
    ]);
    for (const expectation of plan) {
      expect(expectation.headers?.["x-robots-tag"]).toBe("noindex");
    }
  });

  it("covers the apex, exact redirects, and /ggsvelte cleanup without GitHub Pages", () => {
    const plan = cutoverSmokePlan({
      apexOrigin: "https://ggts.sh",
      wwwOrigin: "https://www.ggts.sh",
      productionPagesOrigin: "https://ggsvelte.pages.dev",
      sourceCommit: "0123456789abcdef0123456789abcdef01234567",
    });

    expect(plan.map(({ name }) => name)).toEqual([
      "apex home",
      "apex deep route",
      "apex schema",
      "apex llms",
      "apex sitemap",
      "apex robots",
      "apex unknown route",
      "apex artifact identity",
      "www path and query redirect",
      "production pages.dev path and query redirect",
      "old apex path and query redirect",
      "old www path and query redirect",
      "legacy-base cleanup redirect",
    ]);
    expect(plan.find(({ name }) => name === "www path and query redirect")?.redirectTo).toBe(
      "https://ggts.sh/guide/getting-started?from=www",
    );
    expect(
      plan.find(({ name }) => name === "production pages.dev path and query redirect")?.redirectTo,
    ).toBe("https://ggts.sh/guide/getting-started?from=pages");
    expect(plan.find(({ name }) => name === "old apex path and query redirect")).toMatchObject({
      url: "https://ggsvelte.sh/guide/getting-started?from=old-apex",
      status: 301,
      redirectTo: "https://ggts.sh/guide/getting-started?from=old-apex",
    });
    expect(plan.find(({ name }) => name === "old www path and query redirect")).toMatchObject({
      url: "https://www.ggsvelte.sh/schema/v0.json?from=old-www",
      status: 301,
      redirectTo: "https://ggts.sh/schema/v0.json?from=old-www",
    });
    expect(plan.some(({ name }) => name.includes("legacy") && name.includes("benchmark"))).toBe(
      false,
    );
    expect(plan.some(({ url }) => url.includes("github.io"))).toBe(false);
  });
});
