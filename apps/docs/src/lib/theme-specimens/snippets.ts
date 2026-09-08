/**
 * Consumer-facing code fragments for the palettes page.
 * Kept outside .svelte so the compiler never sees a literal </script> close tag.
 */

export const SEQUENTIAL_RASTER_SNIPPET = `<script lang="ts">
  import { GeomRaster, GGPlot, Labs, Scale } from "@ggts-sh/svelte";

  // Macdonell man-count grid (48 cells in the live demos).
  const grid = [
    { x: 0, y: 0, z: 12 },
    { x: 1, y: 0, z: 28 },
    { x: 2, y: 0, z: 41 },
    // …
  ];
</script>

<GGPlot
  data={grid}
  aes={{ x: "x", y: "y", fill: "z" }}
  height={400}
>
  <Scale
    value={{
      fill: { type: "sequential", scheme: "viridis" },
      // reverse: true
      // domain: [15, 40]  // pin inside actual man counts
      // range: ["#2d1e2f", "#3d5a80", "#e76f51"]
    }}
  />
  <Labs title="Macdonell stature × finger counts" x="Finger index" y="Height index" />
  <GeomRaster />
</GGPlot>`;
