<script lang="ts">
  import type { CATEGORICAL_SCHEME_NAMES } from "@ggts-sh/spec";

  type CategoricalSchemeName = (typeof CATEGORICAL_SCHEME_NAMES)[number];

  export interface IndexSpecimen {
    readonly name: CategoricalSchemeName;
    readonly label: string;
    readonly colors: readonly string[];
    readonly capacity: number;
    readonly colorblindSafe: boolean;
  }

  const {
    specimens,
    selected,
    reverse,
    onpreview,
    onselect,
  }: {
    specimens: readonly IndexSpecimen[];
    selected: CategoricalSchemeName;
    reverse: boolean;
    /** Transient preview: hover/focus sets it, leaving the list passes null. */
    onpreview: (name: CategoricalSchemeName | null) => void;
    /** Committed selection (click/tap/Enter/Space). */
    onselect: (name: CategoricalSchemeName) => void;
  } = $props();

  const clearIfFocusLeaves = (event: FocusEvent): void => {
    const next = event.relatedTarget;
    const list = event.currentTarget;
    if (
      list instanceof HTMLElement &&
      (!(next instanceof Node) || !list.contains(next))
    ) {
      onpreview(null);
    }
  };
</script>

<ol
  class="index"
  aria-label="Categorical palettes"
  onpointerleave={() => onpreview(null)}
  onfocusout={clearIfFocusLeaves}
>
  {#each specimens as specimen (specimen.name)}
    {@const displayColors = reverse
      ? specimen.colors.toReversed()
      : specimen.colors}
    {@const buttonLabel = `${specimen.label}, ${String(specimen.capacity)} colors${specimen.colorblindSafe ? ", CB-safe" : ""}`}
    <li>
      <button
        type="button"
        id={`scheme-${specimen.name}`}
        aria-label={buttonLabel}
        aria-pressed={specimen.name === selected}
        onpointerenter={() => onpreview(specimen.name)}
        onfocus={() => onpreview(specimen.name)}
        onclick={() => onselect(specimen.name)}
      >
        <span class="meta">
          <span class="name">{specimen.label}</span>
          <span class="detail">
            <span class="capacity">{specimen.capacity} colors</span
            >{#if specimen.colorblindSafe}&nbsp;·&nbsp;<span class="cb"
                >CB-safe</span
              >{/if}
          </span>
        </span>
        <!-- Decorative inside a named control: without an explicit button
             aria-label, every swatch label folds into the spoken name (and
             ARIA's presentational-children rule strips list roles inside a
             button anyway). Hex stays discoverable via title tooltips. -->
        <span class="strip" aria-hidden="true">
          {#each displayColors as color, index (`${color}-${String(index)}`)}
            <span class="cell" style={`--swatch:${color}`} title={color}></span>
          {/each}
        </span>
      </button>
    </li>
  {/each}
</ol>

<style>
  .index {
    margin: 0;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--line);
  }

  li {
    border-bottom: 1px solid var(--line);
  }

  button {
    display: grid;
    grid-template-columns: minmax(8rem, 13rem) 1fr;
    align-items: center;
    gap: 0.75rem 1.25rem;
    width: 100%;
    min-height: 2.75rem; /* 44px touch target */
    padding: 0.45rem 0.5rem;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  button:hover,
  button[aria-pressed="true"] {
    background: var(--wash);
  }

  button[aria-pressed="true"] .name {
    font-weight: 600;
  }

  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  @media (forced-colors: active) {
    button[aria-pressed="true"] {
      outline: 2px solid CanvasText;
      outline-offset: -2px;
    }
  }

  @media (max-width: 40rem) {
    button {
      grid-template-columns: 1fr;
      gap: 0.3rem;
    }
  }

  .name {
    display: block;
    font-size: 0.92rem;
    letter-spacing: -0.005em;
  }

  .detail {
    display: block;
    margin-top: 0.1rem;
    color: var(--muted);
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
  }

  .cb {
    letter-spacing: 0.04em;
  }

  .strip {
    display: flex;
    min-width: 0;
    gap: 2px;
  }

  .cell {
    flex: 1 1 0;
    display: block;
    min-width: 0.5rem;
    height: 1rem;
    background: var(--swatch);
  }
</style>
