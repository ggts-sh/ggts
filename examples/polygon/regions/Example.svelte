<script lang="ts">
  import {
    CoordFixed,
    GeomPoint,
    GeomPolygon,
    GGPlot,
    GuideNone,
    Inspect,
    Labs,
    ThemeClassic,
  } from "@ggts-sh/svelte";

  import { pumpNeighbourhoods, waterPumps } from "./data.js";
</script>

<GGPlot
  data={pumpNeighbourhoods}
  aes={{ x: "x", y: "y", group: "pump", fill: "pump" }}
  width={640}
  height={400}
>
  <GeomPolygon alpha={0.55} linewidth={1.2} />
  <GeomPoint
    data={waterPumps}
    aes={{ x: "x", y: "y", color: { value: "#111827" } }}
    size={3.6}
    shape="cross"
  />
  <CoordFixed />
  <ThemeClassic />
  <GuideNone channel="fill" />
  <Labs
    title="Which pump was nearest"
    subtitle="Soho split into the thirteen areas closest to each public pump, 1854"
    x="Map east"
    y="Map north"
  />
  <Inspect mode="exact" pin />
</GGPlot>
