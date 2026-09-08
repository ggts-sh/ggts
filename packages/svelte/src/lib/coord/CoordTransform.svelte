<script lang="ts">
  /**
   * <CoordTransform> — declaration-only post-stat coordinate transform for
   * <GGPlot> (#659 slice 5). Accepts the same options as `coordTransform(…)`.
   * Emits NO markup.
   */
  import { coordTransform, type CoordTransformOptions } from "@ggts-sh/spec";

  import {
    createPlotLayer,
    definedProps,
  } from "../layers/plot-layer.svelte.js";

  const props: CoordTransformOptions = $props();
  createPlotLayer("coord", () => coordTransform(definedProps(props)));
</script>
