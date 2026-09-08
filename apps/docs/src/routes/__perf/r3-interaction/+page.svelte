<script lang="ts">
  import {
    createPlotInteraction,
    Facet,
    GGPlot,
    GuideLegend,
    Labs,
  } from "@ggts-sh/svelte";

  const FILTER_ROWS = 20_000;
  const FACET_ROWS = 12_000;
  const FACETS = ["North", "Central", "South"] as const;

  const filterData = Array.from({ length: FILTER_ROWS }, (_, id) => ({
    id,
    x: id % 1_000,
    y: (id * 37) % 997,
    group: `G${String(id % 5)}`,
  }));
  const facetData = Array.from({ length: FACET_ROWS }, (_, id) => {
    const panelIndex = Math.floor(id / 4_000);
    const offset = id % 4_000;
    return {
      id,
      facet: FACETS[panelIndex]!,
      x: offset % 1_000,
      y: (offset * 37 + panelIndex * 17) % 997,
    };
  });
  const mapping = { x: "x", y: "y" } as const;
  const crossPanelSelect = {
    type: "interval",
    mode: "x",
    preset: "cross-panel",
  } as const;
  const facetScope = {
    keys: "r3-facet-rows",
    intervals: "r3-facet-intervals",
  } as const;
  const zoomScope = { keys: "r3-zoom-rows", x: "r3-zoom-x" } as const;

  let filterPipelineCommits = $state(0);
  let facetPipelineCommits = $state(0);
  let intervalInteractionCommits = $state(0);
  let lastIntervalInteractionKind = $state("none");
  let zoomPipelineCommits = $state(0);
  let zoomInteractionCommits = $state(0);
  let lastZoomInteractionKind = $state("none");
  const facetInteraction = createPlotInteraction<number>({
    onchange: (transition) => {
      intervalInteractionCommits += 1;
      lastIntervalInteractionKind = transition.kind;
    },
  });
  const zoomInteraction = createPlotInteraction<number>({
    onchange: (transition) => {
      zoomInteractionCommits += 1;
      lastZoomInteractionKind = transition.kind;
    },
  });
</script>

<main
  data-r3-perf-fixture
  data-filter-row-count={filterData.length}
  data-facet-row-count={facetData.length}
  data-zoom-row-count="4000"
  data-filter-pipeline-commits={filterPipelineCommits}
  data-facet-pipeline-commits={facetPipelineCommits}
  data-interval-interaction-commits={intervalInteractionCommits}
  data-interval-interaction-revision={facetInteraction.revision}
  data-last-interval-interaction-kind={lastIntervalInteractionKind}
  data-zoom-pipeline-commits={zoomPipelineCommits}
  data-zoom-interaction-commits={zoomInteractionCommits}
  data-zoom-interaction-revision={zoomInteraction.revision}
  data-last-zoom-interaction-kind={lastZoomInteractionKind}
>
  <section data-perf-plot="filter">
    <GGPlot
      data={filterData}
      aes={{ ...mapping, color: "group" }}
      layers={[{ geom: "point", render: "canvas", params: { size: 1 } }]}
      width={900}
      height={420}
      onrender={() => (filterPipelineCommits += 1)}
    >
      <GuideLegend channel="color" filter />
      <Labs title="R3 legend filter pipeline" color="Group" />
    </GGPlot>
  </section>

  <section data-perf-plot="facet">
    <GGPlot
      data={facetData}
      aes={mapping}
      layers={[{ geom: "point", render: "canvas", params: { size: 1 } }]}
      select={crossPanelSelect}
      interaction={facetInteraction}
      interactionScope={facetScope}
      width={900}
      height={420}
      onrender={() => (facetPipelineCommits += 1)}
    >
      <Facet wrap="facet" ncol={3} />
      <Labs title="R3 cross-panel interval and precise bounds" />
    </GGPlot>
  </section>

  <section data-perf-plot="zoom">
    <GGPlot
      data={facetData.slice(0, 4_000)}
      aes={mapping}
      layers={[{ geom: "point", render: "canvas", params: { size: 1 } }]}
      zoom={{ mode: "x" }}
      interaction={zoomInteraction}
      interactionScope={zoomScope}
      width={900}
      height={420}
      onrender={() => (zoomPipelineCommits += 1)}
    >
      <Labs title="R3 precise zoom bounds" />
    </GGPlot>
  </section>
</main>

<style>
  main {
    width: 900px;
  }
</style>
