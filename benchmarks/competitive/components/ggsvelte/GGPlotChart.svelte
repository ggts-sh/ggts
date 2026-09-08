<script lang="ts">
  import { GGPlot } from "@ggts-sh/svelte";
  import type { SpecInput } from "@ggts-sh/spec/portable";
  import { scenarioSpec } from "../../adapters/ggsvelte-svg";
  import type { ScenarioId, UpdateColumns } from "../../scenarios";

  let {
    data,
    scenario = "scatter-color",
    width = 800,
    height = 500,
  }: {
    data: UpdateColumns;
    scenario?: ScenarioId;
    width?: number;
    height?: number;
  } = $props();

  const spec: SpecInput = $derived({
    ...scenarioSpec(scenario),
    data: { columns: data },
  });

  export function setData(next: UpdateColumns): void {
    data = next;
  }
</script>

<GGPlot {spec} {width} {height} />
