<script lang="ts">
  /**
   * Host for coord/facet child component tests (#659 slice 5).
   * Mounts GeomPoint (or GeomCol for flip) + Coord and Facet children under GGPlot
   * and optionally captures the plot registry for registrationCount assertions.
   */
  import type { CoordSpec, FacetInput } from "@ggts-sh/spec";

  import type { PlotDiagnostic } from "../../src/lib/diagnostics/deprecation.js";
  import type { PortableSpec, RenderModel } from "../../src/lib/index.js";
  import GGPlot from "../../src/lib/GGPlot.svelte";
  import GeomCol from "../../src/lib/geoms/GeomCol.svelte";
  import GeomPoint from "../../src/lib/geoms/GeomPoint.svelte";
  import Coord from "../../src/lib/coord/Coord.svelte";
  import CoordCartesian from "../../src/lib/coord/CoordCartesian.svelte";
  import CoordFixed from "../../src/lib/coord/CoordFixed.svelte";
  import CoordFlip from "../../src/lib/coord/CoordFlip.svelte";
  import CoordSf from "../../src/lib/coord/CoordSf.svelte";
  import CoordTransform from "../../src/lib/coord/CoordTransform.svelte";
  import Facet from "../../src/lib/facet/Facet.svelte";
  import FacetGrid from "../../src/lib/facet/FacetGrid.svelte";
  import FacetWrap from "../../src/lib/facet/FacetWrap.svelte";
  import Theme from "../../src/lib/theme/Theme.svelte";
  import ThemeDark from "../../src/lib/theme/ThemeDark.svelte";
  import ThemeRegistryCapture from "./ThemeRegistryCapture.svelte";
  import type { LayerRegistry } from "../../src/lib/geoms/registry.svelte.js";

  const {
    useCoordFlip = false,
    useCoordFixed = false,
    useCoordSf = false,
    useCoordTransform = false,
    useCoordCartesian = false,
    useCoordValue = false,
    coordValue,
    fixedRatio,
    sfRatio,
    transformX,
    transformY,
    transformClip,
    useSecondCoordFlip = false,
    useFacetWrap = false,
    useFacetGrid = false,
    useBareFacet = false,
    useGenericFacet = false,
    facetField = "g",
    facetRows = "a",
    facetCols = "b",
    facetNcol,
    facetScales,
    facetStrip,
    genericFacet,
    useThemeDark = false,
    useThemeLight = false,
    useSpec = false,
    useLayersProp = false,
    useColGeom = false,
    captureRegistry,
    onrender,
    ondiagnostic,
  }: {
    useCoordFlip?: boolean;
    useCoordFixed?: boolean;
    useCoordSf?: boolean;
    useCoordTransform?: boolean;
    useCoordCartesian?: boolean;
    useCoordValue?: boolean;
    coordValue?: CoordSpec | "flip";
    fixedRatio?: number;
    sfRatio?: number;
    transformX?: string;
    transformY?: string;
    transformClip?: boolean;
    useSecondCoordFlip?: boolean;
    useFacetWrap?: boolean;
    useFacetGrid?: boolean;
    useBareFacet?: boolean;
    useGenericFacet?: boolean;
    facetField?: string | { field: string };
    facetRows?: string | { field: string };
    facetCols?: string | { field: string };
    facetNcol?: number;
    facetScales?: FacetInput["scales"];
    facetStrip?: FacetInput["strip"];
    genericFacet?: FacetInput;
    useThemeDark?: boolean;
    useThemeLight?: boolean;
    useSpec?: boolean;
    useLayersProp?: boolean;
    useColGeom?: boolean;
    captureRegistry?: (registry: LayerRegistry) => void;
    onrender?: (model: RenderModel, spec: PortableSpec) => void;
    ondiagnostic?: (diagnostic: PlotDiagnostic) => void;
  } = $props();

  const rows = [
    { x: 1, y: 2, g: "p1", a: "r1", b: "c1", cat: "one", v: 4 },
    { x: 2, y: 4, g: "p2", a: "r2", b: "c2", cat: "two", v: 8 },
  ];

  const layersProp = [{ geom: "point" as const, aes: { x: "x", y: "y" } }];
</script>

{#if useSpec}
  <GGPlot
    spec={{
      data: { values: rows },
      layers: [{ geom: "point", aes: { x: "x", y: "y" } }],
      coord: { type: "fixed", ratio: 3 },
      facet: { wrap: { field: "g" } },
    }}
    width={480}
    height={320}
    {onrender}
    {ondiagnostic}
  >
    {#if useCoordFlip}
      <CoordFlip />
    {/if}
    {#if useFacetWrap}
      <FacetWrap field="g" />
    {/if}
  </GGPlot>
{:else if useLayersProp}
  <GGPlot
    data={rows}
    aes={{ x: "x", y: "y" }}
    layers={layersProp}
    width={480}
    height={320}
    {onrender}
    {ondiagnostic}
  >
    {#if useCoordFlip}
      <CoordFlip />
    {/if}
    {#if useFacetWrap}
      <FacetWrap field={facetField} />
    {/if}
  </GGPlot>
{:else}
  <GGPlot
    data={rows}
    aes={useColGeom ? { x: "cat", y: "v" } : { x: "x", y: "y" }}
    width={480}
    height={320}
    {onrender}
    {ondiagnostic}
  >
    {#if useColGeom}
      <GeomCol />
    {:else}
      <GeomPoint size={3} />
    {/if}
    {#if useCoordFlip}
      <CoordFlip />
    {/if}
    {#if useSecondCoordFlip}
      <CoordFlip />
    {/if}
    {#if useCoordFixed}
      <CoordFixed ratio={fixedRatio} />
    {/if}
    {#if useCoordSf && sfRatio !== undefined}
      <CoordSf ratio={sfRatio} />
    {:else if useCoordSf}
      <CoordSf />
    {/if}
    {#if useCoordTransform}
      <CoordTransform x={transformX} y={transformY} clip={transformClip} />
    {/if}
    {#if useCoordCartesian}
      <CoordCartesian />
    {/if}
    {#if useCoordValue && coordValue !== undefined}
      <Coord value={coordValue} />
    {/if}
    {#if useFacetWrap}
      <FacetWrap
        field={facetField}
        ncol={facetNcol}
        scales={facetScales}
        strip={facetStrip}
      />
    {/if}
    {#if useFacetGrid}
      <FacetGrid
        rows={facetRows}
        cols={facetCols}
        scales={facetScales}
        strip={facetStrip}
      />
    {/if}
    {#if useBareFacet}
      <Facet />
    {/if}
    {#if useGenericFacet && genericFacet !== undefined}
      <Facet
        wrap={genericFacet.wrap}
        rows={genericFacet.rows}
        cols={genericFacet.cols}
        ncol={genericFacet.ncol}
        scales={genericFacet.scales}
        strip={genericFacet.strip}
      />
    {/if}
    {#if useThemeDark}
      <ThemeDark />
    {/if}
    {#if useThemeLight}
      <Theme name="light" />
    {/if}
    {#if captureRegistry !== undefined}
      <ThemeRegistryCapture capture={captureRegistry} />
    {/if}
  </GGPlot>
{/if}
