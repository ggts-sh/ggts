<script lang="ts">
  import ColSvelte from "../col/basic/Example.svelte";
  import HistSvelte from "../histogram/basic/Example.svelte";
  import ScatterSvelte from "../point/scatter-color/Example.svelte";
  import HlineSvelte from "../hline/threshold/Example.svelte";
  import BarSvelte from "../bar/horizontal/Example.svelte";
  import JitterSvelte from "../jitter/basic/Example.svelte";
  import ColReact from "../col/basic/Example.tsx";
  import HistReact from "../histogram/basic/Example.tsx";
  import ScatterReact from "../point/scatter-color/Example.tsx";
  import HlineReact from "../hline/threshold/Example.tsx";
  import BarReact from "../bar/horizontal/Example.tsx";
  import JitterReact from "../jitter/basic/Example.tsx";

  import ReactMount from "./ReactMount.svelte";

  const pairs = [
    {
      id: "col/basic",
      title: "Counts across ordered chest sizes",
      svelte: ColSvelte,
      react: ColReact,
    },
    {
      id: "histogram/basic",
      title: "Histogram of a hundred experimental runs",
      svelte: HistSvelte,
      react: HistReact,
    },
    {
      id: "point/scatter-color",
      title: "Two measures coloured by region",
      svelte: ScatterSvelte,
      react: ScatterReact,
    },
    {
      id: "hline/threshold",
      title: "One horizontal threshold",
      svelte: HlineSvelte,
      react: HlineReact,
    },
    {
      id: "bar/horizontal",
      title: "Category totals, flipped so labels read across",
      svelte: BarSvelte,
      react: BarReact,
    },
    {
      id: "jitter/basic",
      title: "Menu calories, spread so items do not stack",
      svelte: JitterSvelte,
      react: JitterReact,
    },
  ];
</script>

<main>
  <h1>Svelte vs React — basic gallery spike</h1>
  <p>
    Local comparison only. Start with <code>bun run compare</code> from
    <code>examples/</code> (port 4177).
  </p>
  {#each pairs as pair (pair.id)}
    <section class="pair" data-example={pair.id}>
      <h2>{pair.id}</h2>
      <p>{pair.title}</p>
      <div class="columns">
        <div class="column">
          <h3>Svelte</h3>
          <div class="plot" data-plot="svelte">
            <pair.svelte />
          </div>
        </div>
        <div class="column">
          <h3>React</h3>
          <ReactMount component={pair.react} />
        </div>
      </div>
    </section>
  {/each}
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: system-ui, sans-serif;
    background: #f4f4f1;
    color: #1b1b18;
  }

  main {
    max-width: 1680px;
    margin: 0 auto;
    padding: 1.5rem;
  }

  .pair {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid #ccc;
  }

  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }

  .column {
    min-width: 0;
    overflow: auto;
    background: #fff;
    padding: 0.75rem;
    border: 1px solid #ddd;
  }

  h1 {
    margin: 0 0 0.5rem;
  }

  h2,
  h3 {
    margin: 0 0 0.5rem;
  }

  @media (max-width: 900px) {
    .columns {
      grid-template-columns: 1fr;
    }
  }
</style>
