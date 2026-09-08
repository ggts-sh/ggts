<script lang="ts">
  import { base } from "$app/paths";
  import { Tabs } from "bits-ui";

  import { benchmarkChartSrc } from "$lib/benchmarks/asset-url";
  import { BENCHMARK_CHART_CARDS } from "$lib/generated/benchmark-charts";

  const cards = BENCHMARK_CHART_CARDS;
</script>

<div class="bench-tabs">
  <Tabs.Root value={cards[0].id}>
    <Tabs.List class="bench-tabs-list" aria-label="Benchmark scenarios">
      {#each cards as card (card.id)}
        <Tabs.Trigger class="bench-tabs-trigger" value={card.id}>
          {card.tab}
        </Tabs.Trigger>
      {/each}
    </Tabs.List>
    {#each cards as card (card.id)}
      <Tabs.Content class="bench-tabs-content" value={card.id}>
        <div class="bench-tabs-chart">
          <img
            class="bench-chart-img bench-chart--light"
            src={`${base}${benchmarkChartSrc(card.path, card.sha256)}`}
            alt={card.alt}
            width={card.width}
            height={card.height}
            loading="lazy"
          />
          <img
            class="bench-chart-img bench-chart--dark"
            src={`${base}${benchmarkChartSrc(card.darkPath, card.sha256)}`}
            alt={card.alt}
            width={card.width}
            height={card.height}
            loading="lazy"
          />
        </div>
      </Tabs.Content>
    {/each}
  </Tabs.Root>
</div>
