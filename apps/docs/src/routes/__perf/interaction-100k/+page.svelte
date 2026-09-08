<script lang="ts">
  import type { RenderModel } from "@ggts-sh/core";
  import { GGPlot, Inspect } from "@ggts-sh/svelte";

  type Row = Readonly<{
    id: number;
    x: number;
    y: number;
    series: number;
  }>;

  // One hundred exact x buckets with one thousand semantic series in each
  // bucket: 100k candidates and a representative-heavy 1k-member target.
  const data: readonly Row[] = Array.from({ length: 100_000 }, (_, id) => {
    const x = Math.floor(id / 1_000);
    const series = id % 1_000;
    return {
      id,
      x,
      y: (series * 37 + x * 17) % 1_000,
      series,
    };
  });

  let candidateCount = $state(0);
  let groupedMemberCount = $state(0);
  let pipelineCommits = $state(0);
  let commitCounter = 0;
</script>

<main
  data-interaction-perf-fixture
  data-candidate-count={candidateCount}
  data-grouped-member-count={groupedMemberCount}
  data-pipeline-commits={pipelineCommits}
>
  <GGPlot
    {data}
    aes={{ x: "x", y: "y", group: "series" }}
    layers={[{ geom: "point", render: "canvas", params: { size: 1 } }]}
    onrender={(model: RenderModel) => {
      candidateCount = model.candidates.size;
      const seed = model.candidates.nearest(
        model.scene.width / 2,
        model.scene.height / 2,
        {
          mode: "x",
          maxDistance: model.scene.width,
        },
      );
      groupedMemberCount =
        seed === null
          ? 0
          : (model.candidates.group(seed.id, "x")?.memberIds.length ?? 0);
      pipelineCommits = ++commitCounter;
    }}
    width={800}
    height={500}
  >
    <Inspect mode="x" maxDistance={24} />
  </GGPlot>
</main>

<style>
  main {
    width: 800px;
  }
</style>
