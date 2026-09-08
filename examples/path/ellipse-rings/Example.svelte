<script lang="ts">
  import {
    GeomPath,
    GeomPoint,
    GGPlot,
    Inspect,
    Labs,
    registerEllipse,
    ScaleColorDiscrete,
    ThemeClassic,
  } from "@ggts-sh/svelte";

  // stat= override: the shell registers only its default stat (#1420).
  registerEllipse();

  import { penguins } from "./data.js";
</script>

<GGPlot
  data={penguins}
  aes={{ x: "bill", y: "flipper", color: "species" }}
  width={640}
  height={400}
>
  <GeomPoint alpha={0.6} size={2.4} />
  <GeomPath stat="ellipse" level={0.95} segments={51} linewidth={1.5} />
  <ScaleColorDiscrete scheme="observable10" />
  <ThemeClassic />
  <Labs
    title="Confidence ellipses around groups"
    subtitle="95% bivariate normal rings for three species in bill and flipper length"
    x="Bill length (mm)"
    y="Flipper length (mm)"
    color="Species"
  />
  <Inspect mode="xy" pin maxDistance={24} />
</GGPlot>
