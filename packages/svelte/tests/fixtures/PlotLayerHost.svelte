<script lang="ts">
  /**
   * GGPlot host for non-mark plot-layer tests. Optionally mounts a GeomPoint
   * child, a FactoryProbe (layer-local data), and one or more PlotLayerChild
   * non-mark registrations. Supports the layers prop so suppression can be
   * asserted against registry marks while non-mark layers still apply.
   */
  import type { ComponentProps } from "svelte";
  import type { AesInput, LayerInput } from "@ggts-sh/spec";

  import type { PortableSpec, RenderModel } from "../../src/lib/index.js";
  import GGPlot from "../../src/lib/GGPlot.svelte";
  import GeomPoint from "../../src/lib/geoms/GeomPoint.svelte";
  import PlotLayerChild from "./PlotLayerChild.svelte";
  import PlotLayerMarkWithData from "./PlotLayerMarkWithData.svelte";

  type PlotChild = ComponentProps<typeof PlotLayerChild>;

  const {
    data,
    aes = { x: "x", y: "y" },
    layers,
    point = false,
    markData,
    plotLayers = [],
    onrender,
    zoom = false,
    ondiagnostic,
    ...rest
  }: {
    data?: readonly Record<string, unknown>[];
    aes?: AesInput;
    layers?: LayerInput[];
    /** Mount a default <GeomPoint/> child. */
    point?: boolean;
    /** Mount a mark child with live layer-local data (#609). */
    markData?: readonly Record<string, unknown>[];
    plotLayers?: readonly PlotChild[];
    onrender?: (model: RenderModel, spec: PortableSpec) => void;
    zoom?: boolean | { mode?: "x" | "y" | "xy" };
    ondiagnostic?: (diagnostic: { code: string }) => void;
    [key: string]: unknown;
  } = $props();
</script>

<GGPlot
  {data}
  {aes}
  {layers}
  {onrender}
  {zoom}
  {ondiagnostic}
  width={480}
  height={320}
  {...rest}
>
  {#if point}
    <GeomPoint size={3} />
  {/if}
  {#if markData !== undefined}
    <PlotLayerMarkWithData data={markData} />
  {/if}
  {#each plotLayers as plotLayer, i (i)}
    <PlotLayerChild kind={plotLayer.kind} value={plotLayer.value} />
  {/each}
</GGPlot>
