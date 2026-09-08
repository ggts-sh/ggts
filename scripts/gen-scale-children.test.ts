/**
 * gen-scale-children unit tests + the scale-children staleness guard
 * (CI parity for `bun run scale:children:check`).
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SCALE_CAPABILITIES } from "@ggts-sh/spec";

import {
  expectedCamelHelpers,
  expectedColourAliases,
  manifestAliases,
  manifestHelpers,
  SHELL_MANIFEST,
} from "./gen-scale-children-manifest.ts";
import { extractExports } from "./gen-lifecycle.ts";
import {
  GENERATED_HEADER,
  INDEX_PATH,
  REGION_END,
  REGION_START,
  renderIndexRegion,
  renderShell,
  rewriteIndexRegion,
  shellRelPath,
} from "./gen-scale-children.ts";

const repoRoot = join(import.meta.dir, "..");
const read = (rel: string) => readFileSync(join(repoRoot, rel), "utf8");

describe("SHELL_MANIFEST completeness", () => {
  it("helper set equals camelCase non-Colour helpers across SCALE_CAPABILITIES", () => {
    const expected = expectedCamelHelpers();
    const actual = manifestHelpers();
    // Both directions so a ledger addition without a shell fails, and a
    // shell without a ledger entry fails.
    for (const h of expected) {
      expect(actual.has(h), `missing shell for helper ${h}`).toBe(true);
    }
    for (const h of actual) {
      expect(expected.has(h), `orphan shell helper ${h} not in SCALE_CAPABILITIES`).toBe(true);
    }
    expect(actual).toEqual(expected);
  });

  it("aliases equal Colour helpers plus style ordinal re-exports (#830/#832)", () => {
    const colour = expectedColourAliases();
    // Discrete style shells re-export Ordinal component names (no extra files).
    const ordinal = new Set([
      "ScaleSizeOrdinal",
      "ScaleAlphaOrdinal",
      "ScaleLinewidthOrdinal",
      "ScaleShapeOrdinal",
    ]);
    const expected = new Set([...colour, ...ordinal]);
    const actual = manifestAliases();
    for (const a of expected) {
      expect(actual.has(a), `missing alias ${a}`).toBe(true);
    }
    for (const a of actual) {
      expect(expected.has(a), `orphan alias ${a}`).toBe(true);
    }
    expect(actual).toEqual(expected);
  });

  it("cardinality: 100 component files + 28 aliases", () => {
    expect(SHELL_MANIFEST).toHaveLength(100);
    // 18 Colour + Size/Linewidth/Alpha/Shape Ordinal (#830/#832)
    expect(manifestAliases().size).toBe(28);
    // Cross-check family buckets against the verified ledger.
    const byFamily = new Map<string, number>();
    for (const s of SHELL_MANIFEST) {
      byFamily.set(s.family, (byFamily.get(s.family) ?? 0) + 1);
    }
    expect(byFamily.get("position-continuous")).toBe(8);
    expect(byFamily.get("position-binned")).toBe(2);
    expect(byFamily.get("position-temporal")).toBe(8);
    expect(byFamily.get("position-discrete")).toBe(2);
    expect(byFamily.get("color-fill")).toBe(48);
    expect(byFamily.get("numeric-style")).toBe(24);
    expect(byFamily.get("finite-style")).toBe(8);
    // Families in the ledger match. Set<string>, not the inferred literal union:
    // ShellSpec.family is a plain string, and whether it names a real family is
    // the thing under test — a narrower set would reject the input instead.
    const ledgerFamilies = new Set<string>(SCALE_CAPABILITIES.map((c) => c.family));
    for (const family of byFamily.keys()) {
      expect(ledgerFamilies.has(family), `unknown family ${family}`).toBe(true);
    }
  });

  it("every family matches a SCALE_CAPABILITIES family string", () => {
    const ledger = new Set<string>(SCALE_CAPABILITIES.map((c) => c.family));
    for (const s of SHELL_MANIFEST) {
      expect(ledger.has(s.family), `${s.helper} family ${s.family}`).toBe(true);
    }
  });
});

describe("renderShell", () => {
  it("emits the generated header + verbatimModuleSyntax type import", () => {
    const src = renderShell(SHELL_MANIFEST[0]!);
    expect(src.startsWith(GENERATED_HEADER)).toBe(true);
    expect(src).toContain("type ContinuousPositionScaleOptions");
    expect(src).toContain('createPlotLayer("scale", () => scaleXContinuous(definedProps(props)))');
    expect(src).toContain('from "@ggts-sh/spec"');
    expect(src).toContain('from "../layers/plot-layer.svelte.js"');
    // Factory import is multi-line so it stays under printWidth 80.
    expect(src).toContain(
      '  import {\n    createPlotLayer,\n    definedProps,\n  } from "../layers/plot-layer.svelte.js";',
    );
    // ContinuousPositionScaleOptions is long enough that prettier multi-lines it.
    expect(src).toContain(
      "  import {\n    scaleXContinuous,\n    type ContinuousPositionScaleOptions,\n  }",
    );
    // Short names stay single-line (TemporalScaleOptions fits printWidth 80).
    const date = SHELL_MANIFEST.find((s) => s.helper === "scaleXDate")!;
    expect(renderShell(date)).toContain(
      'import { scaleXDate, type TemporalScaleOptions } from "@ggts-sh/spec";',
    );
    expect(renderShell(date)).toContain('import "@ggts-sh/core/temporal";');
    expect(src).not.toContain('import "@ggts-sh/core/temporal";');
  });

  it("every script line of every generated shell is ≤ printWidth 80", () => {
    // Header comment is intentionally long; prettier only wraps script body.
    for (const spec of SHELL_MANIFEST) {
      const src = renderShell(spec);
      const script = src.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? "";
      for (const line of script.split("\n")) {
        if (line.length === 0) continue;
        expect(line.length, `${spec.component}: ${line}`).toBeLessThanOrEqual(80);
      }
    }
  });

  it("emits the Omit expression for reverse shells (not ContinuousPositionScaleOptions alone)", () => {
    const rev = SHELL_MANIFEST.find((s) => s.helper === "scaleXReverse")!;
    const src = renderShell(rev);
    expect(src).toContain('Omit<ContinuousPositionScaleOptions, "transform" | "reverse">');
    // Must not widen the props annotation to the full continuous type.
    expect(src).not.toMatch(/const props: ContinuousPositionScaleOptions = \$props\(\)/);
  });

  it("pins finite-style generics (PointShapeName / LinetypeName)", () => {
    const shape = SHELL_MANIFEST.find((s) => s.helper === "scaleShapeManual")!;
    const line = SHELL_MANIFEST.find((s) => s.helper === "scaleLinetypeManual")!;
    expect(renderShell(shape)).toContain("ManualFiniteStyleScaleOptions<PointShapeName>");
    expect(renderShell(shape)).toContain("type PointShapeName");
    expect(renderShell(line)).toContain("ManualFiniteStyleScaleOptions<LinetypeName>");
    expect(renderShell(line)).toContain("type LinetypeName");
  });
});

describe("index region rewrite", () => {
  it("fails hard when either marker is missing", () => {
    expect(() => rewriteIndexRegion("export const x = 1;\n")).toThrow(/markers missing/);
    expect(() => rewriteIndexRegion(`${REGION_START}\nexport { foo };\n`)).toThrow(
      /markers missing/,
    );
    expect(() => rewriteIndexRegion(`export { foo };\n${REGION_END}\n`)).toThrow(/markers missing/);
  });

  it("replaces only the delimited region", () => {
    const before = `// keep\n${REGION_START}\nold\n${REGION_END}\n// after\n`;
    const out = rewriteIndexRegion(before, `${REGION_START}\nnew\n${REGION_END}`);
    expect(out).toBe(`// keep\n${REGION_START}\nnew\n${REGION_END}\n// after\n`);
  });

  it("emits one compact lifecycle-tagged export line per shell + alias", () => {
    const region = renderIndexRegion();
    expect(region.startsWith(REGION_START)).toBe(true);
    expect(region.endsWith(REGION_END)).toBe(true);
    const body = region.split("\n").slice(1, -1);
    expect(body).toHaveLength(100 + 28);
    const compact =
      /^\/\*\* @lifecycle stable-intent \*\/ export \{ default as (\w+) \} from "\.\/scale\/(\w+)\.svelte";$/;
    for (const line of body) {
      expect(compact.test(line), `non-compact export line: ${line}`).toBe(true);
    }
    expect(
      body.includes(
        '/** @lifecycle stable-intent */ export { default as ScaleColourContinuous } from "./scale/ScaleColorContinuous.svelte";',
      ),
    ).toBe(true);
    // No ScaleColour*.svelte files — aliases point at Color components.
    expect(body.join("\n")).not.toMatch(/ScaleColour\w+\.svelte/);
  });

  it("gen-lifecycle parses the compact region as stable-intent value exports", () => {
    const exports = extractExports(
      `// @lifecycle-default experimental\n${renderIndexRegion()}\n`,
      INDEX_PATH,
    );
    expect(exports).toHaveLength(100 + 28);
    for (const e of exports) {
      expect(e.kind).toBe("value");
      expect(e.lifecycle).toBe("stable-intent");
    }
  });
});

describe("scale children on disk are current", () => {
  it("every shell file matches renderShell (regenerate with bun run scale:children:gen)", () => {
    for (const spec of SHELL_MANIFEST) {
      const rel = shellRelPath(spec.component);
      expect(read(rel), rel).toBe(renderShell(spec));
    }
  });

  it("index region matches renderIndexRegion", () => {
    const index = read(INDEX_PATH);
    const start = index.indexOf(REGION_START);
    const end = index.indexOf(REGION_END);
    expect(start, "start marker present").toBeGreaterThanOrEqual(0);
    expect(end, "end marker present").toBeGreaterThan(start);
    const onDisk = index.slice(start, end + REGION_END.length);
    expect(onDisk).toBe(renderIndexRegion());
  });

  it("hand-written <Scale> export stays outside the generated region", () => {
    const index = read(INDEX_PATH);
    const scaleExport = index.indexOf('export { default as Scale } from "./scale/Scale.svelte"');
    const regionStart = index.indexOf(REGION_START);
    expect(scaleExport).toBeGreaterThanOrEqual(0);
    expect(regionStart).toBeGreaterThan(scaleExport);
  });
});
