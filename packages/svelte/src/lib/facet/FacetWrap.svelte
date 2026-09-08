<script lang="ts">
  /**
   * <FacetWrap> — declaration-only wrap-facet layer for <GGPlot> (#659 slice 5).
   * ggplot2-spelling shell over FacetInput wrap form. `field` accepts a bare
   * string or `{ field, levels?, labels? }`. Keep `strip` nested.
   * Emits NO markup.
   */
  import type { FacetFieldInput, FacetInput } from "@ggts-sh/spec";

  import {
    createPlotLayer,
    definedProps,
  } from "../layers/plot-layer.svelte.js";

  type Props = {
    field: FacetFieldInput;
    ncol?: number;
    scales?: FacetInput["scales"];
    strip?: FacetInput["strip"];
  };

  const props: Props = $props();
  createPlotLayer("facet", () => {
    const defined = definedProps(props);
    return {
      wrap: defined.field,
      ...(defined.ncol !== undefined && { ncol: defined.ncol }),
      ...(defined.scales !== undefined && { scales: defined.scales }),
      ...(defined.strip !== undefined && { strip: defined.strip }),
    };
  });
</script>
