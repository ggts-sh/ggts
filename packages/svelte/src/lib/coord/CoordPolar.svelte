<script lang="ts">
  /**
   * <CoordPolar> — ggplot2 coord_polar alias for polar coordinates.
   * Emits `{ type: "radial", clip: true, … }` via `coordPolar(…)`.
   * Prefer <CoordRadial> for new work (partial arcs, inner radius, reverse).
   */
  import { coordPolar, type CoordPolarOptions } from "@ggts-sh/spec";

  import {
    createPlotLayer,
    definedProps,
  } from "../layers/plot-layer.svelte.js";

  const props: CoordPolarOptions = $props();
  createPlotLayer("coord", () => coordPolar(definedProps(props)));
</script>
