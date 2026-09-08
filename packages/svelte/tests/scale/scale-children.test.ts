/**
 * Scale children (#659 slice 3 / #704).
 * GGPlot `scales` prop removed in 0.13.0 — child layers only.
 */
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

import { SCALE_CAPABILITIES, scaleXLog10, type PortableSpec } from "../../src/lib/index.js";
import * as SveltePkg from "../../src/lib/index.js";
import type { PlotDiagnostic } from "../../src/lib/diagnostics/deprecation.js";
import {
  isCompositionDiagnostic,
  isDuplicateScaleChannelDiagnostic,
} from "../../src/lib/diagnostics/composition.js";
import type { LayerRegistry } from "../../src/lib/geoms/registry.svelte.js";
import ScaleChildrenPlot from "../fixtures/ScaleChildrenPlot.svelte";
import { render } from "../helpers/render.js";

function collect(): {
  diagnostics: PlotDiagnostic[];
  ondiagnostic: (diagnostic: PlotDiagnostic) => void;
} {
  const diagnostics: PlotDiagnostic[] = [];
  return {
    diagnostics,
    ondiagnostic: (diagnostic) => {
      diagnostics.push(diagnostic);
    },
  };
}

async function waitAssembled(get: () => PortableSpec | null): Promise<PortableSpec> {
  await expect.poll(() => get() !== null).toBe(true);
  return get()!;
}

describe("Scale children → assembled PortableSpec", () => {
  it('1: <ScaleColorDiscrete scheme="colorblind"/> → color ordinal scheme', async () => {
    let assembled: PortableSpec | null = null;
    render(ScaleChildrenPlot, {
      useScaleColorDiscrete: true,
      colorScheme: "colorblind",
      onrender: (_model: unknown, spec: PortableSpec) => {
        assembled = spec;
      },
    });
    const spec = await waitAssembled(() => assembled);
    expect(spec.scales?.color).toEqual({ type: "ordinal", scheme: "colorblind" });
  });

  it("2: <Scale value={scaleXLog10()}/> → x.transform log10", async () => {
    let assembled: PortableSpec | null = null;
    render(ScaleChildrenPlot, {
      useGenericScale: true,
      scaleValue: scaleXLog10(),
      onrender: (_model: unknown, spec: PortableSpec) => {
        assembled = spec;
      },
    });
    const spec = await waitAssembled(() => assembled);
    expect(spec.scales?.x?.transform).toBe("log10");
  });

  it("3: <ScaleColorDiscrete/> + <ScaleFillContinuous/> → both keys present", async () => {
    let assembled: PortableSpec | null = null;
    render(ScaleChildrenPlot, {
      useScaleColorDiscrete: true,
      colorScheme: "colorblind",
      useScaleFillContinuous: true,
      onrender: (_model: unknown, spec: PortableSpec) => {
        assembled = spec;
      },
    });
    const spec = await waitAssembled(() => assembled);
    expect(spec.scales?.color).toBeDefined();
    expect(spec.scales?.fill).toBeDefined();
    expect(spec.scales?.color?.type).toBe("ordinal");
    expect(spec.scales?.fill?.type).toBe("sequential");
  });

  it("6: spec prop + scale child → spec wins, child ignored", async () => {
    let assembled: PortableSpec | null = null;
    render(ScaleChildrenPlot, {
      useSpec: true,
      useScaleColorDiscrete: true,
      onrender: (_model: unknown, spec: PortableSpec) => {
        assembled = spec;
      },
    });
    const spec = await waitAssembled(() => assembled);
    expect(spec.scales?.color).toEqual({ type: "ordinal", scheme: "observable10" });
  });

  it("7: layers prop + scale child → layers wins for marks, scale child still applies", async () => {
    let assembled: PortableSpec | null = null;
    render(ScaleChildrenPlot, {
      useLayersProp: true,
      useScaleColorDiscrete: true,
      colorScheme: "colorblind",
      onrender: (_model: unknown, spec: PortableSpec) => {
        assembled = spec;
      },
    });
    const spec = await waitAssembled(() => assembled);
    // layers prop supplies the mark; scale child still folds in.
    expect(spec.layers).toHaveLength(1);
    expect(spec.layers[0]?.geom).toBe("point");
    expect(spec.scales?.color).toEqual({ type: "ordinal", scheme: "colorblind" });
  });

  it("8: reactive <ScaleColorDiscrete scheme={x}/> updates spec, registrationCount unchanged", async () => {
    let assembled: PortableSpec | null = null;
    let host: LayerRegistry | undefined;
    const view = render(ScaleChildrenPlot, {
      useScaleColorDiscrete: true,
      colorScheme: "colorblind",
      captureRegistry: (registry: LayerRegistry) => {
        host = registry;
      },
      onrender: (_model: unknown, spec: PortableSpec) => {
        assembled = spec;
      },
    });
    await waitAssembled(() => assembled);
    expect(assembled!.scales?.color?.scheme).toBe("colorblind");
    expect(host).toBeDefined();
    const countAfterInit = host!.registrationCount;
    expect(countAfterInit).toBeGreaterThan(0);

    assembled = null;
    await view.rerender({
      useScaleColorDiscrete: true,
      colorScheme: "observable10",
      captureRegistry: (registry: LayerRegistry) => {
        host = registry;
      },
      onrender: (_model: unknown, spec: PortableSpec) => {
        assembled = spec;
      },
    });
    flushSync();
    await waitAssembled(() => assembled);
    expect(assembled!.scales?.color?.scheme).toBe("observable10");
    // ADR 0001: prop updates must not re-register.
    expect(host!.registrationCount).toBe(countAfterInit);
  });
});

