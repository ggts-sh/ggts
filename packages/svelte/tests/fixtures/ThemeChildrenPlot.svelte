<script lang="ts">
  /**
   * Host for theme-child component tests (#659 slice 2 / #704).
   * Mounts GeomPoint + Theme/ThemeDark children under GGPlot and optionally
   * captures the plot registry for registrationCount assertions.
   */
  import type { ThemeName } from "@ggts-sh/spec";

  import type { PlotDiagnostic } from "../../src/lib/diagnostics/deprecation.js";
  import type { PortableSpec, RenderModel } from "../../src/lib/index.js";
  import GGPlot from "../../src/lib/GGPlot.svelte";
  import GeomPoint from "../../src/lib/geoms/GeomPoint.svelte";
  import Theme from "../../src/lib/theme/Theme.svelte";
  import ThemeDark from "../../src/lib/theme/ThemeDark.svelte";
  import ThemeRegistryCapture from "./ThemeRegistryCapture.svelte";
  import type { LayerRegistry } from "../../src/lib/geoms/registry.svelte.js";

  const {
    themeName,
    themeInk,
    useThemeDark = false,
    useThemeDarkInk,
    useGenericTheme = false,
    useSpec = false,
    captureRegistry,
    onrender,
    ondiagnostic,
  }: {
    themeName?: ThemeName;
    themeInk?: string;
    useThemeDark?: boolean;
    useThemeDarkInk?: string;
    useGenericTheme?: boolean;
    useSpec?: boolean;
    captureRegistry?: (registry: LayerRegistry) => void;
    onrender?: (model: RenderModel, spec: PortableSpec) => void;
    ondiagnostic?: (diagnostic: PlotDiagnostic) => void;
  } = $props();

  const rows = [
    { x: 1, y: 2 },
    { x: 2, y: 4 },
  ];
</script>

{#if useSpec}
  <GGPlot
    spec={{
      data: { values: rows },
      layers: [{ geom: "point", aes: { x: "x", y: "y" } }],
      theme: "light",
    }}
    width={480}
    height={320}
    {onrender}
    {ondiagnostic}
  >
    {#if useThemeDark}
      <ThemeDark />
    {/if}
  </GGPlot>
{:else}
  <GGPlot
    data={rows}
    aes={{ x: "x", y: "y" }}
    width={480}
    height={320}
    {onrender}
    {ondiagnostic}
  >
    <GeomPoint size={3} />
    {#if useThemeDark && useThemeDarkInk !== undefined}
      <ThemeDark ink={useThemeDarkInk} />
    {:else if useThemeDark}
      <ThemeDark />
    {/if}
    {#if useGenericTheme}
      <Theme name={themeName} ink={themeInk} />
    {/if}
    {#if captureRegistry !== undefined}
      <ThemeRegistryCapture capture={captureRegistry} />
    {/if}
  </GGPlot>
{/if}
