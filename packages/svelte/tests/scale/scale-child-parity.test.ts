/**
 * Cross-family scale-child parity (#659 slice 4).
 *
 * For every generated shell: mount under a LayerRegistry host (no pipeline),
 * fold live scale-layer values through builder.scales(...).spec() (normalize),
 * and deep-equal against the helper-through-builder path.
 *
 * Pipeline training is intentionally out of scope here — temporal/binned/log
 * shells reject generic fixture rows, which is orthogonal to shell registration
 * parity. Live-prop ADR-0001 cases use the same registry host. The
 * DUPLICATE_SCALE_CHANNEL case still mounts under full <GGPlot> so composition
 * diagnostics fire.
 *
 * Browser-only (vitest.config excludes *.ssr.test.ts from browser projects).
 */
import { flushSync, type Component } from "svelte";
import { describe, expect, it } from "vitest";

import * as Spec from "@ggts-sh/spec";

import { gg, SCALE_CAPABILITIES, type Scales } from "../../src/lib/index.js";
import * as SveltePkg from "../../src/lib/index.js";
import { isCompositionDiagnostic } from "../../src/lib/diagnostics/composition.js";
import type { PlotDiagnostic } from "../../src/lib/diagnostics/deprecation.js";
import type { LayerRegistry } from "../../src/lib/geoms/registry.svelte.js";
import type { PortableSpec } from "../../src/lib/index.js";
import ScaleRegistryHost from "../fixtures/ScaleRegistryHost.svelte";
import ScaleShellHost from "../fixtures/ScaleShellHost.svelte";
import { render } from "../helpers/render.js";

const ROWS = [
  { x: 1, y: 2, c: "a", f: "x", s: 1, sh: "a" },
  { x: 2, y: 4, c: "b", f: "y", s: 2, sh: "b" },
] as const;

const AES = {
  x: "x",
  y: "y",
  color: "c",
  fill: "f",
  size: "s",
  shape: "sh",
} as const;

/** Manifest-equivalent helper list (camelCase, non-Colour). */
function shellHelpers(): string[] {
  const out: string[] = [];
  for (const cap of SCALE_CAPABILITIES) {
    for (const h of cap.helpers) {
      if (h.includes("_")) continue;
      if (h.includes("Colour")) continue;
      out.push(h);
    }
  }
  return out;
}

function componentName(helper: string): string {
  return "S" + helper.slice(1);
}

/**
 * Representative props so Manual shells (required `values`) and a few
 * continuous shells exercise non-default paths. Empty `{}` is fine for
 * helpers that accept defaults; Manual throws without `values`.
 */
function representativeProps(helper: string): Record<string, unknown> {
  if (helper.includes("Manual")) {
    if (helper.includes("Shape")) return { values: ["circle", "square"] as const };
    if (helper.includes("Linetype")) return { values: ["solid", "dashed"] as const };
    if (helper.includes("Color") || helper.includes("Fill")) {
      // Short hex expands under normalize (#f00 → #ff0000).
      return { values: ["#f00", "#00f"] as const };
    }
    if (helper.includes("Alpha")) {
      // Alpha range is [0, 1].
      return { values: [0.2, 0.5, 0.8] as const };
    }
    // size / linewidth
    return { values: [1, 2, 4] as const };
  }
  const common = representativeCommonProps(helper);
  if (common !== undefined) return common;
  // gradientn requires ≥2 explicit stops (no defaults; #826).
  if (
    helper === "scaleColorGradientn" ||
    helper === "scaleFillGradientn" ||
    helper === "scaleColourGradientn"
  ) {
    return { colours: ["#000000", "#ffffff"] as const };
  }
  // stepsn likewise requires ≥2 explicit stops (no defaults; #827).
  if (
    helper === "scaleColorStepsn" ||
    helper === "scaleFillStepsn" ||
    helper === "scaleColourStepsn"
  ) {
    return { colours: ["#000000", "#ffffff"] as const };
  }
  return {};
}

function representativeCommonProps(helper: string): Record<string, unknown> | undefined {
  if (helper === "scaleColorDiscrete" || helper === "scaleFillDiscrete")
    return { scheme: "colorblind" };
  if (helper === "scaleColorContinuous" || helper === "scaleFillContinuous")
    return { scheme: "viridis" };
  if (helper === "scaleXContinuous" || helper === "scaleYContinuous")
    return { domain: [0, 10] as const };
  if (helper === "scaleSizeContinuous") return { range: [1, 6] as const };
  if (helper === "scaleShapeDiscrete") return { range: ["circle", "triangle"] as const };
  return undefined;
}

