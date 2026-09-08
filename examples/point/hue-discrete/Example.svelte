<script lang="ts">
  import {
    GeomPoint,
    GGPlot,
    Inspect,
    Labs,
    ScaleColorHue,
    ThemeMinimal,
  } from "@ggts-sh/svelte";

  import { armadaSquadrons } from "./data.js";
</script>

<GGPlot
  data={armadaSquadrons}
  aes={{ x: "ships", y: "men", color: "squadron" }}
  width={640}
  height={400}
>
  <GeomPoint size={5} />
  <ScaleColorHue />
  <ThemeMinimal />
  <Labs
    title="Scatter coloured by discrete group"
    subtitle="Ten squadrons by ships and men"
    x="Ships"
    y="Soldiers and sailors"
    color="Squadron"
  />
  <Inspect mode="xy" pin maxDistance={24} />
</GGPlot>
