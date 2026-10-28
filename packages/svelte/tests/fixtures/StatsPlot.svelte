<script lang="ts">
  /** M2 fixture: declaration-only statistical children (smooth over jittered
   *  points) for the equivalence gate. */
  import type { PortableSpec, RenderModel } from "../../src/lib/index.js";
  import GGPlot from "../../src/lib/GGPlot.svelte";
  import "../../src/lib/host-init.js";
  import GeomPoint from "../../src/lib/geoms/GeomPoint.svelte";
  import GeomSmooth from "../../src/lib/geoms/GeomSmooth.svelte";

  interface Row {
    x: number;
    y: number;
  }

  const {
    data,
    onrender,
  }: {
    data: Row[];
    onrender?: (model: RenderModel, spec: PortableSpec) => void;
  } = $props();
</script>

<GGPlot {data} aes={{ x: "x", y: "y" }} width={480} height={320} {onrender}>
  <GeomPoint
    position="jitter"
    positionParams={{ seed: 9, width: 0.1 }}
    alpha={0.6}
  />
  <GeomSmooth method="lm" level={0.9} />
</GGPlot>
