<script lang="ts">
  import {
    GeomPoint,
    GGPlot,
    GuideColorsteps,
    Inspect,
    Labs,
    ScaleColorBinned,
    ThemeBw,
  } from "@ggts-sh/svelte";

  import { jevonsTrials } from "./data.js";
</script>

<GGPlot
  data={jevonsTrials}
  aes={{ x: "actual", y: "estimated", color: "trials" }}
  width={640}
  height={400}
>
  <GeomPoint size={5} />
  <ScaleColorBinned
    breaks={[0, 5, 20, 60, 130]}
    range={["#d3d3d0", "#8ba89c", "#4f8a6e", "#1e5c43"]}
  />
  <ThemeBw />
  <GuideColorsteps channel="color" position="bottom" direction="horizontal" />
  <Labs
    title="How many items you can tell apart at once"
    subtitle="Binned colour so nearby values share a fill step"
    x="Beans actually thrown"
    y="Beans estimated"
    color="Trials"
  />
  <Inspect mode="xy" pin maxDistance={24} />
</GGPlot>
