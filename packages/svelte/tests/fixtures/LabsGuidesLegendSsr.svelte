<script lang="ts">
  /**
   * SSR fixture: <Labs> and <GuideNone> children. Titles and guide suppression
   * must land in the first server pass, not after hydration (#659 slice 6).
   */
  import GGPlot from "../../src/lib/GGPlot.svelte";
  import "../../src/lib/host-init.js";
  import GeomPoint from "../../src/lib/geoms/GeomPoint.svelte";
  import Labs from "../../src/lib/labs/Labs.svelte";
  import GuideNone from "../../src/lib/guides/GuideNone.svelte";

  const {
    mode = "labs",
  }: {
    mode?: "labs" | "guide-none";
  } = $props();

  const rows = [
    { x: 1, y: 2, region: "North" },
    { x: 2, y: 4, region: "South" },
  ];
</script>

{#if mode === "labs"}
  <GGPlot data={rows} aes={{ x: "x", y: "y" }} width={480} height={320}>
    <GeomPoint size={3} />
    <Labs title="Quarterly sales" x="Quarter" />
  </GGPlot>
{:else}
  <GGPlot
    data={rows}
    aes={{ x: "x", y: "y", color: "region" }}
    width={480}
    height={320}
  >
    <GeomPoint size={3} />
    <GuideNone channel="color" />
  </GGPlot>
{/if}
