<script lang="ts">
  /**
   * Fixed workload comparisons, filtered by measured adapter and operation. Styles
   * live in styles/shell.css next to the rest of the benchmark chrome
   * (external stylesheet ↔ CSP, see the .benchmarks comment there).
   */
  import { base } from "$app/paths";

  import { Tabs } from "bits-ui";

  import { benchmarkChartSrc } from "$lib/benchmarks/asset-url";
  import { BENCHMARK_CHART_CARDS } from "$lib/generated/benchmark-charts";

  let framework = $state("core");
  let metric = $state("mount");
  const cards = $derived(
    BENCHMARK_CHART_CARDS.filter(
      (card) => card.framework === framework && card.metric === metric,
    ),
  );
</script>

<div class="bench-tabs">
  <div class="benchmark-filters">
    <label
      >Surface <select bind:value={framework}>
        <option value="core">Core SVG</option>
        <option value="svelte">Svelte component</option>
        <option value="react">React component</option>
      </select></label
    >
    <label
      >Operation <select bind:value={metric}>
        <option value="mount">Mount</option>
        <option value="update">Update</option>
      </select></label
    >
  </div>
  {#key `${framework}-${metric}`}
    <Tabs.Root value={cards[0]?.id ?? ""}>
      <Tabs.List class="bench-tabs-list" aria-label="Benchmark scenarios">
        {#each cards as card (card.id)}
          <Tabs.Trigger class="bench-tabs-trigger" value={card.id}>
            {card.tab}
          </Tabs.Trigger>
        {/each}
      </Tabs.List>
      {#each cards as card (card.id)}
        <Tabs.Content class="bench-tabs-content" value={card.id}>
          <!-- Title + subtitle are drawn inside the SVG (labs) so README
             embeds stay self-describing; no HTML echo here. -->
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
  {/key}
</div>

<style>
  .benchmark-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  select {
    font: inherit;
    color: inherit;
    background: var(--bg);
    padding: 0.35rem;
    border: 1px solid var(--border);
    border-radius: 0.25rem;
  }
</style>
