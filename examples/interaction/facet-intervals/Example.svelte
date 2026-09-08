<script lang="ts">
  import type { FacetIntervalPreset } from "@ggts-sh/svelte";
  import {
    FacetWrap,
    GeomPoint,
    GGPlot,
    Inspect,
    Labs,
    ThemeClean,
  } from "@ggts-sh/svelte";

  import { observations } from "./data.js";

  const presets: readonly FacetIntervalPreset[] = [
    "independent",
    "union",
    "cross-panel",
  ];
  let preset = $state<FacetIntervalPreset>("independent");
  let status = $state("Choose Select area, then draw inside any facet.");

  const descriptions: Record<FacetIntervalPreset, string> = {
    independent: "The newest interval replaces only its origin panel.",
    union: "Each panel keeps its own interval; selected keys are combined.",
    "cross-panel":
      "One semantic domain is projected through every compatible panel.",
  };
</script>

<div class="facet-interval-demo">
  <fieldset class="gg-demo-chrome">
    <legend>Facet interval behavior</legend>
    {#each presets as option}
      <label>
        <input
          type="radio"
          name="facet-preset"
          value={option}
          bind:group={preset}
        />
        <span>{option}</span>
      </label>
    {/each}
  </fieldset>
  <p class="explanation gg-demo-chrome">{descriptions[preset]}</p>
  <p class="status gg-demo-chrome" role="status" aria-live="polite">{status}</p>
  <GGPlot
    data={observations}
    aes={{ x: "bill", y: "mass" }}
    select={{ type: "interval", mode: "xy", persistent: true, preset }}
    width="container"
    height={430}
    onselect={(event) => {
      if (event.mode === "point") return;
      status =
        event.phase === "clear"
          ? "Facet intervals cleared."
          : `${event.phase}: ${String(event.keys.length)} rows selected from ${event.panelId}.`;
    }}
  >
    <GeomPoint size={3.8} />
    <FacetWrap field="island" ncol={3} />
    <ThemeClean />
    <Labs
      title="Palmer penguins by island"
      subtitle={`${preset} interval semantics`}
      x="Bill length (mm)"
      y="Body mass (g)"
    />
    <Inspect mode="xy" pin maxDistance={24} />
  </GGPlot>
</div>

<style>
  .facet-interval-demo {
    display: grid;
    gap: 0.65rem;
  }

  fieldset {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem 0.8rem;
    margin: 0;
    border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
    border-radius: 0.55rem;
    padding: 0.7rem 0.85rem 0.8rem;
    color: var(--fg, #17202a);
    font: 0.86rem/1.4 var(--gg-font-family, system-ui, sans-serif);
  }

  legend {
    padding-inline: 0.3rem;
    font-weight: 700;
  }

  label {
    display: inline-flex;
    min-height: 44px;
    align-items: center;
    gap: 0.38rem;
    border-radius: 0.4rem;
    padding: 0.3rem 0.45rem;
  }

  label:has(:focus-visible) {
    outline: 3px solid
      color-mix(in srgb, var(--accent, #2c7fb8) 45%, transparent);
    outline-offset: 1px;
  }

  input {
    width: 1rem;
    height: 1rem;
  }

  .explanation,
  .status {
    margin: 0;
    color: var(--muted, #59636e);
    font: 0.84rem/1.4 var(--gg-font-family, system-ui, sans-serif);
  }

  .status {
    min-height: 1.2rem;
  }
</style>