function callHelper(helper: string, props: Record<string, unknown>): Scales {
  const fn = (Spec as Record<string, unknown>)[helper];
  if (typeof fn !== "function") {
    throw new TypeError(`helper ${helper} is not a function export of @ggts-sh/spec`);
  }
  return (fn as (opts: Record<string, unknown>) => Scales)(props);
}

/**
 * Assembly path: builder.scales(helper(...)).spec() runs normalize() (expands
 * short hex, fills defaults). Comparing raw helper output would false-fail.
 */
function expectedScales(helper: string, props: Record<string, unknown>): Scales | undefined {
  return gg([...ROWS], { ...AES })
    .geomPoint({ size: 3 })
    .scales(callHelper(helper, props))
    .spec().scales;
}

/** Fold live registry scale layers through the same builder.normalize path. */
function scalesFromRegistry(registry: LayerRegistry): Scales | undefined {
  let builder = gg([...ROWS], { ...AES }).geomPoint({ size: 3 });
  for (const layer of registry.layers) {
    if (layer.kind === "scale") {
      builder = builder.scales(layer.value);
    }
  }
  return builder.spec().scales;
}

async function waitRegistry(get: () => LayerRegistry | undefined): Promise<LayerRegistry> {
  await expect.poll(() => get() !== undefined).toBe(true);
  // Scale children register during init; poll until at least one scale layer.
  await expect.poll(() => get()!.layers.some((l) => l.kind === "scale")).toBe(true);
  return get()!;
}

const helpers = shellHelpers();

describe("scale-child parity (all 100 shells)", () => {
  it(`enumerates exactly 100 helpers (got ${String(helpers.length)})`, () => {
    expect(helpers).toHaveLength(100);
  });

  for (const helper of helpers) {
    const name = componentName(helper);
    it(`${name} assembled scales deep-equal helper→normalize path`, async () => {
      const props = representativeProps(helper);
      const Shell = (SveltePkg as Record<string, unknown>)[name] as Component;
      expect(Shell, `export ${name}`).toBeTypeOf("function");

      let host: LayerRegistry | undefined;
      render(ScaleRegistryHost, {
        Shell,
        shellProps: props,
        captureRegistry: (registry: LayerRegistry) => {
          host = registry;
        },
      });
      const registry = await waitRegistry(() => host);
      expect(scalesFromRegistry(registry)).toEqual(expectedScales(helper, props));
    });
  }
});

describe("live prop update (one per family, ADR-0001 getter)", () => {
  type Case = {
    family: string;
    component: string;
    initial: Record<string, unknown>;
    next: Record<string, unknown>;
    read: (scales: Scales | undefined) => unknown;
  };

  const cases: Case[] = [
    {
      family: "position-continuous",
      component: "ScaleXContinuous",
      initial: { domain: [0, 10] },
      next: { domain: [0, 20] },
      read: (s) => s?.x?.domain,
    },
    {
      family: "position-binned",
      component: "ScaleXBinned",
      initial: { domain: [0, 10] },
      next: { domain: [0, 50] },
      read: (s) => s?.x?.domain,
    },
    {
      family: "position-temporal",
      component: "ScaleXDate",
      initial: { domain: ["2020-01-01", "2020-12-31"] },
      next: { domain: ["2021-01-01", "2021-12-31"] },
      read: (s) => s?.x?.domain,
    },
    {
      family: "position-discrete",
      component: "ScaleXDiscrete",
      initial: { domain: ["a", "b"] },
      next: { domain: ["a", "b", "c"] },
      read: (s) => s?.x?.domain,
    },
    {
      family: "color-fill",
      component: "ScaleColorDiscrete",
      initial: { scheme: "colorblind" },
      next: { scheme: "observable10" },
      read: (s) => s?.color?.scheme,
    },
    {
      family: "numeric-style",
      component: "ScaleSizeContinuous",
      initial: { range: [1, 4] },
      next: { range: [2, 8] },
      read: (s) => s?.size?.range,
    },
    {
      family: "finite-style",
      component: "ScaleShapeDiscrete",
      initial: { range: ["circle", "triangle"] },
      next: { range: ["square", "diamond"] },
      read: (s) => s?.shape?.range,
    },
  ];

  for (const c of cases) {
    it(`${c.family}: ${c.component} prop update changes scales, not registrationCount`, async () => {
      const Shell = (SveltePkg as Record<string, unknown>)[c.component] as Component;
      let host: LayerRegistry | undefined;
      const view = render(ScaleRegistryHost, {
        Shell,
        shellProps: c.initial,
        captureRegistry: (registry: LayerRegistry) => {
          host = registry;
        },
      });
      const registry = await waitRegistry(() => host);
      const initialRead = c.read(scalesFromRegistry(registry));
      expect(initialRead).toBeDefined();
      const countAfterInit = registry.registrationCount;
      expect(countAfterInit).toBeGreaterThan(0);

      await view.rerender({
        Shell,
        shellProps: c.next,
        captureRegistry: (r: LayerRegistry) => {
          host = r;
        },
      });
      flushSync();
      await expect.poll(() => c.read(scalesFromRegistry(host!))).not.toEqual(initialRead);
      const nextRead = c.read(scalesFromRegistry(host!));
      expect(nextRead).toBeDefined();
      expect(nextRead).not.toEqual(initialRead);
      // ADR 0001: prop updates must not re-register.
      expect(host!.registrationCount).toBe(countAfterInit);
    });
  }
});

