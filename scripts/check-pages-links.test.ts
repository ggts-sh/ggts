import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  checkPackedPages,
  findBrokenFragments,
  findBrokenLinks,
  requiredPages,
} from "./check-pages-links.ts";

describe("packed Pages link checks", () => {
  const files = new Set([
    "index.html",
    "docs.html",
    "reference.html",
    "guide/interactions.html",
    "guide/interaction-reference.html",
    "guide/upgrading.html",
    "themes.html",
    "palettes.html",
    "reference/interactions.html",
    "reference/themes.html",
    "reference/palettes.html",
    "reference/cli.html",
    "reference/labs.html",
    "reference/axes.html",
    "reference/labels.html",
    "reference/geoms.html",
    "reference/geoms/point.html",
    "reference/geoms/line.html",
    "reference/stats.html",
    "reference/stats/count.html",
    "reference/positions.html",
    "reference/positions/stack.html",
    "reference/scales.html",
    "reference/scales/color_continuous.html",
    "reference/scales/x_continuous.html",
    "reference/guides.html",
    "reference/guides/legend.html",
    "reference/guides/colorbar.html",
    "examples/interaction/tooltip.html",
    "examples/interaction/brush-zoom.html",
    "examples/interaction/linked-views.html",
    "examples/interactions/inspection.html",
    "examples/interactions/interval-selection.html",
    "llms.txt",
    "llms-full.txt",
    "robots.txt",
    "sitemap.xml",
    "_app/app.js",
  ]);

  it("resolves project-relative guide, example, endpoint, and asset links", () => {
    expect(
      findBrokenLinks(
        "guide/interactions.html",
        [
          "../examples/interaction/tooltip",
          "../guide/upgrading#deprecated-type-aliases",
          "../llms.txt",
          "../_app/app.js",
          "../",
          "https://github.com/ggts-sh/ggts",
          "#inspection",
        ],
        files,
      ),
    ).toEqual([]);
  });

  it("rejects legacy-prefix leakage in root builds without false-passing legacy builds", () => {
    const href = "/ggsvelte/guide/interactions";
    expect(findBrokenLinks("index.html", [href], files, "")).toEqual([href]);
    expect(findBrokenLinks("index.html", [href], files, "/ggsvelte")).toEqual([]);
  });

  it("reports missing internal targets but ignores external protocols", () => {
    expect(
      findBrokenLinks(
        "examples/interaction/tooltip.html",
        ["../../guide/missing", "mailto:test@example.com", "data:text/plain,ok"],
        files,
      ),
    ).toEqual(["../../guide/missing"]);
  });

  it("validates same-page and cross-page heading fragments", () => {
    const anchors = new Map([
      ["guide/interactions.html", new Set(["inspection", "brush-zoom"])],
      ["guide/interaction-reference.html", new Set(["oninspect", "ondiagnostic"])],
    ]);
    expect(
      findBrokenFragments(
        "guide/interactions.html",
        ["#inspection", "./interaction-reference#oninspect", "#missing"],
        files,
        anchors,
      ),
    ).toEqual(["#missing"]);
  });

  it("requires the R0 examples, guides, and agent endpoints in the packed site", () => {
    for (const page of requiredPages) expect(files.has(page)).toBe(true);
    expect(requiredPages).toContain("examples/interactions/inspection.html");
    expect(requiredPages).toContain("examples/interactions/interval-selection.html");
    expect(requiredPages).toContain("docs.html");
    expect(requiredPages).toContain("reference.html");
    expect(requiredPages).not.toContain("playground.html");
    expect(requiredPages).toContain("themes.html");
    expect(requiredPages).toContain("palettes.html");
    expect(requiredPages).not.toContain("interactions.html");
    expect(requiredPages).toContain("examples/interaction/brush-zoom.html");
    expect(requiredPages).toContain("examples/interaction/linked-views.html");
    expect(requiredPages).toContain("reference/interactions.html");
    expect(requiredPages).toContain("reference/themes.html");
    expect(requiredPages).toContain("reference/palettes.html");
    expect(requiredPages).toContain("reference/cli.html");
    expect(requiredPages).toContain("reference/labs.html");
    expect(requiredPages).toContain("reference/axes.html");
    expect(requiredPages).toContain("reference/labels.html");
    expect(requiredPages).toContain("reference/geoms.html");
    expect(requiredPages).toContain("reference/geoms/point.html");
    expect(requiredPages).toContain("reference/geoms/line.html");
    expect(requiredPages).toContain("reference/stats.html");
    expect(requiredPages).toContain("reference/stats/count.html");
    expect(requiredPages).toContain("reference/positions.html");
    expect(requiredPages).toContain("reference/positions/stack.html");
    expect(requiredPages).toContain("reference/scales.html");
    expect(requiredPages).toContain("reference/scales/color_continuous.html");
    expect(requiredPages).toContain("reference/scales/x_continuous.html");
    expect(requiredPages).toContain("reference/guides.html");
    expect(requiredPages).toContain("reference/guides/legend.html");
    expect(requiredPages).toContain("reference/guides/colorbar.html");
    expect(requiredPages).toContain("guide/interaction-reference.html");
    expect(requiredPages).toContain("robots.txt");
    expect(requiredPages).toContain("sitemap.xml");
  });

  it("reports a missing packed directory and every absent required page", () => {
    const missing = join(tmpdir(), `ggsvelte-pages-does-not-exist-${String(process.pid)}`);
    expect(checkPackedPages(missing)).toEqual([`packed Pages directory is missing: ${missing}`]);

    const empty = mkdtempSync(join(tmpdir(), "ggsvelte-pages-empty-"));
    try {
      expect(checkPackedPages(empty)).toEqual(
        requiredPages.map((page) => `missing required page: ${page}`),
      );
    } finally {
      rmSync(empty, { recursive: true });
    }
  });

  it("reports a broken link from an otherwise complete packed site", () => {
    const root = mkdtempSync(join(tmpdir(), "ggsvelte-pages-broken-"));
    try {
      for (const page of ["index.html", ...requiredPages]) {
        const absolute = join(root, page);
        mkdirSync(dirname(absolute), { recursive: true });
        writeFileSync(absolute, page === "index.html" ? '<a href="./missing">Missing</a>' : "");
      }
      expect(checkPackedPages(root)).toContain('index.html: broken href "./missing"');
    } finally {
      rmSync(root, { recursive: true });
    }
  });
});
