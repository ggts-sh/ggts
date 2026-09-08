<script lang="ts">
  /**
   * <FacetGrid> — declaration-only grid-facet layer for <GGPlot> (#659 slice 5).
   * ggplot2-spelling shell over FacetInput rows/cols form. `rows`/`cols` accept
   * a bare string or `{ field, levels?, labels? }`. Keep `strip` nested.
   * Emits NO markup.
   */
  import type { FacetFieldInput, FacetInput } from "@ggts-sh/spec";

  import {
    createPlotLayer,
    definedProps,
  } from "../layers/plot-layer.svelte.js";

  type Props = {
    rows?: FacetFieldInput;
    cols?: FacetFieldInput;
    scales?: FacetInput["scales"];
    strip?: FacetInput["strip"];
  };

  const props: Props = $props();
  createPlotLayer("facet", () => {
    const defined = definedProps(props);
    return {
      ...(defined.rows !== undefined && { rows: defined.rows }),
      ...(defined.cols !== undefined && { cols: defined.cols }),
      ...(defined.scales !== undefined && { scales: defined.scales }),
      ...(defined.strip !== undefined && { strip: defined.strip }),
    };
  });
</script>
