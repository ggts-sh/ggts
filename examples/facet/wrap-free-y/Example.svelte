<script lang="ts">
  import {
    FacetWrap,
    GeomLine,
    GGPlot,
    GuideNone,
    Inspect,
    Labs,
    ScaleXContinuous,
    ThemeFivethirtyeight,
  } from "@ggts-sh/svelte";

  import { londonBills } from "./data.js";
</script>

<GGPlot
  data={londonBills}
  aes={{ x: "year", y: "value", color: "measure" }}
  width={640}
  height={400}
>
  <GeomLine linewidth={1.6} />
  <FacetWrap
    field={{
      field: "measure",
      levels: [
        "Male / female ratio",
        "Male christenings",
        "All burials",
        "Plague deaths",
      ],
    }}
    ncol={2}
    scales="free_y"
  />
  <ScaleXContinuous labels="d" />
  <ThemeFivethirtyeight />
  <GuideNone channel="color" />
  <Labs
    title="Facets with free y scales"
    subtitle="Christenings and burials on their own vertical ranges so neither series flattens"
    x="Year"
    y=""
  />
  <Inspect mode="x" pin />
</GGPlot>
