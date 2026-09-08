<script lang="ts">
  /**
   * <Labs> — declaration-only labels layer for <GGPlot> (#659 slice 6).
   * The whole Labs surface: title, subtitle, caption, and the per-aesthetic
   * titles (x, y, color, fill, size, linewidth, alpha, shape, linetype).
   *
   * No separate escape hatch: Labs is a flat bag of strings, so
   * `<Labs {...computed} />` already covers the computed case.
   *
   * labs is a keyed-MERGE family — two <Labs> children merge key-by-key rather
   * than the second replacing the first. Two children setting the SAME key
   * emit a DUPLICATE_MERGE_KEY advisory (the later one still wins).
   *
   * Emits NO markup; registers a live labs layer during component init and
   * unregisters on destroy. Inert without a <GGPlot> ancestor.
   */
  // Aliased deliberately: svelte-package emits `declare const Labs` for this
  // component into Labs.svelte.d.ts, so a bare `import type { Labs }` here
  // collides with it in every consumer's svelte-check.
  import type { Labs as LabsSpec } from "@ggts-sh/spec";

  import {
    createPlotLayer,
    definedProps,
  } from "../layers/plot-layer.svelte.js";

  const props: LabsSpec = $props();
  createPlotLayer("labs", () => definedProps(props));
</script>
