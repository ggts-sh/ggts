/**
 * Facet strip theme tokens (`stripFill`, `stripText`), built-in WCAG AA contrast
 * audit, SVG chrome emission, and `strip-contrast-low` pipeline/CLI warning.
 * Seams: `resolveTheme`, `runPipeline`, `renderToSVGString`, `runCLI`.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";

import { runCLI } from "../../src/cli.ts";
import { contrastRatio } from "../../src/color-contrast.ts";
import { PIPELINE_WARNING_CATALOG } from "../../src/diagnostics.ts";
import { runPipeline } from "../../src/pipeline.ts";
import { registerAll } from "../../src/register.ts";
import { renderToSVGString } from "../../src/render-svg-full.ts";
import { SLIM_THEMES } from "../../src/theme-slim.ts";
import {
  BUILTIN_THEMES,
  LEGACY_BUILTIN_THEMES,
  resolveTheme,
  themeVar,
  type ThemeTokens,
} from "../../src/theme.ts";

registerAll();

const facetRows = [
  { x: 1, y: 10, g: "Alpha" },
  { x: 2, y: 20, g: "Alpha" },
  { x: 1, y: 15, g: "Beta" },
  { x: 2, y: 25, g: "Beta" },
];

function effectiveStripSurface(tokens: ThemeTokens): string {
  const fill = tokens.stripFill.trim().toLowerCase();
  if (fill !== "none" && fill !== "transparent") return tokens.stripFill;
  const paper = tokens.paper.trim().toLowerCase();
  if (paper !== "none" && paper !== "transparent") return tokens.paper;
  const panel = tokens.panel.trim().toLowerCase();
  if (panel !== "none" && panel !== "transparent") return tokens.panel;
  // Transparent strip over transparent paper/panel renders over a light host page by default.
  return "#ffffff";
}

function effectiveStripInk(tokens: ThemeTokens): string {
  return tokens.stripText === "currentColor" ? "#1f2328" : tokens.stripText;
}

describe("built-in facet strip contrast audit (WCAG AA >= 4.5)", () => {
  it("every edition-2 built-in theme satisfies WCAG AA strip contrast (>= 4.5)", () => {
    for (const [name, tokens] of Object.entries(BUILTIN_THEMES)) {
      const bg = effectiveStripSurface(tokens);
      const fg = effectiveStripInk(tokens);
      const ratio = contrastRatio(fg, bg, {
        backdrop: tokens.paper === "none" ? "#ffffff" : tokens.paper,
      });
      expect(ratio, `${name}: ${fg} on ${bg}`).not.toBeNull();
      expect(ratio!, `${name}: ${fg} on ${bg} (${ratio?.toFixed(2)}:1)`).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it("every edition-1 legacy and slim theme satisfies WCAG AA strip contrast (>= 4.5)", () => {
    for (const [name, tokens] of Object.entries(LEGACY_BUILTIN_THEMES)) {
      const bg = effectiveStripSurface(tokens);
      const fg = effectiveStripInk(tokens);
      const ratio = contrastRatio(fg, bg, {
        backdrop: tokens.paper === "none" ? "#ffffff" : tokens.paper,
      });
      expect(ratio, `legacy.${name}: ${fg} on ${bg}`).not.toBeNull();
      expect(
        ratio!,
        `legacy.${name}: ${fg} on ${bg} (${ratio?.toFixed(2)}:1)`,
      ).toBeGreaterThanOrEqual(4.5);
    }
    for (const [name, tokens] of Object.entries(SLIM_THEMES)) {
      if (tokens === undefined) continue;
      const bg = effectiveStripSurface(tokens);
      const fg = effectiveStripInk(tokens);
      const ratio = contrastRatio(fg, bg, {
        backdrop: tokens.paper === "none" ? "#ffffff" : tokens.paper,
      });
      expect(ratio, `slim.${name}: ${fg} on ${bg}`).not.toBeNull();
      expect(
        ratio!,
        `slim.${name}: ${fg} on ${bg} (${ratio?.toFixed(2)}:1)`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("gives clean a light neutral strip fill (>12:1) decoupled from its #b3b3b3 grid", () => {
    const clean = resolveTheme("clean");
    expect(clean.grid).toBe("#b3b3b3");
    expect(clean.stripFill).not.toBe("#b3b3b3");
    expect(clean.stripFill).toBe("#f0f2f4");
    expect(clean.stripText).toBe(clean.ink);
    expect(contrastRatio(clean.stripText, clean.stripFill)!).toBeGreaterThan(12);

    // Overriding ink updates stripText while keeping clean's light stripFill sticky.
    const customInk = resolveTheme({ name: "clean", ink: "#222222" });
    expect(customInk.stripFill).toBe("#f0f2f4");
    expect(customInk.stripText).toBe("#222222");

    // Overriding grid does not darken clean's stripFill.
    const customGrid = resolveTheme({ name: "clean", grid: "#888888" });
    expect(customGrid.stripFill).toBe("#f0f2f4");

    // Explicit stripFill/stripText overrides always win.
    const explicit = resolveTheme({
      name: "clean",
      stripFill: "#e2e8f0",
      stripText: "#0f172a",
    });
    expect(explicit.stripFill).toBe("#e2e8f0");
    expect(explicit.stripText).toBe("#0f172a");
  });

  it("fixes invisible and failing built-in strips (linedraw, wsj, solarized family, hcdark)", () => {
    const linedraw = resolveTheme("linedraw");
    expect(linedraw.stripFill).toBe("#000000");
    expect(linedraw.stripText).toBe("#ffffff");
    expect(contrastRatio(linedraw.stripText, linedraw.stripFill)!).toBeGreaterThanOrEqual(20);

    const wsj = resolveTheme("wsj");
    expect(wsj.stripFill).not.toBe("#000000");
    expect(contrastRatio(wsj.stripText, wsj.stripFill)!).toBeGreaterThanOrEqual(12);

    for (const name of [
      "solarized",
      "solarizeddark",
      "solarized_2",
      "solarized_2dark",
      "hcdark",
    ] as const) {
      const tokens = resolveTheme(name);
      expect(contrastRatio(tokens.stripText, tokens.stripFill)!, name).toBeGreaterThanOrEqual(4.5);
      // Sticky across unrelated object overrides, including grid overrides.
      const overridden = resolveTheme({ name, titleSize: 16, grid: "#eeeeee" });
      expect(overridden.stripFill, name).toBe(tokens.stripFill);
      expect(overridden.stripText, name).toBe(tokens.stripText);
    }

    // Overriding grid on linedraw must not replace its paired black/white strip.
    for (const grid of ["#eeeeee", "none"] as const) {
      const customLinedraw = resolveTheme({ name: "linedraw", grid });
      expect(customLinedraw.stripFill).toBe("#000000");
      expect(customLinedraw.stripText).toBe("#ffffff");
      expect(contrastRatio(customLinedraw.stripText, customLinedraw.stripFill)!).toBe(21);
    }
  });

  it("parses hsl/named colors and rejects malformed CSS color literals cleanly", () => {
    expect(contrastRatio("hsl(0 0% 100%)", "hsl(0 0% 0%)")).toBeCloseTo(21, 5);
    expect(contrastRatio("dimgray", "gray")!).toBeLessThan(4.5);
    expect(contrastRatio("#1z2z3z", "#ffffff")).toBeNull();
    expect(contrastRatio("#-f0000", "#ffffff")).toBeNull();
    expect(contrastRatio("rgb(10, , 20)", "#ffffff")).toBeNull();
    expect(contrastRatio("rgb(10 20 30 / )", "#ffffff")).toBeNull();
    expect(contrastRatio("hsl(0, %, 50%)", "#ffffff")).toBeNull();
  });
});

describe("strip SVG rendering and themeVar roles", () => {
  it("emits --gg-stripFill and --gg-stripText instead of --gg-grid and --gg-ink", () => {
    const clean = resolveTheme("clean");
    expect(themeVar("stripFill", clean)).toBe(`var(--gg-stripFill, ${clean.stripFill})`);
    expect(themeVar("stripText", clean)).toBe(`var(--gg-stripText, ${clean.stripText})`);

    const svg = renderToSVGString(
      gg(facetRows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .facet({ wrap: "g" })
        .theme("clean")
        .spec(),
      { width: 640, height: 400 },
    );

    const stripMatch = svg.match(/<g class="gg-strip"[^>]*>([\s\S]*?)<\/g>/);
    expect(stripMatch).not.toBeNull();
    const stripInner = stripMatch![1]!;
    expect(stripInner).toContain(`fill="var(--gg-stripFill, ${clean.stripFill})"`);
    expect(stripInner).toContain(`fill="var(--gg-stripText, ${clean.stripText})"`);
    expect(stripInner).not.toContain("var(--gg-grid");
    expect(stripInner).not.toContain("var(--gg-ink");
  });
});

describe("strip-contrast-low pipeline and CLI warning", () => {
  it("registers strip-contrast-low in PIPELINE_WARNING_CATALOG", () => {
    expect(PIPELINE_WARNING_CATALOG["strip-contrast-low"].summary).toContain("4.5:1");
  });

  it("emits strip-contrast-low for low-contrast custom strip tokens on faceted plots", () => {
    const spec = gg(facetRows, aes({ x: "x", y: "y" }))
      .geomPoint()
      .facet({ wrap: "g" })
      .theme({ name: "clean", stripFill: "#222222", stripText: "#333333" })
      .labs({ title: "Low contrast strips", x: "X", y: "Y" })
      .spec();

    const model = runPipeline(spec, { width: 640, height: 400 });
    const hit = model.warnings.find((w) => w.code === "strip-contrast-low");
    expect(hit).toBeDefined();
    expect(hit?.message).toContain("4.5:1");
    expect(hit?.message).toContain("#333333");
    expect(hit?.message).toContain("#222222");
  });

  it("emits strip-contrast-low when stripFill is none over opaque paper with low-contrast stripText", () => {
    const spec = gg(facetRows, aes({ x: "x", y: "y" }))
      .geomPoint()
      .facet({ wrap: "g" })
      .theme({ name: "classic", stripFill: "none", stripText: "#e5e5e5" })
      .labs({ title: "Pale text on white paper", x: "X", y: "Y" })
      .spec();

    const model = runPipeline(spec, { width: 640, height: 400 });
    expect(model.warnings.map((w) => w.code)).toContain("strip-contrast-low");
  });

  it("does not emit strip-contrast-low on clean defaults, unfaceted plots, or hidden strips", () => {
    const cleanFaceted = gg(facetRows, aes({ x: "x", y: "y" }))
      .geomPoint()
      .facet({ wrap: "g" })
      .theme("clean")
      .labs({ title: "Clean faceted", x: "X", y: "Y" })
      .spec();
    expect(
      runPipeline(cleanFaceted, { width: 640, height: 400 }).warnings.map((w) => w.code),
    ).not.toContain("strip-contrast-low");

    const unfaceted = gg(facetRows, aes({ x: "x", y: "y" }))
      .geomPoint()
      .theme({ name: "clean", stripFill: "#222222", stripText: "#222222" })
      .labs({ title: "Unfaceted", x: "X", y: "Y" })
      .spec();
    expect(
      runPipeline(unfaceted, { width: 640, height: 400 }).warnings.map((w) => w.code),
    ).not.toContain("strip-contrast-low");

    const hiddenStrips = gg(facetRows, aes({ x: "x", y: "y" }))
      .geomPoint()
      .facet({ wrap: "g", strip: { show: false } })
      .theme({ name: "clean", stripFill: "#222222", stripText: "#222222" })
      .labs({ title: "Hidden strips", x: "X", y: "Y" })
      .spec();
    expect(
      runPipeline(hiddenStrips, { width: 640, height: 400 }).warnings.map((w) => w.code),
    ).not.toContain("strip-contrast-low");

    // Transparent strip on transparent paper sits over host background, not panel.
    const transparentPaper = gg(facetRows, aes({ x: "x", y: "y" }))
      .geomPoint()
      .facet({ wrap: "g" })
      .theme({ name: "solarizeddark", stripFill: "none", stripText: "#002b36" })
      .labs({ title: "Transparent paper strips", x: "X", y: "Y" })
      .spec();
    expect(
      runPipeline(transparentPaper, { width: 640, height: 400 }).warnings.map((w) => w.code),
    ).not.toContain("strip-contrast-low");
  });

  it("surfaces strip-contrast-low through ggts check stderr JSONL", async () => {
    const spec = gg(facetRows, aes({ x: "x", y: "y" }))
      .geomPoint()
      .facet({ wrap: "g" })
      .theme({ name: "clean", stripFill: "#888888", stripText: "#777777" })
      .labs({ title: "CLI contrast check", x: "X", y: "Y" })
      .spec();

    const errLines: string[] = [];
    const outChunks: string[] = [];
    const code = await runCLI(
      [],
      {
        readStdin: () => Promise.resolve(JSON.stringify(spec)),
        readFile: () => {
          throw new Error("unexpected readFile");
        },
        writeOut: (t) => {
          outChunks.push(t);
        },
        writeErr: (line) => {
          errLines.push(line);
        },
      },
      { command: "check" },
    );

    expect(code).toBe(0);
    expect(outChunks).toEqual([]);
    const parsed = errLines
      .filter((line) => line.startsWith("{"))
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(parsed.some((d) => d["kind"] === "warning" && d["code"] === "strip-contrast-low")).toBe(
      true,
    );
  });
});
