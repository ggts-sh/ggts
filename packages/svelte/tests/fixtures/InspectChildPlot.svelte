<script lang="ts">
  /**
   * Host for <Inspect> capability-child tests.
   * Captures registry and onrender interaction via diagnostics / callbacks.
   */
  import type { PlotDiagnostic } from "../../src/lib/diagnostics/deprecation.js";
  import type { PortableSpec } from "../../src/lib/index.js";
  import GGPlot from "../../src/lib/GGPlot.svelte";
  import GeomPoint from "../../src/lib/geoms/GeomPoint.svelte";
  import Inspect from "../../src/lib/inspection/Inspect.svelte";
  import type { LayerRegistry } from "../../src/lib/geoms/registry.svelte.js";
  import type {
    InspectMode,
    TooltipTotal,
  } from "../../src/lib/interaction/interaction.js";

  import ThemeRegistryCapture from "./ThemeRegistryCapture.svelte";

  const {
    useInspect = false,
    inspectMode,
    useSecondInspect = false,
    secondInspectMode,
    propInspect,
    inspectIdentity,
    inspectTooltipTotal,

    captureRegistry,
    onrender,
    ondiagnostic,
    oninspect,
  }: {
    useInspect?: boolean;
    inspectMode?: InspectMode;
    useSecondInspect?: boolean;
    secondInspectMode?: InspectMode;
    propInspect?: boolean | { mode?: InspectMode; identity?: PropertyKey };
    inspectIdentity?: PropertyKey;
    inspectTooltipTotal?: TooltipTotal;

    captureRegistry?: (registry: LayerRegistry) => void;
    onrender?: (model: unknown, spec: PortableSpec) => void;
    ondiagnostic?: (diagnostic: PlotDiagnostic) => void;
    oninspect?: (event: unknown) => void;
  } = $props();

  const data = [
    { x: 1, y: 2 },
    { x: 2, y: 3 },
  ];
</script>

<GGPlot
  {data}
  aes={{ x: "x", y: "y" }}
  width={200}
  height={150}
  inspect={propInspect}
  {onrender}
  {ondiagnostic}
  {oninspect}
>
  {#if captureRegistry}
    <ThemeRegistryCapture capture={captureRegistry} />
  {/if}
  {#if useInspect}
    <Inspect
      mode={inspectMode}
      identity={inspectIdentity}
      tooltipTotal={inspectTooltipTotal}
    />
  {/if}
  {#if useSecondInspect}
    <Inspect mode={secondInspectMode} />
  {/if}
  <GeomPoint />
</GGPlot>
