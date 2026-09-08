<script lang="ts">
  import BenchmarkTabs from "$lib/components/BenchmarkTabs.svelte";
  import Benchmarks from "$lib/components/Benchmarks.svelte";
  import {
    BENCHMARK_RESULTS,
    BENCHMARK_LIBRARIES,
    BENCHMARK_MEASURED_AT,
    BENCHMARK_PROVENANCE,
    BENCHMARK_BUNDLE_RESULTS,
    BENCHMARK_BUNDLE_MEASURED_AT,
    BENCHMARK_BUNDLE_PROVENANCE,
    BENCHMARK_SSR_RESULTS,
    BENCHMARK_SSR_MEASURED_AT,
    BENCHMARK_SSR_METHOD,
    BENCHMARK_SSR_PROVENANCE,
    BENCHMARK_HIGH_N_RESULTS,
    BENCHMARK_HIGH_N_METADATA,
  } from "$lib/generated/benchmark-charts";

  const libraries = new Map<
    string,
    { label: string; form: string; note?: string }
  >(BENCHMARK_LIBRARIES.map((library) => [library.id, library]));
  const number = (value: number | null) =>
    value === null ? "—" : value.toFixed(2);
  const browserTables = [
    { title: "All production browser results", results: BENCHMARK_RESULTS },
    {
      title: "Historical large-data results",
      results: BENCHMARK_HIGH_N_RESULTS,
    },
  ];
</script>

<article>
  <h1>Benchmarks</h1>
  <p>
    Compare the core renderer and the React and Svelte components on fixed
    workloads. Lower times are better. Results include competitors that
    outperform ggts.
  </p>
  <BenchmarkTabs />
  <h2>What the measurements cover</h2>
  <p>
    React and Svelte measurements mount the package's GGPlot component. Core SVG
    measures the direct renderer. General-purpose libraries are identified
    separately from framework adapters; marks-only canvas results do not
    represent a complete chart.
  </p>
  <p>
    The browser harness serves production builds and uses seeded data, fixed
    dimensions and palette domains. Update checks verify visible changes and
    compare the result with a fresh chart. Scatter and line are fixed featured
    workloads; the full tables retain area, bars, and every measured comparator.
  </p>
  <p>
    These are measurements on one machine. The committed snapshot records
    versions and run provenance. The snapshot predates the ggts rename and
    records the original @ggsvelte package names. Package releases do not
    rewrite historical timings. Versions identify the workspace build at the
    recorded source commit, which may include unreleased changes.
  </p>
  <p>Production browser measurements: {BENCHMARK_MEASURED_AT}</p>
  <details>
    <summary>Measurement environment and package versions</summary>
    <pre>{JSON.stringify(BENCHMARK_PROVENANCE, null, 2)}</pre>
  </details>
  {#each browserTables as table (table.title)}
    <h2>{table.title}</h2>
    {#if table.results === BENCHMARK_HIGH_N_RESULTS}
      <p>
        Captured {BENCHMARK_HIGH_N_METADATA.generatedAt} using the older development-server
        protocol. These timings have no recorded source commit or package versions
        and are separate from the production comparisons above.
      </p>
      <details>
        <summary>Historical protocol and host</summary>
        <pre>{JSON.stringify(BENCHMARK_HIGH_N_METADATA, null, 2)}</pre>
      </details>
    {/if}
    <div class="results-scroll">
      <table>
        <caption
          >Median milliseconds; unsuccessful measurements are labeled failed.</caption
        >
        <thead
          ><tr
            ><th scope="col">Library</th><th scope="col">Renderer</th><th
              scope="col">Workload</th
            ><th scope="col">Mount (ms)</th><th scope="col">Update (ms)</th><th
              scope="col">Status</th
            ></tr
          ></thead
        >
        <tbody>
          {#each table.results as result (`${result.lib}/${result.caseId}`)}
            <tr>
              <th scope="row"
                >{libraries.get(result.lib)?.label ?? result.lib}</th
              >
              <td>{libraries.get(result.lib)?.form ?? "—"}</td>
              <td>{result.caseId}</td>
              <td>{number(result.mountMedianMs)}</td>
              <td>{number(result.updateMedianMs)}</td>
              <td>{result.ok ? "Passed" : "Failed"}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/each}
  <h2>Bundle sizes</h2>
  <p>
    Minified and gzipped import graphs, including the named adapter. These are
    chart entry bundles, not complete applications. Measured {BENCHMARK_BUNDLE_MEASURED_AT}.
  </p>
  <details>
    <summary>Bundle measurement provenance</summary>
    <pre>{JSON.stringify(BENCHMARK_BUNDLE_PROVENANCE, null, 2)}</pre>
  </details>
  <div class="results-scroll">
    <table>
      <caption>Bundle size in gzip KB by chart entry.</caption>
      <thead
        ><tr
          ><th scope="col">Library</th><th scope="col">Workload</th><th
            scope="col">Gzip KB</th
          ><th scope="col">Status</th></tr
        ></thead
      >
      <tbody>
        {#each BENCHMARK_BUNDLE_RESULTS as result (`${result.lib}/${result.scenario}`)}
          <tr
            ><th scope="row"
              >{libraries.get(result.lib)?.label ?? result.lib}</th
            ><td>{result.scenario}</td><td>{number(result.gzipKB)}</td><td
              >{result.ok ? "Passed" : "Failed"}</td
            ></tr
          >
        {/each}
      </tbody>
    </table>
  </div>
  <h2>Server rendering</h2>
  <p>{BENCHMARK_SSR_METHOD}</p>
  <p>
    Measured {BENCHMARK_SSR_MEASURED_AT}. Core headless rendering and framework
    server rendering are labeled separately.
  </p>
  <details>
    <summary>Server measurement provenance</summary>
    <pre>{JSON.stringify(BENCHMARK_SSR_PROVENANCE, null, 2)}</pre>
  </details>
  <div class="results-scroll">
    <table>
      <caption
        >Server render medians; a shell without chart marks is not counted as a
        rendered chart.</caption
      >
      <thead
        ><tr
          ><th scope="col">Library</th><th scope="col">Workload</th><th
            scope="col">Median (ms)</th
          ><th scope="col">Renders/s</th><th scope="col">Status</th></tr
        ></thead
      >
      <tbody>
        {#each BENCHMARK_SSR_RESULTS as result (`${result.lib}/${result.caseId}`)}
          <tr
            ><th scope="row">{result.label}</th><td>{result.caseId}</td><td
              >{number(result.medianMs)}</td
            ><td>{number(result.rendersPerSec)}</td><td
              >{result.ssrCapable === false
                ? "No chart marks"
                : result.ok
                  ? "Passed"
                  : "Failed"}</td
            ></tr
          >
        {/each}
      </tbody>
    </table>
  </div>
  <Benchmarks />
</article>

<style>
  article {
    max-width: 72rem;
    margin: 0 auto;
    padding: 2rem 0;
  }
  p {
    max-width: 75ch;
    line-height: 1.6;
  }
  h2 {
    margin-top: 2rem;
  }
  .results-scroll,
  pre {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    padding: 0.5rem;
    text-align: left;
    border-bottom: 1px solid var(--border);
  }
</style>
