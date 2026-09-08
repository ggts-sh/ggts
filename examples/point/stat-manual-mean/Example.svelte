<script lang="ts">
  import {
    GeomPoint,
    GGPlot,
    Inspect,
    Labs,
    registerManual,
    ScaleColorDiscrete,
    ThemeClassic,
  } from "@ggts-sh/svelte";

  // stat= override: the shell registers only its default stat (#1420).
  registerManual();

  import { michelsonRuns } from "./data.js";
</script>

<GGPlot
  data={michelsonRuns}
  aes={{ x: "order", y: "velocity", color: "run" }}
  width={640}
  height={400}
>
  <GeomPoint size={2.4} alpha={0.35} />
  <GeomPoint stat="manual" fun="mean" size={6} alpha={0.95} />
  <ScaleColorDiscrete scheme="observable10" />
  <ThemeClassic />
  <Labs
    title="Raw points with a manual mean per group"
    subtitle="Twenty readings per run"
    x="Measurement, 1 to 100"
    y="Speed of light, km/s less 299,000"
    color="Run"
  />
  <Inspect mode="xy" pin maxDistance={24} />
</GGPlot>
