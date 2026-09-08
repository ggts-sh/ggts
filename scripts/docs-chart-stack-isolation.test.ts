/**
 * Guards for docs PR1: chart stack stays off pure list/prose client modules.
 *
 * Source-level only (no full vite build) so unit CI stays cheap. Complements
 * production benchmarks in .gstack/benchmark-reports/.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const docsSrc = path.join(root, "apps/docs/src");

function read(rel: string): string {
  return readFileSync(path.join(docsSrc, rel), "utf8");
}

describe("docs chart stack isolation (PR1)", () => {
  it("keeps gallery and pure list pages on the thin examples manifest", () => {
    const gallery = read("routes/examples/+page.svelte");
    const home = read("routes/+page.svelte");
    for (const [label, source] of [
      ["gallery", gallery],
      ["home", home],
    ] as const) {
      expect(source, label).toContain("$lib/examples-manifest");
      expect(source, label).not.toMatch(
        /from\s*["']\$lib\/examples["']|from\s*["']\$lib\/examples\.js["']/,
      );
    }
  });

  it("keeps every guide chapter on the shared markdown guide module", () => {
    const markdownGuide = read("routes/guide/[slug]/+page.svelte");
    expect(markdownGuide).toContain("attachGuideCodeCopy");
    expect(markdownGuide).toContain("{@html data.html}");

    const server = read("routes/guide/[slug]/+page.server.ts");
    expect(server).toContain("GUIDE_PAGES.map");
    expect(server).not.toContain('p.slug !== "getting-started"');
  });

  it("isolates @ggsvelte packages via vite/rolldown codeSplitting groups", () => {
    const vite = readFileSync(path.join(root, "apps/docs/vite.config.ts"), "utf8");
    expect(vite).toContain("codeSplitting");
    expect(vite).toContain("svelte-runtime");
    expect(vite).toContain("ggsvelte-core");
    expect(vite).toContain("ggsvelte-svelte");
    expect(vite).toContain("ggsvelte-spec");
    expect(vite).toContain("priority: 30");
  });

  it("carves TypeBox validate/schema out of the render ggsvelte-spec group", () => {
    // Same priority trick as ggsvelte-data / palette-tables: a client import of
    // validate() must not re-inflate the chart render chunk.
    const vite = readFileSync(path.join(root, "apps/docs/vite.config.ts"), "utf8");
    expect(vite).toContain("ggsvelte-spec-validate");
    expect(vite).toMatch(/name:\s*["']ggsvelte-spec-validate["'][\s\S]*?priority:\s*40/);
    expect(vite).toMatch(/schema-declarations|validate/);
  });

  it("splits pure data out of the chart mega-chunks (priority > package groups)", () => {
    // Named package groups put every matching module into one shared chunk. A
    // one-line import of palette colors or kyotoSakura then modulepreloads the
    // full ~1MB chart stack on /themes and /palettes.
    // Higher-priority groups must carve pure data out of those mega-chunks.
    const vite = readFileSync(path.join(root, "apps/docs/vite.config.ts"), "utf8");
    expect(vite).toContain("ggsvelte-data");
    expect(vite).toContain("ggsvelte-palette-tables");
    expect(vite).toMatch(/name:\s*["']ggsvelte-data["'][\s\S]*?priority:\s*40/);
    expect(vite).toMatch(/name:\s*["']ggsvelte-palette-tables["'][\s\S]*?priority:\s*40/);
    // Data/palette carve-outs must match the thin modules, not the whole package.
    expect(vite).toContain("@ggsvelte/core/data");
    expect(vite).toMatch(
      /categorical-palettes\|colorbrewer-palettes\|viridis-ramp\|sequential-schemes\|crameri-ramps\|crameri-categorical/,
    );
  });

  it("keeps intent-shell components free of static @ggsvelte/svelte main imports", () => {
    // Type-only is fine; a value import of the main entry pulls ggsvelte-svelte.
    for (const rel of [
      "lib/components/ThemeSpecimen.svelte",
      "lib/components/PalettePreview.svelte",
      "lib/components/PaletteIndex.svelte",
      "lib/components/GrammarDemo.svelte",
      "lib/components/ChartThemeLab.svelte",
      "lib/components/SequentialDeferredPlot.svelte",
    ] as const) {
      const source = read(rel);
      expect(source, rel).not.toMatch(/import\s+[^;]*\s+from\s*["']@ggsvelte\/svelte["']/);
      expect(source, rel).not.toMatch(/import\s+[^;]*\s+from\s*["']@ggsvelte\/core["']/);
    }
  });

  it("keeps the docs palette catalog free of chart package value imports", () => {
    // The catalog is statically imported by ChartThemeLab / SequentialColorLab.
    // Value imports of @ggsvelte/core or @ggsvelte/spec pull package mega-chunks
    // (TypeBox schemas, pipeline) onto /themes and /palettes before intent.
    const catalog = read("lib/catalog/themes.ts");
    expect(catalog).not.toMatch(/from\s*["']@ggsvelte\/core["']/);
    expect(catalog).not.toMatch(/import\s+(?!type\b)[^;]*\s+from\s*["']@ggsvelte\/spec["']/);
    expect(catalog).toMatch(/palette-tables|CATEGORICAL_SCHEMES|VIRIDIS_RAMP/);
  });

  it("keeps sequential-ramps on thin data imports (bundle isolation)", () => {
    // Statically imported by RampsIndex (/palettes/ramps) and
    // palette-ref-swatches (/reference/palettes). A value import of
    // SEQUENTIAL_SCHEME_NAMES from the spec barrel would drag the TypeBox
    // schema mega-chunk onto both pages; the name list is mirrored locally
    // and checked against the registry by apps/docs/tests/sequential-ramps.test.ts.
    const source = read("lib/catalog/sequential-ramps.ts");
    expect(source).not.toMatch(
      /import\s+(?!type\b)[^;]*\s+from\s*["']@ggsvelte\/(?:spec|core|svelte)["']/,
    );
  });

  it("keeps root layout free of static @ggsvelte chart imports", () => {
    const layout = read("routes/+layout.svelte");
    expect(layout).not.toMatch(/from\s*["']@ggsvelte\/(?:svelte|core)["']/);
  });
});
