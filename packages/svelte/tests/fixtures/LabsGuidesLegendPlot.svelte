<script lang="ts">
  /**
   * Host for labs/guides/legend child component tests (#659 slice 6).
   * Mounts GeomPoint + the keyed-MERGE grammar children under GGPlot and
   * optionally captures the plot registry for registrationCount assertions.
   */
  import type { GuidesSpec, LegendSpec } from "@ggts-sh/spec";

  import type { PlotDiagnostic } from "../../src/lib/diagnostics/deprecation.js";
  import type { PortableSpec, RenderModel } from "../../src/lib/index.js";
  import GGPlot from "../../src/lib/GGPlot.svelte";
  import GeomPoint from "../../src/lib/geoms/GeomPoint.svelte";
  import Labs from "../../src/lib/labs/Labs.svelte";
  import Legend from "../../src/lib/legend/Legend.svelte";
  import Scale from "../../src/lib/scale/Scale.svelte";
  import Guides from "../../src/lib/guides/Guides.svelte";
  import GuideAxis from "../../src/lib/guides/GuideAxis.svelte";
  import GuideColorbar from "../../src/lib/guides/GuideColorbar.svelte";
  import GuideColorsteps from "../../src/lib/guides/GuideColorsteps.svelte";
  import GuideLegend from "../../src/lib/guides/GuideLegend.svelte";
  import GuideNone from "../../src/lib/guides/GuideNone.svelte";
  import type {
    NonPositionGuideChannel,
    GuideChannel,
    PositionGuideChannel,
  } from "../../src/lib/guides/factory.svelte.js";
  import type { LayerRegistry } from "../../src/lib/geoms/registry.svelte.js";
  import ThemeRegistryCapture from "./ThemeRegistryCapture.svelte";

  const {
    useLabs = false,
    labsTitle,
    labsSubtitle,
    labsX,
    labsColor,
    useSecondLabs = false,
    secondLabsTitle,
    secondLabsY,
    useGuideAxis = false,
    useGuideLegend = false,
    useGuideColorbar = false,
    useGuideColorsteps = false,
    useGuideNone = false,
    useGuidesValue = false,
    guideChannel = "color",
    guidePosition,
    guidesValue,
    useSecondGuideNone = false,
    secondGuideChannel = "size",
    continuousColor = false,
    colorScaleType,
    scaleLocalGuideTitle,
    useLegend = false,
    useBareLegend = false,
    useSecondLegend = false,
    legendOrder = "sorted",
    secondLegendOrder = "stable-domain",
    guideOrder,
    useSpec = false,
    captureRegistry,
    onrender,
    ondiagnostic,
  }: {
    useLabs?: boolean;
    labsTitle?: string;
    labsSubtitle?: string;
    labsX?: string;
    labsColor?: string;
    useSecondLabs?: boolean;
    secondLabsTitle?: string;
    secondLabsY?: string;
    useGuideAxis?: boolean;
    useGuideLegend?: boolean;
    useGuideColorbar?: boolean;
    useGuideColorsteps?: boolean;
    useGuideNone?: boolean;
    useGuidesValue?: boolean;
    guideChannel?: GuideChannel;
    guidePosition?: "auto" | "right" | "bottom";
    guidesValue?: GuidesSpec;
    useSecondGuideNone?: boolean;
    secondGuideChannel?: GuideChannel;
    continuousColor?: boolean;
    colorScaleType?: "binned" | "sequential";
    scaleLocalGuideTitle?: string;
    useLegend?: boolean;
    useBareLegend?: boolean;
    /** Second <Legend> for DUPLICATE_MERGE_KEY delivery pins (#1408). */
    useSecondLegend?: boolean;
    legendOrder?: LegendSpec["order"];
    secondLegendOrder?: LegendSpec["order"];
    guideOrder?: number;
    useSpec?: boolean;
    captureRegistry?: (registry: LayerRegistry) => void;
    onrender?: (model: RenderModel, spec: PortableSpec) => void;
    ondiagnostic?: (diagnostic: PlotDiagnostic) => void;
  } = $props();

  const rows = [
    { x: 1, y: 2, c: "a", n: 10 },
    { x: 2, y: 4, c: "b", n: 20 },
  ];
</script>

{#if useSpec}
  <GGPlot
    spec={{
      data: { values: rows },
      layers: [{ geom: "point", aes: { x: "x", y: "y" } }],
      labs: { title: "from spec" },
    }}
    width={480}
    height={320}
    {onrender}
    {ondiagnostic}
  >
    {#if useLabs}
      <Labs title={labsTitle} />
    {/if}
  </GGPlot>
{:else}
  <GGPlot
    data={rows}
    aes={continuousColor
      ? { x: "x", y: "y", color: "n" }
      : { x: "x", y: "y", color: "c" }}
    width={480}
    height={320}
    {onrender}
    {ondiagnostic}
  >
    <GeomPoint size={3} />
    {#if useLabs}
      <Labs
        title={labsTitle}
        subtitle={labsSubtitle}
        x={labsX}
        color={labsColor}
      />
    {/if}
    {#if useSecondLabs}
      <Labs title={secondLabsTitle} y={secondLabsY} />
    {/if}
    {#if colorScaleType !== undefined}
      <Scale value={{ color: { type: colorScaleType } }} />
    {/if}
    {#if scaleLocalGuideTitle !== undefined}
      <Scale
        value={{
          color: { guide: { type: "legend", title: scaleLocalGuideTitle } },
        }}
      />
    {/if}
    {#if useLegend}
      <Legend order={legendOrder} />
    {/if}
    {#if useSecondLegend}
      <Legend order={secondLegendOrder} />
    {/if}
    {#if useBareLegend}
      <Legend order={undefined} />
    {/if}
    {#if useGuideAxis}
      <GuideAxis channel={guideChannel as PositionGuideChannel} />
    {/if}
    {#if useGuideLegend}
      <GuideLegend
        channel={guideChannel as NonPositionGuideChannel}
        position={guidePosition}
        order={guideOrder}
      />
    {/if}
    {#if useGuideColorbar}
      <GuideColorbar channel={guideChannel as NonPositionGuideChannel} />
    {/if}
    {#if useGuideColorsteps}
      <GuideColorsteps channel={guideChannel as NonPositionGuideChannel} />
    {/if}
    {#if useGuideNone}
      <GuideNone channel={guideChannel} />
    {/if}
    {#if useSecondGuideNone}
      <GuideNone channel={secondGuideChannel} />
    {/if}
    {#if useGuidesValue && guidesValue !== undefined}
      <Guides value={guidesValue} />
    {/if}
    {#if captureRegistry !== undefined}
      <ThemeRegistryCapture capture={captureRegistry} />
    {/if}
  </GGPlot>
{/if}
