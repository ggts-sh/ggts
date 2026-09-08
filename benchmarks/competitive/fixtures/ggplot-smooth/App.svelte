<script lang="ts">
  /**
   * Positive-control fixture (#1420): declaring <GeomSmooth> must pull the
   * smooth stat + geom modules into the Vite graph via the component's own
   * registration (no global registerAll). Asserted by
   * ../../ggplot-treeshake-graph.test.ts.
   */
  import { GeomPoint, GeomSmooth, GGPlot } from "@ggts-sh/svelte";

  const data = [
    { x: 1, y: 10 },
    { x: 2, y: 20 },
    { x: 3, y: 15 },
    { x: 4, y: 25 },
    { x: 5, y: 22 },
  ];
</script>

<GGPlot {data} aes={{ x: "x", y: "y" }} width={480} height={320}>
  <GeomPoint size={3} />
  <GeomSmooth method="lm" />
</GGPlot>
