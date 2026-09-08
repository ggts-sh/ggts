<script lang="ts">
  import { base } from "$app/paths";
  import { benchmarkChartSrc } from "$lib/benchmarks/asset-url";
  import { BENCHMARK_CHART_CARDS } from "$lib/generated/benchmark-charts";
</script>

<div class="benchmark-highlights">
  {#each BENCHMARK_CHART_CARDS as card (card.id)}
    <div class="benchmark-highlight">
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
  {/each}
</div>
