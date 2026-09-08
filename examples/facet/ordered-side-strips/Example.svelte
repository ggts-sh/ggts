<script lang="ts">
  import {
    FacetWrap,
    GeomCol,
    GGPlot,
    GuideNone,
    Inspect,
    Labs,
    ScaleFillDiscrete,
    ThemeLight,
  } from "@ggts-sh/svelte";

  import { SAMPLE_LABELS, SAMPLES, yeastCounts } from "./data.js";
</script>

<GGPlot
  data={yeastCounts}
  aes={{ x: "cells", y: "squares", fill: "sample" }}
  width={640}
  height={400}
>
  <GeomCol alpha={0.9} />
  <FacetWrap
    field={{
      field: "sample",
      levels: [...SAMPLES],
      labels: { ...SAMPLE_LABELS },
    }}
    ncol={1}
    strip={{ position: "left" }}
  />
  <ScaleFillDiscrete domain={[...SAMPLES]} scheme="flexoki" />
  <ThemeLight />
  <GuideNone channel="fill" />
  <Labs
    title="Facets with ordered side strips"
    subtitle="Yeast counts under a microscope, one panel per sample (A–D)"
    x="Cells in a square"
    y="Squares"
  />
  <Inspect mode="exact" pin />
</GGPlot>
