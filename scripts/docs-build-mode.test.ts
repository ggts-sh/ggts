import { describe, expect, it } from "bun:test";

import { resolveDocsBuildConfig } from "../apps/docs/build-mode.ts";

describe("docs build modes", () => {
  it("keeps local development root-based and origin-safe", () => {
    expect(resolveDocsBuildConfig({})).toEqual({
      mode: "dev",
      base: "",
      canonicalBase: "https://ggts.sh",
      indexable: false,
      analytics: false,
      analyticsToken: null,
    });
  });

  it("resolves Cloudflare publication modes only", () => {
    expect(resolveDocsBuildConfig({ mode: "cloudflare-preview" })).toMatchObject({
      base: "",
      canonicalBase: "https://ggts.sh",
      indexable: false,
      analytics: false,
    });
    expect(
      resolveDocsBuildConfig({
        mode: "cloudflare-production",
        analyticsToken: "0123456789abcdef0123456789abcdef",
      }),
    ).toMatchObject({
      base: "",
      canonicalBase: "https://ggts.sh",
      indexable: true,
      analytics: true,
      analyticsToken: "0123456789abcdef0123456789abcdef",
    });
  });

  it("keeps analytics absent without an explicit production token", () => {
    expect(resolveDocsBuildConfig({ mode: "cloudflare-production" })).toMatchObject({
      analytics: false,
      analyticsToken: null,
    });
    expect(() =>
      resolveDocsBuildConfig({
        mode: "cloudflare-preview",
        analyticsToken: "0123456789abcdef0123456789abcdef",
      }),
    ).toThrow("Analytics token is allowed only for cloudflare-production");
  });

  it("fails unknown modes, legacy GitHub Pages modes, and base-path combinations", () => {
    for (const input of [
      { mode: "preview" },
      { mode: "cloudflare-production", basePath: "/ggsvelte" },
      { mode: "legacy-full", basePath: "/ggsvelte" },
      { mode: "legacy-migration", basePath: "/ggsvelte" },
      { basePath: "/ggsvelte" },
    ]) {
      expect(() => resolveDocsBuildConfig(input)).toThrow("Valid combinations");
    }
  });
});
