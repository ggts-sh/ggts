<script lang="ts">
  import GGPlot from "../../src/lib/GGPlot.svelte";
  import "../../src/lib/host-init.js";

  const data = [
    { id: "a", x: 1, y: 3 },
    { id: "b", x: 2, y: 7 },
  ];
</script>

{#snippet tooltip(inspection: {
  focus: { row: Record<string, unknown> | null };
})}
  <div data-custom-tooltip>
    Custom value {String(inspection.focus.row?.["y"])}
  </div>
{/snippet}

<button type="button" data-outside>Outside control</button>
<GGPlot
  {data}
  aes={{ x: "x", y: "y" }}
  layers={[{ geom: "point" }]}
  key="id"
  inspect={{ content: tooltip, contentMode: "interactive" }}
  width={480}
  height={320}
/>
