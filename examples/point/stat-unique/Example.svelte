<script lang="ts">
  import {
    GeomPoint,
    GGPlot,
    Inspect,
    Labs,
    registerUnique,
    ThemeClassic,
  } from "@ggts-sh/svelte";

  // stat= override: the shell registers only its default stat (#1420).
  registerUnique();

  import { deadlyQuarrels } from "./data.js";
</script>

<GGPlot
  data={deadlyQuarrels}
  aes={{ x: "year", y: "magnitude" }}
  width={640}
  height={400}
>
  <GeomPoint stat="unique" size={3} alpha={0.8} />
  <ThemeClassic />
  <Labs
    title="Collapse duplicate coordinates to unique marks"
    subtitle="One row per belligerent pair becomes one mark per distinct (year, magnitude)"
    x="Year the quarrel began"
    y="Magnitude (log10 killed)"
  />
  <Inspect mode="xy" pin maxDistance={24} />
</GGPlot>
