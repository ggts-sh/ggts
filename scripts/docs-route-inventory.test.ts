import { describe, expect, it } from "bun:test";

import { CLI_REFERENCE_OPTIONS } from "./cli-docs.ts";
import {
  createDocsRouteInventory,
  routeCanonicalUrl,
  validateRouteInventory,
  type DocsRouteRecord,
} from "./docs-route-inventory.ts";

const route = (overrides: Partial<DocsRouteRecord> = {}): DocsRouteRecord => ({
  path: "/guide/start",
  title: "Start",
  description: "A complete route description.",
  canonicalPath: "/guide/start",
  kind: "page",
  index: true,
  sitemap: true,
  shell: "docs",
  ...overrides,
});

describe("docs route inventory", () => {
  it("projects every current domain into one validated concrete route list", () => {
    const inventory = createDocsRouteInventory();
    const paths = new Set(inventory.map((entry) => entry.path));

    expect(paths.has("/")).toBe(true);
    expect(paths.has("/docs")).toBe(true);
    expect(paths.has("/guide/getting-started")).toBe(true);
    expect(paths.has("/reference")).toBe(true);
    expect(paths.has("/examples")).toBe(true);
    expect(paths.has("/examples/point/scatter-color")).toBe(true);
    expect(paths.has("/examples/interactions/inspection")).toBe(true);
    expect(paths.has("/playground")).toBe(false);
    expect(paths.has("/themes")).toBe(true);
    expect(paths.has("/palettes")).toBe(true);
    expect(paths.has("/reference/geoms")).toBe(true);
    expect(paths.has("/reference/geoms/point")).toBe(true);
    expect(paths.has("/reference/geoms/bin_2d")).toBe(true);
    expect(paths.has("/reference/stats")).toBe(true);
    expect(paths.has("/reference/stats/count")).toBe(true);
    expect(paths.has("/reference/positions")).toBe(true);
    expect(paths.has("/reference/positions/stack")).toBe(true);
    expect(paths.has("/reference/scales")).toBe(true);
    expect(paths.has("/reference/scales/color_continuous")).toBe(true);
    expect(paths.has("/reference/scales/x_continuous")).toBe(true);
    expect(paths.has("/reference/guides")).toBe(true);
    expect(paths.has("/reference/guides/legend")).toBe(true);
    expect(paths.has("/reference/labs")).toBe(true);
    expect(paths.has("/reference/axes")).toBe(true);
    expect(paths.has("/reference/labels")).toBe(true);
    expect(paths.has("/reference/interactions")).toBe(true);
    expect(paths.has("/reference/themes")).toBe(true);
    expect(paths.has("/reference/palettes")).toBe(true);
    expect(paths.has("/reference/cli")).toBe(true);
    expect(paths.has("/__perf/r3-interaction")).toBe(true);
    expect(paths.has("/sitemap.xml")).toBe(true);
    expect(paths.has("/robots.txt")).toBe(true);

    expect(validateRouteInventory(inventory)).toBe(inventory);
    expect(JSON.parse(JSON.stringify(inventory))).toEqual(inventory);
  });

  it("publishes task-first Docs and one Reference landing with canonical metadata", () => {
    const inventory = createDocsRouteInventory();
    expect(inventory.find((entry) => entry.path === "/docs")).toMatchObject({
      title: "Documentation — ggts",
      canonicalPath: "/docs",
      kind: "page",
      index: true,
      sitemap: true,
      shell: "docs",
      navigation: { section: "Start", label: "Overview", order: 0 },
    });
    expect(inventory.find((entry) => entry.path === "/reference")).toMatchObject({
      title: "Reference — ggts",
      canonicalPath: "/reference",
      kind: "page",
      index: true,
      sitemap: true,
      shell: "docs",
      navigation: { section: "Reference", label: "Reference overview", order: 50 },
    });
  });

  it("keeps every navigation target concrete and gives global Reference active ownership", () => {
    const inventory = createDocsRouteInventory();
    const byPath = new Map(inventory.map((entry) => [entry.path, entry]));
    const navigation = inventory.filter((entry) => entry.navigation !== undefined);

    for (const entry of navigation) expect(byPath.has(entry.path), entry.path).toBe(true);
    expect(byPath.get("/guide/errors")?.navigation?.section).toBe("Reference");
    expect(byPath.get("/guide/interaction-reference")?.navigation).toBeUndefined();
    expect(byPath.has("/guide")).toBe(false);
  });

  it("publishes the geom reference inside the one Reference hierarchy", () => {
    const inventory = createDocsRouteInventory();
    const index = inventory.find((entry) => entry.path === "/reference/geoms");
    expect(index).toMatchObject({
      title: "Geoms — ggts",
      canonicalPath: "/reference/geoms",
      kind: "page",
      index: true,
      sitemap: true,
      shell: "docs",
      navigation: { section: "Reference", label: "Geoms", order: 51 },
    });
    const details = inventory.filter((entry) => entry.path.startsWith("/reference/geoms/"));
    expect(details.length).toBe(49);
    expect(details.every((entry) => entry.navigation === undefined)).toBe(true);
    expect(inventory.find((entry) => entry.path === "/reference/geoms/point")?.title).toBe(
      "GeomPoint — ggts",
    );
  });

  it("publishes the stat reference inside the one Reference hierarchy", () => {
    const inventory = createDocsRouteInventory();
    const index = inventory.find((entry) => entry.path === "/reference/stats");
    expect(index).toMatchObject({
      title: "Stats — ggts",
      canonicalPath: "/reference/stats",
      kind: "page",
      index: true,
      sitemap: true,
      shell: "docs",
      navigation: { section: "Reference", label: "Stats", order: 52 },
    });
    const details = inventory.filter((entry) => entry.path.startsWith("/reference/stats/"));
    expect(details.length).toBe(29);
    expect(details.every((entry) => entry.navigation === undefined)).toBe(true);
    expect(inventory.find((entry) => entry.path === "/reference/stats/count")?.title).toBe(
      "stat count — ggts",
    );
  });

  it("publishes the position reference inside the one Reference hierarchy", () => {
    const inventory = createDocsRouteInventory();
    const index = inventory.find((entry) => entry.path === "/reference/positions");
    expect(index).toMatchObject({
      title: "Positions — ggts",
      canonicalPath: "/reference/positions",
      kind: "page",
      index: true,
      sitemap: true,
      shell: "docs",
      navigation: { section: "Reference", label: "Positions", order: 53 },
    });
    const details = inventory.filter((entry) => entry.path.startsWith("/reference/positions/"));
    expect(details.length).toBe(6);
    expect(details.every((entry) => entry.navigation === undefined)).toBe(true);
    expect(inventory.find((entry) => entry.path === "/reference/positions/stack")?.title).toBe(
      "position stack — ggts",
    );
  });

  it("publishes the scale reference inside the one Reference hierarchy", () => {
    const inventory = createDocsRouteInventory();
    const index = inventory.find((entry) => entry.path === "/reference/scales");
    expect(index).toMatchObject({
      title: "Scales — ggts",
      canonicalPath: "/reference/scales",
      kind: "page",
      index: true,
      sitemap: true,
      shell: "docs",
      navigation: { section: "Reference", label: "Scales", order: 54 },
    });
    const details = inventory.filter((entry) => entry.path.startsWith("/reference/scales/"));
    expect(details.length).toBe(128);
    expect(details.every((entry) => entry.navigation === undefined)).toBe(true);
    expect(
      inventory.find((entry) => entry.path === "/reference/scales/color_continuous")?.title,
    ).toBe("ScaleColorContinuous — ggts");
  });

  it("publishes the coords reference inside the one Reference hierarchy", () => {
    const inventory = createDocsRouteInventory();
    const index = inventory.find((entry) => entry.path === "/reference/coords");
    expect(index).toMatchObject({
      title: "Coords — ggts",
      canonicalPath: "/reference/coords",
      kind: "page",
      index: true,
      sitemap: true,
      shell: "docs",
      navigation: { section: "Reference", label: "Coords", order: 55 },
    });
    const details = inventory.filter((entry) => entry.path.startsWith("/reference/coords/"));
    expect(details.length).toBe(6);
    expect(details.every((entry) => entry.navigation === undefined)).toBe(true);
    expect(inventory.find((entry) => entry.path === "/reference/coords/flip")?.title).toBe(
      "CoordFlip — ggts",
    );
    expect(inventory.find((entry) => entry.path === "/reference/coords/transform")?.title).toBe(
      "CoordTransform — ggts",
    );
    expect(inventory.find((entry) => entry.path === "/reference/coords/radial")?.title).toBe(
      "CoordRadial — ggts",
    );
  });

  it("publishes the guides reference inside the one Reference hierarchy", () => {
    const inventory = createDocsRouteInventory();
    const index = inventory.find((entry) => entry.path === "/reference/guides");
    expect(index).toMatchObject({
      title: "Guides and legends — ggts",
      canonicalPath: "/reference/guides",
      kind: "page",
      index: true,
      sitemap: true,
      shell: "docs",
      navigation: { section: "Reference", label: "Guides and legends", order: 56 },
    });
    const details = inventory.filter((entry) => entry.path.startsWith("/reference/guides/"));
    expect(details.length).toBe(5);
    expect(details.every((entry) => entry.navigation === undefined)).toBe(true);
    expect(inventory.find((entry) => entry.path === "/reference/guides/legend")?.title).toBe(
      "GuideLegend — ggts",
    );
    expect(inventory.find((entry) => entry.path === "/reference/guides/colorbar")?.title).toBe(
      "GuideColorbar — ggts",
    );
  });

  it("pins detail-route headings: aliases, related-examples, and family differences", () => {
    const inventory = createDocsRouteInventory();
    const ids = (path: string) =>
      inventory.find((entry) => entry.path === path)?.headings?.map((h) => h.id) ?? [];

    // Alias geoms insert an "alias" section between defaults and the shared body.
    expect(ids("/reference/geoms/histogram")).toEqual([
      "defaults",
      "alias",
      "svelte",
      "json",
      "params",
      "allowed-stats",
      "allowed-positions",
      "examples",
    ]);
    // Related-examples matchers differ by family: geom tags/category, stat-
    // prefixed tags, position id/tag includes. Pin both sides of each gate.
    expect(ids("/reference/geoms/point")).toContain("examples");
    // linerange has linerange/stems; qq_line has qq_line/match.
    expect(ids("/reference/geoms/linerange")).toContain("examples");
    expect(ids("/reference/geoms/qq_line")).toContain("examples");
    expect(ids("/reference/stats/identity")).toContain("examples");
    expect(ids("/reference/stats/bin_hex")).not.toContain("examples");
    expect(ids("/reference/positions/identity")).toContain("examples");
    expect(ids("/reference/positions/nudge")).not.toContain("examples");
    // Guides: legend alone adds the legend-focus cross-link section.
    expect(ids("/reference/guides/legend")).toEqual([
      "channels",
      "svelte",
      "json",
      "props",
      "legend-focus",
    ]);
    expect(ids("/reference/guides/none")).toEqual(["channels", "svelte", "json", "props"]);
    expect(ids("/reference/scales/color_continuous")).toContain("examples");
    expect(ids("/reference/scales/color_continuous")).toContain("guide");
    expect(ids("/reference/scales/colour_continuous")).toContain("alias");
  });

  it("publishes Labs, axes, and labels reference inside the one Reference hierarchy", () => {
    const inventory = createDocsRouteInventory();
    expect(inventory.find((entry) => entry.path === "/reference/labs")).toMatchObject({
      title: "Labs — ggts",
      canonicalPath: "/reference/labs",
      kind: "page",
      index: true,
      sitemap: true,
      shell: "docs",
      navigation: { section: "Reference", label: "Labs", order: 57 },
    });
    expect(inventory.find((entry) => entry.path === "/reference/axes")).toMatchObject({
      title: "Axes and ticks — ggts",
      canonicalPath: "/reference/axes",
      navigation: { section: "Reference", label: "Axes and ticks", order: 58 },
    });
    expect(inventory.find((entry) => entry.path === "/reference/labels")).toMatchObject({
      title: "Labels — ggts",
      canonicalPath: "/reference/labels",
      navigation: { section: "Reference", label: "Labels", order: 59 },
    });
    expect(
      inventory.find((entry) => entry.path === "/reference/axes")?.headings?.map((h) => h.id),
    ).toContain("scale-breaks-labels");
  });

  it("publishes themes and palettes reference inside the one Reference hierarchy", () => {
    const inventory = createDocsRouteInventory();
    expect(inventory.find((entry) => entry.path === "/reference/themes")).toMatchObject({
      title: "Themes — ggts",
      canonicalPath: "/reference/themes",
      kind: "page",
      index: true,
      sitemap: true,
      shell: "docs",
      navigation: { section: "Reference", label: "Themes", order: 61 },
    });
    expect(inventory.find((entry) => entry.path === "/reference/palettes")).toMatchObject({
      title: "Palettes — ggts",
      canonicalPath: "/reference/palettes",
      kind: "page",
      index: true,
      sitemap: true,
      shell: "docs",
      navigation: { section: "Reference", label: "Palettes", order: 62 },
    });
  });

  it("publishes the CLI reference inside the one Reference hierarchy", () => {
    const cliRoute = createDocsRouteInventory().find((entry) => entry.path === "/reference/cli");
    expect(cliRoute).toMatchObject({
      title: "Command-line reference — ggts",
      canonicalPath: "/reference/cli",
      kind: "page",
      index: true,
      sitemap: true,
      shell: "docs",
      navigation: { section: "Reference", label: "CLI reference", order: 63 },
    });
    expect(cliRoute?.headings?.filter((heading) => heading.level === 3)).toEqual(
      CLI_REFERENCE_OPTIONS.map((option) => ({
        id: option.anchor,
        title: option.flag,
        level: 3,
      })),
    );
  });

  it("publishes the themes destination with canonical acquisition metadata", () => {
    expect(createDocsRouteInventory().find((entry) => entry.path === "/themes")).toEqual({
      path: "/themes",
      title: "Chart themes — ggts",
      description: "Built-in chart themes for paper, grids, axes, and type.",
      canonicalPath: "/themes",
      kind: "page",
      index: true,
      sitemap: true,
      shell: "site",
    });
  });

  it("publishes the palettes destination with canonical acquisition metadata", () => {
    expect(createDocsRouteInventory().find((entry) => entry.path === "/palettes")).toEqual({
      path: "/palettes",
      title: "Color palettes — ggts",
      description:
        "Categorical palettes for discrete series: browse, compare, and preview every scheme.",
      canonicalPath: "/palettes",
      kind: "page",
      index: true,
      sitemap: true,
      shell: "site",
    });
  });

  it("publishes the sequential ramps destination alongside /palettes", () => {
    expect(createDocsRouteInventory().find((entry) => entry.path === "/palettes/ramps")).toEqual({
      path: "/palettes/ramps",
      title: "Sequential color ramps — ggts",
      description:
        "Sequential color ramps for continuous fill, and how reverse, range, and domain read on a chart.",
      canonicalPath: "/palettes/ramps",
      kind: "page",
      index: true,
      sitemap: true,
      shell: "site",
    });
  });

  it("does not publish a first-class /interactions route", () => {
    expect(createDocsRouteInventory().find((entry) => entry.path === "/interactions")).toBe(
      undefined,
    );
    expect(
      createDocsRouteInventory().some((entry) => entry.path.startsWith("/interactions/")),
    ).toBe(false);
  });

  it("publishes interaction expositions under /examples/interaction/*", () => {
    for (const id of [
      "interaction/brush-zoom",
      "interaction/facet-intervals",
      "interaction/linked-views",
    ] as const) {
      const exposition = createDocsRouteInventory().find(
        (entry) => entry.path === `/examples/${id}`,
      );
      expect(exposition).toBeDefined();
      if (exposition === undefined) continue;
      expect(exposition.path).toBe(`/examples/${id}`);
      expect(exposition.canonicalPath).toBe(`/examples/${id}`);
      expect(exposition.kind).toBe("page");
      expect(exposition.index).toBe(true);
      expect(exposition.sitemap).toBe(true);
      expect(exposition.shell).toBe("site");
      expect(exposition.title.endsWith("— ggts gallery")).toBe(true);
      expect(exposition.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps aliases canonicalized, noindex, and out of the sitemap", () => {
    const alias = createDocsRouteInventory().find(
      (entry) => entry.path === "/examples/interactions/inspection",
    );

    expect(alias).toMatchObject({
      kind: "alias",
      canonicalPath: "/examples/interaction/tooltip",
      index: false,
      sitemap: false,
    });
  });

  it("keeps performance routes noindex and out of acquisition navigation", () => {
    const perf = createDocsRouteInventory().filter((entry) => entry.path.startsWith("/__perf/"));

    expect(perf).not.toHaveLength(0);
    for (const entry of perf) {
      expect(entry.index).toBe(false);
      expect(entry.sitemap).toBe(false);
      expect(entry.navigation).toBeUndefined();
    }
  });

  it("builds absolute canonical URLs without leaking the legacy prefix", () => {
    expect(routeCanonicalUrl(route(), "https://ggts.sh")).toBe("https://ggts.sh/guide/start");
    expect(routeCanonicalUrl(route(), "https://ljodea.github.io/ggsvelte")).toBe(
      "https://ljodea.github.io/ggsvelte/guide/start",
    );
  });

  it("requires unique acquisition metadata across indexable canonical routes", () => {
    expect(() =>
      validateRouteInventory([
        route({ path: "/a", canonicalPath: "/a", title: "Same", description: "Same." }),
        route({ path: "/b", canonicalPath: "/b", title: "Same", description: "Different." }),
      ]),
    ).toThrow("duplicate indexable title");
    expect(() =>
      validateRouteInventory([
        route({ path: "/a", canonicalPath: "/a", title: "First", description: "Same." }),
        route({ path: "/b", canonicalPath: "/b", title: "Second", description: "Same." }),
      ]),
    ).toThrow("duplicate indexable description");
  });

  it("rejects duplicates, alias cycles, missing targets, and incomplete metadata", () => {
    const cases: DocsRouteRecord[][] = [
      [route(), route()],
      [
        route({ path: "/a", canonicalPath: "/b", kind: "alias", index: false, sitemap: false }),
        route({ path: "/b", canonicalPath: "/a", kind: "alias", index: false, sitemap: false }),
      ],
      [route({ path: "/a", canonicalPath: "/missing", kind: "alias" })],
      [route({ description: "" })],
      [route({ canonicalPath: "relative" })],
    ];

    for (const inventory of cases) {
      expect(() => validateRouteInventory(inventory)).toThrow("route inventory");
    }
  });
});
