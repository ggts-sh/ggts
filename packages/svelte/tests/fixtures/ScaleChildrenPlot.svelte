<script lang="ts">
  /**
   * Host for scale-child component tests (#659 slice 3).
   * Mounts GeomPoint + Scale / ScaleColor* children under GGPlot and optionally
   * captures the plot registry for registrationCount assertions.
   */
  import type { Scales } from "@ggts-sh/spec";

  import type { PlotDiagnostic } from "../../src/lib/diagnostics/deprecation.js";
  import type { PortableSpec, RenderModel } from "../../src/lib/index.js";
  import GGPlot from "../../src/lib/GGPlot.svelte";
  import GeomPoint from "../../src/lib/geoms/GeomPoint.svelte";
  import Scale from "../../src/lib/scale/Scale.svelte";
  import ScaleColorContinuous from "../../src/lib/scale/ScaleColorContinuous.svelte";
  import ScaleColorDiscrete from "../../src/lib/scale/ScaleColorDiscrete.svelte";
  import ScaleColourContinuous from "../../src/lib/scale/ScaleColorContinuous.svelte";
  import ScaleFillContinuous from "../../src/lib/scale/ScaleFillContinuous.svelte";
  import ThemeRegistryCapture from "./ThemeRegistryCapture.svelte";
  import type { LayerRegistry } from "../../src/lib/geoms/registry.svelte.js";

  const {
    scaleValue,
    colorScheme,
    useScaleColorDiscrete = false,
    useScaleColorContinuous = false,
    useScaleColourContinuous = false,
    useScaleFillContinuous = false,
    useGenericScale = false,
    useSpec = false,
    useLayersProp = false,
    captureRegistry,
    onrender,
    ondiagnostic,
  }: {
    scaleValue?: Scales;
    colorScheme?: string;
    useScaleColorDiscrete?: boolean;
    useScaleColorContinuous?: boolean;
    useScaleColourContinuous?: boolean;
    useScaleFillContinuous?: boolean;
    useGenericScale?: boolean;
    useSpec?: boolean;
    useLayersProp?: boolean;
    captureRegistry?: (registry: LayerRegistry) => void;
    onrender?: (model: RenderModel, spec: PortableSpec) => void;
    ondiagnostic?: (diagnostic: PlotDiagnostic) => void;
  } = $props();

  const rows = [
    { x: 1, y: 2, c: "a", f: "x" },
    { x: 2, y: 4, c: "b", f: "y" },
  ];

  const layersProp = [
    { geom: "point" as const, aes: { x: "x", y: "y", color: "c" } },
  ];
</script>

{#if useSpec}
  <GGPlot
    spec={{
      data: { values: rows },
      layers: [{ geom: "point", aes: { x: "x", y: "y", color: "c" } }],
      scales: { color: { type: "ordinal", scheme: "observable10" } },
    }}
    width={480}
    height={320}
    {onrender}
    {ondiagnostic}
  >
    {#if useScaleColorDiscrete}
      <ScaleColorDiscrete scheme="colorblind" />
    {/if}
  </GGPlot>
{:else if useLayersProp}
  <GGPlot
    data={rows}
    aes={{ x: "x", y: "y", color: "c" }}
    layers={layersProp}
    width={480}
    height={320}
    {onrender}
    {ondiagnostic}
  >
    {#if useScaleColorDiscrete}
      <ScaleColorDiscrete scheme={colorScheme ?? "colorblind"} />
    {/if}
  </GGPlot>
{:else}
  <GGPlot
    data={rows}
    aes={{ x: "x", y: "y", color: "c", fill: "f" }}
    width={480}
    height={320}
    {onrender}
    {ondiagnostic}
  >
    <GeomPoint size={3} />
    {#if useScaleColorDiscrete}
      <ScaleColorDiscrete scheme={colorScheme} />
    {/if}
    {#if useScaleColorContinuous}
      <ScaleColorContinuous />
    {/if}
    {#if useScaleColourContinuous}
      <ScaleColourContinuous />
    {/if}
    {#if useScaleFillContinuous}
      <ScaleFillContinuous />
    {/if}
    {#if useGenericScale && scaleValue !== undefined}
      <Scale value={scaleValue} />
    {/if}
    {#if captureRegistry !== undefined}
      <ThemeRegistryCapture capture={captureRegistry} />
    {/if}
  </GGPlot>
{/if}
