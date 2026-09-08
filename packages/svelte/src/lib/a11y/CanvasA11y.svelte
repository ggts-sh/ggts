<script lang="ts">
  /**
   * Canvas-stratum accessibility surface for GGPlot.
   * Host owns shared open state (plot-scoped across canvas strata).
   */
  import type { GeometryBatch, RenderModel } from "@ggts-sh/core";

  import { a11yMarkCount, a11yRows } from "./canvas-a11y.js";

  const {
    model,
    batches,
    sceneLabelText,
    open,
    onToggle,
  }: {
    model: RenderModel;
    batches: GeometryBatch[];
    sceneLabelText: string;
    open: boolean;
    onToggle: () => void;
  } = $props();

  // Closed: O(P) distinct-index count only (aria-label). Open: one full table
  // build — reuse `table.total` so the primitive scan is not paid twice (#1329).
  const table = $derived(open ? a11yRows(model, batches) : null);
  const total = $derived(table === null ? a11yMarkCount(batches) : table.total);
  const ariaLabel = $derived(
    `${sceneLabelText} — ${String(total)} canvas-rendered marks. Canvas marks are not individually focusable; use the data table.`,
  );
</script>

<div class="gg-canvas-a11y" role="img" aria-label={ariaLabel}></div>
<button
  type="button"
  class="gg-a11y-toggle"
  aria-expanded={open}
  onclick={() => onToggle()}
  >{open ? "Hide data table" : "Show data table"}</button
>
{#if open && table !== null}
  <div class="gg-a11y-table">
    <table>
      <thead>
        <tr>
          {#each table.fields as field (field)}<th>{field}</th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each table.rows as row, ri (ri)}
          <tr>
            {#each row as cell, ci (ci)}<td>{cell}</td>{/each}
          </tr>
        {/each}
      </tbody>
    </table>
    {#if table.total > table.rows.length}
      <p>First {table.rows.length} of {table.total} rows.</p>
    {/if}
  </div>
{/if}

<style>
  /* Full-size inert layer base; sr-only clip below keeps it in the a11y tree. */
  .gg-canvas-a11y {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  /* sr-only pattern (NOT display:none — must stay in the a11y tree). */
  .gg-canvas-a11y,
  .gg-a11y-toggle:not(:focus) {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }

  .gg-a11y-toggle {
    pointer-events: auto;
    position: absolute;
    top: 2px;
    left: 2px;
    font-size: 11px;
    line-height: 1.2;
  }

  .gg-a11y-table {
    position: absolute;
    inset: 0;
    overflow: auto;
    background: var(--gg-paper, #fff);
    color: var(--gg-ink, #1f2328);
    font-size: 11px;
    line-height: 1.4;
    pointer-events: auto;
  }

  .gg-a11y-table table {
    border-collapse: collapse;
  }

  .gg-a11y-table th,
  .gg-a11y-table td {
    border: 1px solid var(--gg-grid, rgba(128, 128, 128, 0.4));
    padding: 2px 6px;
    text-align: left;
  }
</style>
