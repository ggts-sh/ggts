<script lang="ts">
  /**
   * Bundle-attribution fixture (#1420): a GGPlot app that declares ONLY
   * point + line layers. The Vite graph for this fixture must not include
   * specialty geom/stat modules (smooth, density_2d, sf, contour, violin,
   * hex, boxplot, …). Asserted by ../../ggplot-treeshake-graph.test.ts.
   */
  import { GeomLine, GeomPoint, GGPlot } from "@ggts-sh/svelte";

  const data = [
    { x: 1, y: 10, cls: "a" },
    { x: 2, y: 20, cls: "b" },
    { x: 3, y: 15, cls: "a" },
    { x: 4, y: 25, cls: "b" },
    { x: 5, y: 22, cls: "a" },
  ];
</script>

<GGPlot {data} aes={{ x: "x", y: "y", color: "cls" }} width={480} height={320}>
  <GeomPoint size={3} />
  <GeomLine />
</GGPlot>
