<script lang="ts">
  import type { RenderModel } from "@ggts-sh/core";
  import GGPlot from "../../src/lib/GGPlot.svelte";

  let plot: {
    setZoom: (domains: { x?: [number, number]; y?: [number, number] }) => void;
  };
  let model = $state<RenderModel | null>(null);
  const data = [
    { x: 1, y: 10 },
    { x: 2, y: 20 },
    { x: 3, y: 30 },
  ];
</script>

<button
  type="button"
  data-zoom-x
  onclick={() => plot.setZoom({ x: [1.5, 2.5] })}>Zoom x</button
>
<button type="button" data-zoom-y onclick={() => plot.setZoom({ y: [12, 18] })}
  >Zoom y</button
>
<output data-x-domain>{model?.domains.effective.x.join(",")}</output>
<output data-y-domain>{model?.domains.effective.y.join(",")}</output>
<GGPlot
  bind:this={plot}
  {data}
  aes={{ x: "x", y: "y" }}
  layers={[{ geom: "point" }]}
  zoom={true}
  onrender={(next) => (model = next)}
  width={480}
  height={320}
/>