describe("Scale* export parity with all SCALE_CAPABILITIES families", () => {
  it("13: exported Scale* set === all families ∪ {Scale} ∪ Colour + style Ordinal aliases", () => {
    const expectedFromHelpers: string[] = [];
    for (const cap of SCALE_CAPABILITIES) {
      for (const h of cap.helpers) {
        if (h.includes("_")) continue;
        // scaleFoo → ScaleFoo (includes Colour aliases and every family)
        expectedFromHelpers.push("S" + h.slice(1));
      }
    }
    // Discrete style shells re-export Ordinal component names (ggplot2
    // scale_*_ordinal, #830/#832). Alias-only — not SCALE_CAPABILITIES camel helpers.
    const styleOrdinalAliases = [
      "ScaleSizeOrdinal",
      "ScaleAlphaOrdinal",
      "ScaleLinewidthOrdinal",
      "ScaleShapeOrdinal",
    ];
    const expectedExports = new Set(["Scale", ...expectedFromHelpers, ...styleOrdinalAliases]);

    const pkg = SveltePkg as Record<string, unknown>;
    const actualScaleExports = Object.keys(pkg).filter(
      (key) =>
        key === "Scale" ||
        (key.startsWith("Scale") && key[5] !== undefined && key[5] === key[5].toUpperCase()),
    );

    for (const name of expectedExports) {
      expect(pkg[name], `missing export ${name}`).toBeTypeOf("function");
    }
    expect(new Set(actualScaleExports)).toEqual(expectedExports);
    // 100 shells + 28 aliases (Colour + style Ordinal re-exports) + hand-written Scale
    expect(expectedExports.size).toBe(100 + 28 + 1);
  });
});

describe("definedProps + composition diagnostics", () => {
  it("14: scheme={undefined} produces no scheme key", async () => {
    let assembled: PortableSpec | null = null;
    render(ScaleChildrenPlot, {
      useScaleColorDiscrete: true,
      // colorScheme omitted → undefined prop value path
      onrender: (_model: unknown, spec: PortableSpec) => {
        assembled = spec;
      },
    });
    const spec = await waitAssembled(() => assembled);
    expect(spec.scales?.color).toEqual({ type: "ordinal" });
    expect(spec.scales?.color).not.toHaveProperty("scheme");
  });

  it("15: <ScaleColorDiscrete/> + <ScaleColourContinuous/> → one DUPLICATE_SCALE_CHANNEL; last wins", async () => {
    const { diagnostics, ondiagnostic } = collect();
    let assembled: PortableSpec | null = null;
    render(ScaleChildrenPlot, {
      useScaleColorDiscrete: true,
      colorScheme: "colorblind",
      useScaleColourContinuous: true,
      ondiagnostic,
      onrender: (_model: unknown, spec: PortableSpec) => {
        assembled = spec;
      },
    });
    const spec = await waitAssembled(() => assembled);
    // Last child is ScaleColourContinuous → sequential color scale.
    expect(spec.scales?.color?.type).toBe("sequential");
    await expect
      .poll(() => diagnostics.filter((d) => d.code === "DUPLICATE_SCALE_CHANNEL"))
      .toHaveLength(1);
    const advisory = diagnostics.find((d) => d.code === "DUPLICATE_SCALE_CHANNEL")!;
    expect(isCompositionDiagnostic(advisory)).toBe(true);
    if (!isCompositionDiagnostic(advisory)) throw new Error("expected composition");
    expect(isDuplicateScaleChannelDiagnostic(advisory)).toBe(true);
    if (!isDuplicateScaleChannelDiagnostic(advisory)) throw new Error("expected scale variant");
    expect(advisory.channel).toBe("color");
    expect(advisory.kind).toBe("scale");
    expect(advisory.severity).toBe("advisory");
    // Parity with the sibling PlotDiagnostic variants: a consumer rendering
    // docUrl/suggestions over the union must not hit undefined here.
    expect(advisory.docUrl).toBe("https://ggts.sh/guide/upgrading#compose-scales-as-child-layers");
    expect(advisory.suggestions.length).toBeGreaterThan(0);
  });

  it("16: distinct channels (color + fill) fire no DUPLICATE_SCALE_CHANNEL", async () => {
    const { diagnostics, ondiagnostic } = collect();
    let assembled: PortableSpec | null = null;
    render(ScaleChildrenPlot, {
      useScaleColorDiscrete: true,
      colorScheme: "colorblind",
      useScaleFillContinuous: true,
      ondiagnostic,
      onrender: (_model: unknown, spec: PortableSpec) => {
        assembled = spec;
      },
    });
    await waitAssembled(() => assembled);
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(diagnostics.filter((d) => d.code === "DUPLICATE_SCALE_CHANNEL")).toHaveLength(0);
  });

  it("17: DUPLICATE_SCALE_CHANNEL fires once per channel across N reactive updates", async () => {
    const { diagnostics, ondiagnostic } = collect();
    const view = render(ScaleChildrenPlot, {
      useScaleColorDiscrete: true,
      colorScheme: "colorblind",
      useScaleColourContinuous: true,
      ondiagnostic,
    });
    await expect
      .poll(() => diagnostics.filter((d) => d.code === "DUPLICATE_SCALE_CHANNEL").length)
      .toBe(1);

    for (const next of ["observable10", "observable10", "ipsum", "flexoki"] as const) {
      await view.rerender({
        useScaleColorDiscrete: true,
        colorScheme: next,
        useScaleColourContinuous: true,
        ondiagnostic,
      });
      flushSync();
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    }
    expect(diagnostics.filter((d) => d.code === "DUPLICATE_SCALE_CHANNEL")).toHaveLength(1);
  });
});
