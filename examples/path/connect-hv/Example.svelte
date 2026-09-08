<script lang="ts">
  import {
    GeomPath,
    GeomPoint,
    GGPlot,
    Inspect,
    Labs,
    registerConnect,
    ScaleXContinuous,
    ThemeClassic,
  } from "@ggts-sh/svelte";

  // stat= override: the shell registers only its default stat (#1420).
  registerConnect();

  import { retreatCold } from "./data.js";
</script>

<GGPlot
  data={retreatCold}
  aes={{ x: "long", y: "temp" }}
  width={640}
  height={400}
>
  <GeomPath stat="connect" connection="hv" linewidth={2.5} alpha={0.95} />
  <GeomPoint size={3.5} alpha={0.85} />
  <ScaleXContinuous reverse={true} />
  <ThemeClassic />
  <Labs
    title="The cold Minard drew under the retreat"
    subtitle="Nine readings between Moscow and Wilna, each carried west until the next"
    x="Longitude east"
    y="Degrees Réaumur"
  />
  <Inspect mode="xy" pin maxDistance={24} />
</GGPlot>
