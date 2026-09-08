<script lang="ts">
  /**
   * <Coord> — declaration-only coordinate layer for <GGPlot> (#659 slice 5).
   * Escape hatch: pass a whole `CoordSpec | "flip"` via `value`. Named shells
   * (<CoordFlip/>, <CoordFixed/>, …) are preferred when the form is known at
   * authoring time; use this for computed fragments or variable references.
   *
   * Emits NO markup; registers a live coord layer during component init and
   * unregisters on destroy. Inert without a <GGPlot> ancestor.
   */
  import type { CoordSpec } from "@ggts-sh/spec";

  import { createPlotLayer } from "../layers/plot-layer.svelte.js";

  type Props = {
    value: CoordSpec | "flip";
  };

  const props: Props = $props();
  createPlotLayer("coord", () => props.value);
</script>
