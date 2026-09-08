<script lang="ts">
  /**
   * <CoordFixed> — declaration-only fixed-aspect coordinate layer for
   * <GGPlot> (#659 slice 5). Accepts the same options as `coordFixed(…)`.
   * Also exported as `CoordEqual` (alias of `coordEqual = coordFixed`).
   * Emits NO markup.
   */
  import { coordFixed, type CoordFixedOptions } from "@ggts-sh/spec";

  import {
    createPlotLayer,
    definedProps,
  } from "../layers/plot-layer.svelte.js";

  const props: CoordFixedOptions = $props();
  createPlotLayer("coord", () => coordFixed(definedProps(props)));
</script>
