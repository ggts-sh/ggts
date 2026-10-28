/**
 * Coord + facet children (#659 slice 5 / #704).
 * GGPlot coord/facet props removed in 0.13.0 — child layers only.
 */
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

import { type PortableSpec } from "../../src/lib/index.js";
import type { PlotDiagnostic } from "../../src/lib/diagnostics/deprecation.js";
import {
  isCompositionDiagnostic,
  isDuplicatePlotLayerDiagnostic,
} from "../../src/lib/diagnostics/composition.js";
import type { LayerRegistry } from "../../src/lib/geoms/registry.svelte.js";
import CoordFacetChildrenPlot from "../fixtures/CoordFacetChildrenPlot.svelte";
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

function assembleWithProps(props: Record<string, unknown>): Promise<PortableSpec> {
  let assembled: PortableSpec | null = null;
  render(CoordFacetChildrenPlot, {
    ...props,
    onrender: (_model: unknown, spec: PortableSpec) => {
      assembled = spec;
    },
    ondiagnostic: () => {},
  });
  return waitAssembled(() => assembled);
}

describe("Coord/Facet children → assembled PortableSpec", () => {
  it('1a: <CoordFlip/> assembles { type: "flip" }', async () => {
    const fromChild = await assembleWithProps({ useCoordFlip: true });
    expect(fromChild.coord).toEqual({ type: "flip" });
  });

  it("1b: <CoordFixed ratio={2}/> assembles fixed ratio 2", async () => {
    const fromChild = await assembleWithProps({ useCoordFixed: true, fixedRatio: 2 });
    expect(fromChild.coord).toEqual({ type: "fixed", ratio: 2 });
  });

  it('1b-sf: <CoordSf/> assembles { type: "sf" }', async () => {
    const fromChild = await assembleWithProps({ useCoordSf: true });
    expect(fromChild.coord).toEqual({ type: "sf" });
  });

  it("1b-sf-ratio: <CoordSf ratio={2}/> assembles sf ratio 2", async () => {
    const fromChild = await assembleWithProps({ useCoordSf: true, sfRatio: 2 });
    expect(fromChild.coord).toEqual({ type: "sf", ratio: 2 });
  });

  it('1c: <CoordTransform x="log10"/> assembles transform coord', async () => {
    const fromChild = await assembleWithProps({
      useCoordTransform: true,
      transformX: "log10",
    });
    expect(fromChild.coord?.type).toBe("transform");
    expect(fromChild.coord).toEqual({ type: "transform", x: { transform: "log10" } });
  });

  it('1d: <FacetWrap field="g"/> assembles wrap facet', async () => {
    const fromChild = await assembleWithProps({ useFacetWrap: true, facetField: "g" });
    expect(fromChild.facet?.wrap).toEqual({ field: "g" });
  });

  it('1e: <FacetGrid rows="a" cols="b"/> assembles grid facet', async () => {
    const fromChild = await assembleWithProps({
      useFacetGrid: true,
      facetRows: "a",
      facetCols: "b",
    });
    expect(fromChild.facet?.rows).toEqual({ field: "a" });
    expect(fromChild.facet?.cols).toEqual({ field: "b" });
  });

  it("1f: <Coord value/> escape hatch assembles the given coord", async () => {
    const fromChild = await assembleWithProps({
      useCoordValue: true,
      coordValue: { type: "fixed", ratio: 3 },
    });
    expect(fromChild.coord).toEqual({ type: "fixed", ratio: 3 });
  });

  it('1g: <Coord value="flip"/> canonicalises the bare string like <CoordFlip/>', async () => {
    const fromValue = await assembleWithProps({
      useCoordValue: true,
      coordValue: "flip",
    });
    const fromShell = await assembleWithProps({ useCoordFlip: true });
    expect(fromValue.coord).toEqual({ type: "flip" });
    expect(fromValue.coord).toEqual(fromShell.coord);
  });

  it("1h: <FacetWrap ncol/scales/strip> forwards every optional prop", async () => {
    const fromChild = await assembleWithProps({
      useFacetWrap: true,
      facetField: "g",
      facetNcol: 2,
      facetScales: "free_y",
      facetStrip: { position: "bottom", show: true },
    });
    expect(fromChild.facet?.wrap).toEqual({ field: "g" });
    expect(fromChild.facet?.ncol).toBe(2);
    expect(fromChild.facet?.scales).toBe("free_y");
    expect(fromChild.facet?.strip).toEqual({ position: "bottom", show: true });
  });

  it("1i: <FacetGrid scales/space/strip> forwards every optional prop", async () => {
    const fromChild = await assembleWithProps({
      useFacetGrid: true,
      facetRows: "a",
      facetCols: "b",
      facetScales: "free",
      facetSpace: "free_x",
      facetStrip: { position: "top", show: false },
    });
    expect(fromChild.facet?.rows).toEqual({ field: "a" });
    expect(fromChild.facet?.cols).toEqual({ field: "b" });
    expect(fromChild.facet?.scales).toBe("free");
    expect(fromChild.facet?.space).toBe("free_x");
    expect(fromChild.facet?.strip).toEqual({ position: "top", show: false });
  });

  it("1j: facet fields accept the object form, not just a bare string", async () => {
    const fromObject = await assembleWithProps({
      useFacetWrap: true,
      facetField: { field: "g" },
    });
    const fromString = await assembleWithProps({
      useFacetWrap: true,
      facetField: "g",
    });
    expect(fromObject.facet?.wrap).toEqual({ field: "g" });
    expect(fromObject.facet).toEqual(fromString.facet);
  });

  it("2: <CoordCartesian/> → assembled coord is ABSENT", async () => {
    const spec = await assembleWithProps({ useCoordCartesian: true });
    expect(spec.coord).toBeUndefined();
  });

  it("5: spec prop short-circuits with coord/facet children present", async () => {
    const spec = await assembleWithProps({
      useSpec: true,
      useCoordFlip: true,
      useFacetWrap: true,
    });
    // Spec embeds fixed ratio 3 and wrap g — children ignored.
    expect(spec.coord).toEqual({ type: "fixed", ratio: 3 });
    expect(spec.facet?.wrap).toEqual({ field: "g" });
  });

  it("6: layers prop + coord/facet child: marks from prop, non-mark children fold", async () => {
    const spec = await assembleWithProps({
      useLayersProp: true,
      useCoordFlip: true,
      useFacetWrap: true,
      facetField: "g",
    });
    expect(spec.layers).toHaveLength(1);
    expect(spec.layers[0]?.geom).toBe("point");
    expect(spec.coord).toEqual({ type: "flip" });
    expect(spec.facet?.wrap).toEqual({ field: "g" });
  });

  it("7a: two coord children → one DUPLICATE_PLOT_LAYER (kind coord); last wins", async () => {
    const { diagnostics, ondiagnostic } = collect();
    let assembled: PortableSpec | null = null;
    render(CoordFacetChildrenPlot, {
      useCoordFlip: true,
      useCoordFixed: true,
      fixedRatio: 2,
      ondiagnostic,
      onrender: (_model: unknown, spec: PortableSpec) => {
        assembled = spec;
      },
    });
    const spec = await waitAssembled(() => assembled);
    // Last registered is CoordFixed (after CoordFlip in the fixture).
    expect(spec.coord).toEqual({ type: "fixed", ratio: 2 });
    await expect
      .poll(() => diagnostics.filter((d) => d.code === "DUPLICATE_PLOT_LAYER"))
      .toHaveLength(1);
    const advisory = diagnostics.find((d) => d.code === "DUPLICATE_PLOT_LAYER")!;
    expect(isCompositionDiagnostic(advisory)).toBe(true);
    expect(isDuplicatePlotLayerDiagnostic(advisory)).toBe(true);
    if (!isDuplicatePlotLayerDiagnostic(advisory)) throw new Error("expected plot layer");
    expect(advisory.kind).toBe("coord");
    expect(advisory.severity).toBe("advisory");
    expect(advisory.docUrl).toContain("compose-coord-as-a-child-layer");
    expect(advisory.suggestions.length).toBeGreaterThan(0);
    // Scale-only field must not exist on the plot-layer variant.
    expect("channel" in advisory).toBe(false);
  });

  it("7b: FacetWrap + FacetGrid → one DUPLICATE_PLOT_LAYER (kind facet); last wins", async () => {
    const { diagnostics, ondiagnostic } = collect();
    let assembled: PortableSpec | null = null;
    render(CoordFacetChildrenPlot, {
      useFacetWrap: true,
      useFacetGrid: true,
      facetField: "g",
      facetRows: "a",
      facetCols: "b",
      ondiagnostic,
      onrender: (_model: unknown, spec: PortableSpec) => {
        assembled = spec;
      },
    });
    const spec = await waitAssembled(() => assembled);
    // FacetGrid is last → grid only.
    expect(spec.facet?.rows).toEqual({ field: "a" });
    expect(spec.facet?.wrap).toBeUndefined();
    await expect
      .poll(() => diagnostics.filter((d) => d.code === "DUPLICATE_PLOT_LAYER"))
      .toHaveLength(1);
    const advisory = diagnostics.find((d) => d.code === "DUPLICATE_PLOT_LAYER")!;
    if (!isDuplicatePlotLayerDiagnostic(advisory)) throw new Error("expected plot layer");
    expect(advisory.kind).toBe("facet");
  });

  it("7c: two theme children → one DUPLICATE_PLOT_LAYER (kind theme)", async () => {
    const { diagnostics, ondiagnostic } = collect();
    let assembled: PortableSpec | null = null;
    render(CoordFacetChildrenPlot, {
      useThemeDark: true,
      useThemeLight: true,
      ondiagnostic,
      onrender: (_model: unknown, spec: PortableSpec) => {
        assembled = spec;
      },
    });
    const spec = await waitAssembled(() => assembled);
    // Theme light is last in the fixture.
    expect(spec.theme).toBe("light");
    await expect
      .poll(() => diagnostics.filter((d) => d.code === "DUPLICATE_PLOT_LAYER"))
      .toHaveLength(1);
    const advisory = diagnostics.find((d) => d.code === "DUPLICATE_PLOT_LAYER")!;
    if (!isDuplicatePlotLayerDiagnostic(advisory)) throw new Error("expected plot layer");
    expect(advisory.kind).toBe("theme");
  });

  it("7d: coord dup AND facet dup → TWO advisories (dedup key is kind)", async () => {
    const { diagnostics, ondiagnostic } = collect();
    let assembled: PortableSpec | null = null;
    render(CoordFacetChildrenPlot, {
      useCoordFlip: true,
      useCoordFixed: true,
      fixedRatio: 2,
      useFacetWrap: true,
      useFacetGrid: true,
      ondiagnostic,
      onrender: (_model: unknown, spec: PortableSpec) => {
        assembled = spec;
      },
    });
    await waitAssembled(() => assembled);
    await expect
      .poll(() => diagnostics.filter((d) => d.code === "DUPLICATE_PLOT_LAYER").length)
      .toBe(2);
    const kinds = diagnostics
      .filter((d) => d.code === "DUPLICATE_PLOT_LAYER")
      .map((d) => (isDuplicatePlotLayerDiagnostic(d) ? d.kind : null));
    // Set comparison rather than sort(): the repo's lint config wants
    // Array#toSorted, which this TS lib target does not declare.
    expect(new Set(kinds)).toEqual(new Set(["coord", "facet"]));
  });

  it("8: live prop update changes assembled spec without re-registration", async () => {
    let assembled: PortableSpec | null = null;
    let host: LayerRegistry | undefined;
    const view = render(CoordFacetChildrenPlot, {
      useCoordFixed: true,
      fixedRatio: 1,
      captureRegistry: (registry: LayerRegistry) => {
        host = registry;
      },
      onrender: (_model: unknown, spec: PortableSpec) => {
        assembled = spec;
      },
    });
    await waitAssembled(() => assembled);
    // ratio 1 normalizes away from the object.
    expect(assembled!.coord).toEqual({ type: "fixed" });
    expect(host).toBeDefined();
    const countAfterInit = host!.registrationCount;
    expect(countAfterInit).toBeGreaterThan(0);

    assembled = null;
    await view.rerender({
      useCoordFixed: true,
      fixedRatio: 2,
      captureRegistry: (registry: LayerRegistry) => {
        host = registry;
      },
      onrender: (_model: unknown, spec: PortableSpec) => {
        assembled = spec;
      },
    });
    flushSync();
    await waitAssembled(() => assembled);
    expect(assembled!.coord).toEqual({ type: "fixed", ratio: 2 });
    expect(host!.registrationCount).toBe(countAfterInit);
  });

  it("9: bare <Facet/> fails loudly at validate (facet-form-missing)", () => {
    expect(() =>
      render(CoordFacetChildrenPlot, {
        useBareFacet: true,
      }),
    ).toThrow(/neither wrap nor rows\/cols|facet-form-missing/);
  });
});
