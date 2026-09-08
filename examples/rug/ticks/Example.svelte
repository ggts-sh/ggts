<script lang="ts">
  import {
    GeomRug,
    GGPlot,
    GuideNone,
    Inspect,
    Labs,
    ScaleXContinuous,
    ThemeMinimal,
  } from "@ggts-sh/svelte";

  import { spacedScores } from "./data.js";
</script>

<GGPlot data={spacedScores} aes={{ x: "score" }} width={640} height={400}>
  <GeomRug
    sides="b"
    length={0.22}
    linewidth={2.8}
    alpha={1}
    aes={{ color: { value: "#1a202c" } }}
  />
  <ScaleXContinuous limits={[0, 11]} />
  <ThemeMinimal />
  <!-- y is a placeholder domain for edge ticks only; hide the ladder -->
  <GuideNone channel="y" />
  <Labs
    title="Bottom-edge rug ticks"
    subtitle="Ten long ticks along the panel bottom for each score"
    x="Score"
  />
  <Inspect mode="exact" pin />
</GGPlot>
