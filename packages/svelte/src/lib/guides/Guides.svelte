<script lang="ts">
  /**
   * <Guides> — declaration-only escape hatch for the whole GuidesSpec
   * (#659 slice 6). For raw fragments and computed multi-channel guide bags;
   * prefer the keyed shells (<GuideLegend channel="color"/>, …) when the shape
   * is known at authoring time. Emits NO markup.
   */
  import type { GuidesSpec } from "@ggts-sh/spec";

  import { createPlotLayer } from "../layers/plot-layer.svelte.js";

  const { value }: { value: GuidesSpec } = $props();
  createPlotLayer("guides", () => value);
</script>
