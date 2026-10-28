<script lang="ts">
  /**
   * SSR fixture: mark child + FacetWrap and/or CoordFlip. Facet strips and
   * flipped layout must land in the first server pass.
   */
  import GGPlot from "../../src/lib/GGPlot.svelte";
  import "../../src/lib/host-init.js";
  import GeomCol from "../../src/lib/geoms/GeomCol.svelte";
  import GeomPoint from "../../src/lib/geoms/GeomPoint.svelte";
  import CoordFlip from "../../src/lib/coord/CoordFlip.svelte";
  import FacetWrap from "../../src/lib/facet/FacetWrap.svelte";

  const {
    mode = "facet",
  }: {
    mode?: "facet" | "coord";
  } = $props();

  const facetRows = [
    { x: 1, y: 2, g: "alpha" },
    { x: 2, y: 4, g: "beta" },
  ];

  const colRows = [
    { cat: "one", v: 4 },
    { cat: "two", v: 8 },
  ];
</script>

{#if mode === "facet"}
  <GGPlot data={facetRows} aes={{ x: "x", y: "y" }} width={480} height={320}>
    <GeomPoint size={3} />
    <FacetWrap field="g" />
  </GGPlot>
{:else}
  <GGPlot data={colRows} aes={{ x: "cat", y: "v" }} width={480} height={320}>
    <GeomCol />
    <CoordFlip />
  </GGPlot>
{/if}
