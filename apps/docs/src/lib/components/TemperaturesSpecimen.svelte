<script lang="ts">
  import {
    GeomLine,
    GeomPoint,
    GGPlot,
    GuideLegend,
    Inspect,
    Labs,
    ScaleColorDiscrete,
    ScaleXContinuous,
    Theme,
  } from "@ggts-sh/svelte";
  import type { ThemeName } from "@ggts-sh/spec";

  import { docsAppearance } from "$lib/docs-appearance-state.svelte";
  import { marksOnlyThemeRoles } from "$lib/marks-only-theme-contrast";
  import type { SchemeName } from "$lib/theme-specimens/catalog";
  import { temperaturesKeyed } from "$lib/theme-specimens/data";
  import { TEMPERATURES_CHART } from "$lib/theme-specimens/temperatures-chart";

  const {
    theme,
    scheme,
    height,
    legendFocus,
    ariaLabel,
  }: {
    theme: ThemeName;
    scheme: SchemeName;
    height: number;
    legendFocus: boolean;
    ariaLabel: string;
  } = $props();

  const chart = TEMPERATURES_CHART;
  const themeRoles = $derived(
    marksOnlyThemeRoles(theme, docsAppearance.current),
  );
</script>

<GGPlot data={temperaturesKeyed} aes={chart.aes} {height} {ariaLabel}>
  <GeomLine linewidth={chart.geomLine.linewidth} />
  <GeomPoint size={chart.geomPoint.size} />
  <ScaleXContinuous breaks={[...chart.monthBreaks]} />
  <ScaleColorDiscrete {scheme} />
  <Theme name={theme} {...themeRoles} />
  {#if legendFocus}
    <GuideLegend channel="color" focus />
  {/if}
  <Labs
    title={chart.labs.title}
    x={chart.labs.x}
    y={chart.labs.y}
    color={chart.labs.color}
  />
  <Inspect mode="x" />
</GGPlot>
