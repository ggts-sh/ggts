import { describe, expect, it } from "bun:test";

import { DOCS_ROUTES } from "../apps/docs/src/lib/generated/routes.ts";
import lifecycle from "../lifecycle.json";
import { createDocsRouteInventory } from "./docs-route-inventory.ts";
import { GETTING_STARTED_MD, guidePages, type LifecycleDoc } from "./gen-llms.ts";
import {
  QUICKSTART_BUILDER_FRAGMENT,
  QUICKSTART_CLI_FRAGMENT,
  QUICKSTART_HEADLESS_FRAGMENT,
  QUICKSTART_PORTABLE_SPEC_FRAGMENT,
  SAKURA_STEPS,
} from "./quickstart.ts";

describe("progressive Docs journey", () => {
  it("lands the getting-started chapter as the grammar entry point", () => {
    expect(
      createDocsRouteInventory().find((route) => route.path === "/guide/getting-started"),
    ).toMatchObject({
      canonicalPath: "/guide/getting-started",
      shell: "docs",
      index: true,
      sitemap: true,
      navigation: { section: "Start", label: "Getting started", order: 1 },
    });
    const page = guidePages(lifecycle as unknown as LifecycleDoc).find(
      (entry) => entry.slug === "getting-started",
    );
    expect(page?.markdown).toContain("# Getting started");
    expect(page?.markdown).toContain("/reference/geoms");
  });

  it("publishes the consolidated interaction and production chapters", () => {
    const expected = [
      ["/guide/interactions", "Interaction", 20, "/examples/interaction/linked-views"],
      ["/guide/production", "Production", 30, "/reference/cli"],
    ] as const;
    const inventory = createDocsRouteInventory();
    const pages = guidePages(lifecycle as unknown as LifecycleDoc);
    for (const [path, section, order, evidence] of expected) {
      const route = inventory.find((entry) => entry.path === path);
      expect(route?.navigation).toMatchObject({ section, order });
      const page = pages.find((entry) => `/guide/${entry.slug}` === path);
      expect(page?.markdown).toContain(evidence);
    }
    const production = pages.find((entry) => entry.slug === "production");
    for (const needle of PRODUCTION_EVIDENCE) {
      expect(production?.markdown).toContain(needle);
    }
  });

  it("shares secondary surface fragments with the generated guide", () => {
    for (const fragment of [
      QUICKSTART_BUILDER_FRAGMENT,
      QUICKSTART_PORTABLE_SPEC_FRAGMENT,
      QUICKSTART_HEADLESS_FRAGMENT,
      QUICKSTART_CLI_FRAGMENT,
    ]) {
      expect(GETTING_STARTED_MD).toContain(fragment);
    }
  });

  it("derives getting-started headings from guide markdown, not the lesson fold", () => {
    const route = DOCS_ROUTES.find((entry) => entry.path === "/guide/getting-started");
    const headings = route?.headings ?? [];
    const ids = new Set(headings.map((h) => h.id as string));
    const titles = new Map(headings.map((h) => [h.id as string, h.title]));
    expect(titles.get("choose-your-surface")).toBe("Choose your surface");
    expect(titles.get("react")).toBe("React");
    expect(titles.get("svelte")).toBe("Svelte");
    expect(titles.get("a-complete-svelte-file")).toBe("A complete Svelte file");
    expect(titles.get("the-portablespec-contract")).toBe("The PortableSpec contract");
    // Progressive walkthrough step titles must not leak into the guide page.
    for (const step of SAKURA_STEPS) {
      expect(ids.has(step.id)).toBe(false);
    }
  });

  it("keeps progressive lesson step titles out of the published getting-started prose", () => {
    for (const step of SAKURA_STEPS) {
      expect(GETTING_STARTED_MD).not.toContain(`### ${step.title}`);
      if (step.outcome !== "") {
        expect(GETTING_STARTED_MD).not.toContain(step.outcome);
      }
    }
  });
});

const PRODUCTION_EVIDENCE = [
  "/guide/errors#quickstart-troubleshooting",
  "/examples/point/scatter-color",
  "/reference/cli",
  "support-matrix.json",
] as const;
