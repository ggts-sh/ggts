<script lang="ts">
  /**
   * Lean-entry twin of ../ggplot-scatter: the same point + line GGPlot app,
   * imported from @ggts-sh/svelte/lean. The app registers only what the
   * chart uses, so the graph must not include the other basic geoms or the
   * scale-kind catalogs. Asserted by ../../ggplot-treeshake-graph.test.ts.
   */
  import {
    GeomLine,
    GeomPoint,
    GGPlot,
    registerBasicLines,
    registerBasicPoints,
    registerDefaultOrdinalColor,
  } from "@ggts-sh/svelte/lean";

  registerBasicPoints();
  registerBasicLines();
  registerDefaultOrdinalColor();

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
