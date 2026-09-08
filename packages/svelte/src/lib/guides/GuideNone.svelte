<script lang="ts">
  /**
   * <GuideNone> — declaration-only "suppress this guide" layer for <GGPlot>
   * (#659 slice 6). `<GuideNone channel="size"/>` hides the size legend.
   * Any aesthetic, positional or not. Emits NO markup.
   */
  import { guideNone } from "@ggts-sh/spec";

  import { createPlotLayer } from "../layers/plot-layer.svelte.js";
  import { splitChannel, type GuideChannel } from "./factory.svelte.js";

  type Props = { channel: GuideChannel };

  const props: Props = $props();
  createPlotLayer("guides", () => {
    const { channel } = splitChannel(props);
    return { [channel]: guideNone() };
  });
</script>
