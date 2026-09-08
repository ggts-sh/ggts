<script lang="ts">
  import {
    BENCHMARK_BUNDLE_KB,
    BENCHMARK_VERSIONS,
  } from "$lib/generated/benchmark-charts";

  type Mark = "yes" | "partial" | "no";

  interface Cell {
    readonly mark: Mark;
    readonly note?: string;
  }

  interface Row {
    readonly feature: string;
    readonly desc?: string;
    readonly gg: Cell;
    readonly ts: Cell;
    readonly lc: Cell;
    readonly uv: Cell;
    readonly sp: Cell;
  }

  const GLYPH: Record<Mark, string> = { yes: "✓", partial: "⚠", no: "✗" };
  const WORD: Record<Mark, string> = {
    yes: "yes",
    partial: "partial",
    no: "no",
  };

  const yes: Cell = { mark: "yes" };
  const no: Cell = { mark: "no" };

  const kb = (value: number): string => `${String(Math.round(value))} KB`;

  /*
   * Column order ggsvelte → TanStack → SveltePlot → Unovis → LayerCake.
   * Bun's homepage table leads with its flaw before the wins; same here:
   * bundle size and pre-1.0 up top. Claims verified against svelteplot@0.14
   * / @tanstack/charts@0.14 / @unovis/svelte@1.6 / layercake@10 sources.
   */
  const rows: readonly Row[] = [
    {
      feature: "Bundle size",
      desc: "Min+gzip, scatter import graph",
      gg: { mark: "partial", note: kb(BENCHMARK_BUNDLE_KB.ggsvelteKb) },
      ts: { mark: "yes", note: kb(BENCHMARK_BUNDLE_KB.tanstackKb) },
      lc: { mark: "yes", note: kb(BENCHMARK_BUNDLE_KB.layercakeKb) },
      uv: { mark: "yes", note: kb(BENCHMARK_BUNDLE_KB.unovisKb) },
      sp: { mark: "partial", note: kb(BENCHMARK_BUNDLE_KB.svelteplotKb) },
    },
    {
      feature: "API stability",
      desc: "Pre-1.0: minors can still break",
      gg: { mark: "partial", note: `v${BENCHMARK_VERSIONS.ggsvelte}` },
      ts: { mark: "partial", note: `v${BENCHMARK_VERSIONS.tanstack}` },
      lc: { mark: "yes", note: `v${BENCHMARK_VERSIONS.layercake}` },
      uv: { mark: "yes", note: `v${BENCHMARK_VERSIONS.unovis}` },
      sp: { mark: "partial", note: `v${BENCHMARK_VERSIONS.svelteplot}` },
    },
    {
      feature: "Headless server-side SVG",
      desc: "data → SVG string, no DOM",
      gg: yes,
      ts: yes,
      lc: { mark: "partial", note: "opt-in" },
      uv: { mark: "no" },
      sp: { mark: "no" },
    },
    {
      feature: "Portable JSON spec + schema",
      gg: yes,
      ts: no,
      lc: no,
      uv: no,
      sp: no,
    },
    {
      feature: "CLI validator + renderer",
      gg: yes,
      ts: no,
      lc: no,
      uv: no,
      sp: no,
    },
    {
      feature: "Agent skill",
      gg: yes,
      ts: yes,
      lc: no,
      uv: no,
      sp: no,
    },
    {
      feature: "Automatic temporal detection",
      gg: yes,
      ts: no,
      lc: no,
      uv: no,
      sp: { mark: "partial", note: "Some" },
    },
    {
      feature: "Built-in interactions",
      desc: "Tooltip, select, zoom, link",
      gg: yes,
      ts: yes,
      lc: { mark: "no", note: "bring your own" },
      uv: { mark: "partial", note: "Some" },
      sp: { mark: "partial", note: "Some" },
    },
    {
      feature: "ggplot2 API",
      gg: yes,
      ts: no,
      lc: no,
      uv: no,
      sp: no,
    },
    {
      feature: "Scale, axis & coord control",
      gg: yes,
      ts: yes,
      lc: { mark: "partial", note: "d3" },
      uv: yes,
      sp: yes,
    },
  ];
</script>

<section class="benchmarks" aria-labelledby="benchmarks-heading">
  <header class="bench-intro">
    <h2 id="benchmarks-heading">Svelte ecosystem capabilities</h2>
  </header>

  <div class="bench-table-wrap">
    <table>
      <colgroup>
        <col class="bench-col-feature" />
        <col class="bench-col-lib" span="5" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Capability</th>
          <th scope="col">ggsvelte</th>
          <th scope="col">TanStack</th>
          <th scope="col">SveltePlot</th>
          <th scope="col">Unovis</th>
          <th scope="col">LayerCake</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row (row.feature)}
          <tr>
            <th scope="row">
              {row.feature}
              {#if row.desc !== undefined}<small>{row.desc}</small>{/if}
            </th>
            {#each [row.gg, row.ts, row.sp, row.uv, row.lc] as cell, i (i)}
              <td>
                <span class={`mark mark--${cell.mark}`} aria-hidden="true"
                  >{GLYPH[cell.mark]}</span
                ><span class="sr-only">{WORD[cell.mark]}</span>
                {#if cell.note !== undefined}<small>{cell.note}</small>{/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>
