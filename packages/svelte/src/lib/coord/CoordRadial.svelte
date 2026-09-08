<script lang="ts">
  /**
   * <CoordRadial> — declaration-only polar/radial coordinate layer for
   * <GGPlot>. Accepts the same options as `coordRadial(…)`. Emits NO markup.
   * Also exported as `CoordPolar` (ggplot2 coord_polar alias shell).
   */
  import { coordRadial, type CoordRadialOptions } from "@ggts-sh/spec";

  import {
    createPlotLayer,
    definedProps,
  } from "../layers/plot-layer.svelte.js";

  const props: CoordRadialOptions = $props();
  createPlotLayer("coord", () => coordRadial(definedProps(props)));
</script>
