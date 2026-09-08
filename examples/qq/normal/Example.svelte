<script lang="ts">
  import {
    GeomQq,
    GeomQqLine,
    GGPlot,
    Inspect,
    Labs,
    ThemeClassic,
  } from "@ggts-sh/svelte";

  import { michelson } from "./data.js";
</script>

<GGPlot data={michelson} aes={{ sample: "velocity" }} width={640} height={400}>
  <GeomQq size={2.5} alpha={0.85} />
  <GeomQqLine linewidth={1.2} alpha={0.7} />
  <ThemeClassic />
  <Labs
    title="Sample quantiles against the normal"
    subtitle="A hundred experimental runs compared with the normal they would follow under pure chance"
    x="Normal quantile"
    y="Speed of light, km/s less 299,000"
  />
  <Inspect mode="xy" pin maxDistance={24} />
</GGPlot>