/**
 * The 100-shell sweep above runs on ScaleRegistryHost, which provides the
 * registry WITHOUT mounting <GGPlot> — pipeline training rejects many
 * scale+data combinations that are orthogonal to shell→helper parity. That
 * leaves the sweep proving "the shell registers the right fragment" but not
 * "GGPlot assembles it". Slice 3 proved the full path for color/fill only, and
 * the DUPLICATE_SCALE_CHANNEL case below covers position-continuous. These
 * cases close the remaining gap for the style families, which slice 4
 * introduces and nothing else exercises end to end.
 */
describe("end-to-end through <GGPlot> (families new in slice 4)", () => {
  const cases = [
    {
      family: "numeric-style",
      component: "ScaleSizeContinuous",
      props: { range: [2, 9] },
      read: (s: PortableSpec) => s.scales?.size?.range,
      expected: [2, 9],
    },
    {
      family: "finite-style",
      component: "ScaleShapeDiscrete",
      props: { range: ["square", "diamond"] },
      read: (s: PortableSpec) => s.scales?.shape?.range,
      expected: ["square", "diamond"],
    },
    {
      family: "position-continuous (y axis)",
      component: "ScaleYContinuous",
      props: { domain: [0, 42] },
      read: (s: PortableSpec) => s.scales?.y?.domain,
      expected: [0, 42],
    },
  ] as const;

  for (const c of cases) {
    it(`${c.family}: <${c.component}/> reaches the assembled PortableSpec`, async () => {
      let assembled: PortableSpec | null = null;
      render(ScaleShellHost, {
        Shell: (SveltePkg as Record<string, unknown>)[c.component] as Component,
        shellProps: c.props,
        onrender: (_model: unknown, spec: PortableSpec) => {
          assembled = spec;
        },
      });
      await expect.poll(() => assembled !== null).toBe(true);
      expect(c.read(assembled!)).toEqual(c.expected);
    });
  }
});

describe("cross-family DUPLICATE_SCALE_CHANNEL", () => {
  it("<ScaleXContinuous/> + <ScaleXLog10/> → one advisory on channel x", async () => {
    const diagnostics: PlotDiagnostic[] = [];
    let assembled: PortableSpec | null = null;
    render(ScaleShellHost, {
      Shell: SveltePkg.ScaleXContinuous as Component,
      shellProps: {},
      ShellB: SveltePkg.ScaleXLog10 as Component,
      shellBProps: {},
      ondiagnostic: (d: PlotDiagnostic) => {
        diagnostics.push(d);
      },
      onrender: (_model: unknown, spec: PortableSpec) => {
        assembled = spec;
      },
    });
    await expect.poll(() => assembled !== null).toBe(true);
    // Last child wins: ScaleXLog10 → transform log10.
    expect(assembled!.scales?.x?.transform).toBe("log10");
    await expect
      .poll(() => diagnostics.filter((d) => d.code === "DUPLICATE_SCALE_CHANNEL"))
      .toHaveLength(1);
    const advisory = diagnostics.find((d) => d.code === "DUPLICATE_SCALE_CHANNEL")!;
    expect(isCompositionDiagnostic(advisory)).toBe(true);
    if (!isCompositionDiagnostic(advisory)) throw new TypeError("expected composition");
    // `advisory` is narrowed by the guard above — no assertion needed.
    expect(advisory.channel).toBe("x");
    expect(advisory.kind).toBe("scale");
  });
});
