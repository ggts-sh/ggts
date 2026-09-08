<script lang="ts">
  /**
   * <Facet> — declaration-only facet layer for <GGPlot> (#659 slice 5).
   * Complete FacetInput surface (escape hatch + general form): wrap | rows/cols,
   * ncol, scales, strip. Named shells (<FacetWrap/>, <FacetGrid/>) are preferred
   * when the form is known at authoring time.
   *
   * Bare `<Facet/>` with no wrap/rows/cols registers an empty facet and fails
   * at validate with `facet-form-missing` — do not silently no-op.
   *
   * Emits NO markup; registers a live facet layer during component init and
   * unregisters on destroy. Inert without a <GGPlot> ancestor.
   */
  import type { FacetInput } from "@ggts-sh/spec";

  import {
    createPlotLayer,
    definedProps,
  } from "../layers/plot-layer.svelte.js";

  const props: FacetInput = $props();
  createPlotLayer("facet", () => definedProps(props));
</script>
