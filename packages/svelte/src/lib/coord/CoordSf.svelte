<script lang="ts">
  /**
   * <CoordSf> — declaration-only simple-features fixed-aspect coordinate layer
   * for <GGPlot> (#809 phase 8). Accepts the same options as `coordSf(…)`.
   * Already-projected data only (no CRS reproject in v1). Emits NO markup.
   */
  import { coordSf, type CoordSfOptions } from "@ggts-sh/spec";

  import {
    createPlotLayer,
    definedProps,
  } from "../layers/plot-layer.svelte.js";

  const props: CoordSfOptions = $props();
  createPlotLayer("coord", () => coordSf(definedProps(props)));
</script>
