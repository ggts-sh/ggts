<script lang="ts">
  import {
    GeomPoint,
    GGPlot,
    Inspect,
    Labs,
    ThemeLight,
  } from "@ggts-sh/svelte";

  import { penguins } from "./data.js";

  let inspectionStatus = $state("Move across the plot or use the arrow keys.");
</script>

<!-- Inspection is opt-in. The default HTML tooltip, crosshair, keyboard
     traversal, and pinning all consume the same semantic event. -->
<GGPlot
  data={penguins}
  aes={{ x: "flipper", y: "mass", color: "species" }}
  oninspect={(event) => {
    inspectionStatus =
      event.phase === "clear"
        ? `Inspection cleared by ${event.source}.`
        : `${event.state === "pinned" ? "Pinned" : "Inspecting"} ${String(event.focus.row?.species ?? "datum")} · ${String(event.members.length)} member${event.members.length === 1 ? "" : "s"} · ${event.source}`;
  }}
  width="container"
  height={400}
>
  <GeomPoint size={4} alpha={0.85} />
  <ThemeLight />
  <Labs
    title="Inspect a shared x value, then pin"
    subtitle="333 penguins. Many share a flipper length"
    x="Flipper length (mm)"
    y="Body mass (g)"
    color="Species"
  />
  <Inspect mode="x" pin maxDistance={24} />
</GGPlot>

<!-- Visual callback evidence only. GGPlot owns the single concise live region. -->
<p class="event-status gg-demo-chrome">{inspectionStatus}</p>

<style>
  .event-status {
    max-width: 640px;
    margin: 0.6rem 0 0;
    color: var(--muted, #59636e);
    font: 0.82rem/1.4 var(--gg-font-family, system-ui, sans-serif);
  }
</style>
