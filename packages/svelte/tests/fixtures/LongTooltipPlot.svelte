<script lang="ts">
  import type { RenderModel } from "@ggts-sh/core";
  import GGPlot from "../../src/lib/GGPlot.svelte";
  import type { PlotInspectionChange } from "../../src/lib/interaction/interaction.js";

  const data = [
    { id: "bottom-left", x: 0, y: 0 },
    { id: "top-left", x: 0, y: 1 },
    { id: "middle", x: 0.6, y: 0.5 },
    { id: "bottom-right", x: 1, y: 0 },
    { id: "top-right", x: 1, y: 1 },
  ];
  let candidates = $state<Array<{ x: number; y: number }>>([]);
</script>

{#snippet content(_inspection: PlotInspectionChange)}
  <div class="long-custom-content">
    A deliberately long custom tooltip value that must wrap and remain inside
    every transformed plot edge without relying on a guessed anchor threshold.
  </div>
{/snippet}

<output data-candidates>{JSON.stringify(candidates)}</output>
<GGPlot
  {data}
  aes={{ x: "x", y: "y" }}
  layers={[{ geom: "point" }]}
  key="id"
  inspect={{ content, contentMode: "interactive" }}
  onrender={(model: RenderModel) => {
    candidates = Array.from({ length: model.candidates.size }, (_, id) => {
      const candidate = model.candidates.candidate(id)!;
      return { x: candidate.x, y: candidate.y };
    });
  }}
  width={480}
  height={320}
/>

<style>
  .long-custom-content {
    width: 260px;
  }
</style>
