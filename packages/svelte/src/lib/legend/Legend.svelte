<script lang="ts">
  /**
   * <Legend> — declaration-only legend-options layer for <GGPlot>
   * (#659 slice 6). Today that is exactly one thing: `order`, the plot-wide
   * ENTRY-SORT enum ("stable-domain" | "present-first-seen" | "sorted").
   * Ordering never changes color assignments.
   *
   * Distinct from <GuideLegend order={2}/>, whose `order` is a per-aesthetic
   * INTEGER placement rank. Same word, unrelated concepts — do not fold them.
   * Legends style only through the theme, so there is nothing else here.
   *
   * Emits NO markup; registers a live legend layer during component init and
   * unregisters on destroy. Inert without a <GGPlot> ancestor.
   */
  import type { LegendSpec } from "@ggts-sh/spec";

  import {
    createPlotLayer,
    definedProps,
  } from "../layers/plot-layer.svelte.js";

  const props: LegendSpec = $props();
  createPlotLayer("legend", () => definedProps(props));
</script>
