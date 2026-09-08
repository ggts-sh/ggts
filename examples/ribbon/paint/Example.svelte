<script lang="ts">
  import { fillPaintLinear, glow, strokePaintLinear } from "@ggts-sh/spec";
  import { GeomLine, GeomRibbon, GGPlot, Inspect, Labs } from "@ggts-sh/svelte";

  import { series } from "./data.js";
</script>

<GGPlot
  data={series}
  aes={{ x: "x", ymin: "lo", ymax: "hi" }}
  width={640}
  height={360}
>
  <GeomRibbon
    alpha={0.85}
    outline="both"
    fillPaint={fillPaintLinear({
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 1,
      space: "mark",
      stops: [
        { offset: 0, color: "#4c78a8", opacity: 0.9 },
        { offset: 1, color: "#f58518", opacity: 0.75 },
      ],
      fallback: "#4c78a8",
    })}
    strokePaint={strokePaintLinear({
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 0,
      space: "panel",
      stops: [
        { offset: 0, color: "#1a1a1a" },
        { offset: 1, color: "#666666" },
      ],
      fallback: "#1a1a1a",
    })}
    glow={glow({ color: "#4c78a8", radius: 5, opacity: 0.35 })}
    linewidth={1.25}
  />
  <GeomLine aes={{ x: "x", y: "mid" }} linewidth={1.5} />
  <Labs
    title="What a ribbon can be painted with"
    subtitle="One interval band carrying a gradient fill, a gradient stroke and a glow"
    x="x"
    y="value"
    caption="Within-mark paint (not a data scale); solid fallbacks remain for a11y."
  />
  <Inspect mode="x" pin />
</GGPlot>
