<script lang="ts">
  import type { SceneLegend, ThemeTokens } from "@ggts-sh/core";

  import Legend from "../../src/lib/scene/Legend.svelte";

  const {
    legend,
    theme,
  }: {
    legend: SceneLegend;
    theme: ThemeTokens;
  } = $props();
</script>

<svg width="320" height="240">
  <Legend {legend} {theme} />
</svg>
