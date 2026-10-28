<script lang="ts">
  /**
   * Dynamic host for scale-child parity tests (#659 slice 4).
   * Mounts an arbitrary scale shell component under <GGPlot> with the given
   * props — avoids 63 boolean flags on ScaleChildrenPlot.
   */
  import type { Component } from "svelte";

  import type { PlotDiagnostic } from "../../src/lib/diagnostics/deprecation.js";
  import type { PortableSpec, RenderModel } from "../../src/lib/index.js";
  import GGPlot from "../../src/lib/GGPlot.svelte";
  import "../../src/lib/host-init.js";
  import GeomPoint from "../../src/lib/geoms/GeomPoint.svelte";
  import type { LayerRegistry } from "../../src/lib/geoms/registry.svelte.js";
  import ThemeRegistryCapture from "./ThemeRegistryCapture.svelte";

  const {
    Shell,
    shellProps = {},
    ShellB,
    shellBProps = {},
    captureRegistry,
    onrender,
    ondiagnostic,
  }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- shell prop bags vary per helper
    Shell: Component<any>;
    shellProps?: Record<string, unknown>;
    ShellB?: Component<any>;
    shellBProps?: Record<string, unknown>;
    captureRegistry?: (registry: LayerRegistry) => void;
    onrender?: (model: RenderModel, spec: PortableSpec) => void;
    ondiagnostic?: (diagnostic: PlotDiagnostic) => void;
  } = $props();

  // Aes channels point actually consumes (STYLE_AESTHETIC_GEOMS). Scales for
  // linewidth/linetype still register without a mapped channel — the pipeline
  // only rejects unconsumed aes mappings, not orphan scale fragments.
  const rows = [
    { x: 1, y: 2, c: "a", f: "x", s: 1, sh: "a" },
    { x: 2, y: 4, c: "b", f: "y", s: 2, sh: "b" },
  ];
</script>

<GGPlot
  data={rows}
  aes={{ x: "x", y: "y", color: "c", fill: "f", size: "s", shape: "sh" }}
  width={480}
  height={320}
  {onrender}
  {ondiagnostic}
>
  <GeomPoint size={3} />
  <Shell {...shellProps} />
  {#if ShellB !== undefined}
    <ShellB {...shellBProps} />
  {/if}
  {#if captureRegistry !== undefined}
    <ThemeRegistryCapture capture={captureRegistry} />
  {/if}
</GGPlot>
