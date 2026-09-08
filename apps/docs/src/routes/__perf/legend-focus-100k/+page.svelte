<script lang="ts">
  import {
    createPlotInteraction,
    GGPlot,
    GuideLegend,
    Labs,
  } from "@ggts-sh/svelte";

  const navigationData = Array.from({ length: 100_000 }, (_, id) => ({
    id,
    x: id % 1_000,
    y: (id * 37) % 997,
    group: `G${String(id % 10)}`,
  }));
  const linkedData = navigationData.slice(0, 1_000);
  const scope = { keys: "legend-perf-rows" } as const;
  const navigationScope = { keys: "legend-navigation-rows" } as const;
  const interaction = createPlotInteraction<number>();
  const navigationInteraction = createPlotInteraction<number>();
  const mapping = { x: "x", y: "y", color: "group" } as const;
  let commitsA = $state(0);
  let commitsB = $state(0);
  let commitsC = $state(0);
  let commitsNavigation = $state(0);
</script>

<main
  data-legend-perf-fixture
  data-row-count={navigationData.length}
  data-linked-row-count={linkedData.length}
  data-revision={interaction.revision}
  data-commits-a={commitsA}
  data-commits-b={commitsB}
  data-commits-c={commitsC}
>
  <div data-perf-plot="navigation">
    <GGPlot
      data={navigationData}
      aes={mapping}
      layers={[{ geom: "point", render: "canvas", params: { size: 1 } }]}
      interaction={navigationInteraction}
      interactionScope={navigationScope}
      width={620}
      height={360}
      onrender={() => (commitsNavigation += 1)}
    >
      <GuideLegend channel="color" focus={{ preview: false }} />
      <Labs title="100k navigation view" color="Group" />
    </GGPlot>
  </div>
  {#each ["A", "B", "C"] as name (name)}
    <div data-perf-plot={name}>
      <GGPlot
        data={linkedData}
        aes={mapping}
        layers={[{ geom: "point", render: "canvas", params: { size: 1 } }]}
        {interaction}
        interactionScope={scope}
        width={620}
        height={360}
        onrender={() => {
          if (name === "A") commitsA += 1;
          else if (name === "B") commitsB += 1;
          else commitsC += 1;
        }}
      >
        <GuideLegend channel="color" focus={{ preview: false }} />
        <Labs title={`Linked view ${name}`} color="Group" />
      </GGPlot>
    </div>
  {/each}
</main>

<style>
  main {
    width: 620px;
  }
</style>
