<script lang="ts">
  /**
   * <Scale> — declaration-only scale layer for <GGPlot> (#659).
   * Escape hatch: pass a whole `Scales` fragment via `value`. Named shells
   * (<ScaleColorDiscrete/>, <ScaleXContinuous/>, <ScaleSizeContinuous/>, …)
   * are preferred when the helper is known at authoring time; use this form
   * for raw fragments, computed scales, and variable references.
   *
   * Emits NO markup; registers a live scale layer during component init and
   * unregisters on destroy. Inert without a <GGPlot> ancestor.
   *
   * Byte-identity-preserving for raw fragments (D8): `value` is not routed
   * through a helper, so migrating `scales={{color:{scheme:"x"}}}` →
   * `<Scale value={{color:{scheme:"x"}}}/>` keeps PortableSpec bytes identical.
   */
  import type { Scales } from "@ggts-sh/spec";

  import { createPlotLayer } from "../layers/plot-layer.svelte.js";

  type Props = {
    value: Scales;
  };

  const props: Props = $props();
  createPlotLayer("scale", () => props.value);
</script>
