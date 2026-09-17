<script lang="ts">
  /**
   * Gallery and home source tabs: Svelte first, then optional verified React,
   * builder TypeScript, and canonical spec JSON — each with a copy button.
   */
  import { briefCopyStatus, COPIED_STATUS, copyText } from "$lib/clipboard";
  import {
    highlightDocsBlock,
    languageFromCodeTabLabel,
  } from "$lib/code-languages";
  import { CHECK_ICON_SVG, COPY_ICON_SVG } from "$lib/copy-icons";
  import { nextRovingTabIndex } from "$lib/tab-roving";

  interface Tab {
    label: string;
    code: string;
    language?: string;
  }

  const { tabs }: { tabs: Tab[] } = $props();

  let active = $state(0);
  let copyStatus = $state("");
  let codeNode = $state<HTMLElement>();
  const tabsetId = $props.id();
  const panelId = `${tabsetId}-panel`;
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  const activeTab = $derived(tabs[active]);
  const highlighted = $derived(
    highlightDocsBlock(
      activeTab?.code ?? "",
      activeTab?.language ?? languageFromCodeTabLabel(activeTab?.label),
    ),
  );
  const copied = $derived(copyStatus === COPIED_STATUS);

  async function copy(): Promise<void> {
    const code = tabs[active]?.code ?? "";
    if (codeNode === undefined) return;
    const result = await copyText(code, codeNode);
    clearTimeout(copyTimer);
    copyStatus = briefCopyStatus(result);
    if (result === "copied") {
      copyTimer = setTimeout(() => {
        copyStatus = "";
      }, 1500);
    }
  }

  function select(i: number): void {
    active = i;
    copyStatus = "";
  }

  function handleTabKey(event: KeyboardEvent, index: number): void {
    const next = nextRovingTabIndex(event.key, index, tabs.length);
    if (next === null) return;
    event.preventDefault();
    select(next);
    const target = event.currentTarget;
    if (!(target instanceof HTMLButtonElement)) return;
    const buttons =
      target.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[next]?.focus();
  }
</script>

<div class="code-tabs">
  <div class="bar">
    <div class="tabs" role="tablist" aria-label="Code representations">
      {#each tabs as tab, i (tab.label)}
        <button
          id={`${tabsetId}-tab-${String(i)}`}
          type="button"
          role="tab"
          aria-controls={panelId}
          aria-selected={i === active}
          tabindex={i === active ? 0 : -1}
          class:active={i === active}
          onclick={() => {
            select(i);
          }}
          onkeydown={(event) => {
            handleTabKey(event, i);
          }}
        >
          {tab.label}
        </button>
      {/each}
    </div>
    <button
      type="button"
      class="copy"
      class:copied
      aria-label={copied ? "Copied" : "Copy code"}
      onclick={copy}
    >
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted static SVG -->
      <span class="icon-copy" aria-hidden="true">{@html COPY_ICON_SVG}</span>
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted static SVG -->
      <span class="icon-check" aria-hidden="true">{@html CHECK_ICON_SVG}</span>
    </button>
    <span class="visually-hidden" role="status">{copyStatus}</span>
  </div>
  <div
    id={panelId}
    role="tabpanel"
    aria-labelledby={`${tabsetId}-tab-${String(active)}`}
  >
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (scrollable code must be keyboard reachable) -->
    <div
      class="scroll-region"
      role="region"
      aria-label="Code example"
      tabindex="0"
      bind:this={codeNode}
    >
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- highlight.js token spans; plaintext is escaped -->
      {@html highlighted}
    </div>
  </div>
</div>

<style>
  .code-tabs {
    min-width: 0;
    margin: 1.5rem 0;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--code-ink) 10%, transparent);
    border-radius: var(--code-radius);
    background: var(--code-paper);
    color: var(--code-ink);
  }

  .bar {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.25rem;
    padding: 0.15rem 0.5rem 0.15rem 0.75rem;
    border-bottom: 1px solid
      color-mix(in srgb, var(--code-ink) 10%, transparent);
  }

  .tabs {
    display: flex;
    min-width: 0;
    gap: 0.15rem;
    overflow-x: auto;
  }

  .bar button[role="tab"] {
    position: relative; /* anchors the extended hit region */
    min-height: 2.25rem;
    flex: 0 0 auto;
    padding: 0.3rem 0.65rem;
    border: 0;
    border-radius: var(--radius);
    background: none;
    color: color-mix(in srgb, var(--code-ink) 55%, transparent);
    cursor: pointer;
    font: 600 0.82rem/1 var(--body-font);
    transition: transform var(--duration-press) var(--ease-out);
  }

  /* 36px visual height, 44px hit height (DESIGN.md hit-region floor). */
  .bar button[role="tab"]::after {
    content: "";
    position: absolute;
    inset: -4px 0;
  }

  .bar button[role="tab"]:active {
    transform: scale(0.97);
  }

  @media (hover: hover) and (pointer: fine) {
    .bar button[role="tab"]:hover {
      color: var(--code-ink);
    }
  }

  /*
   * The card clips overflow for the rounded corners, so pull the global
   * 3px/3px-offset focus indicator inside the bar padding (same
   * compensation as .scroll-region below).
   */
  .bar button[role="tab"]:focus-visible,
  .bar .copy:focus-visible {
    outline-offset: -1px;
  }

  .bar button[role="tab"].active {
    background: color-mix(in srgb, var(--code-ink) 10%, transparent);
    color: var(--code-ink);
  }

  .bar .copy {
    position: relative; /* anchors the extended hit region */
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    min-width: 2rem;
    min-height: 2rem;
    margin-left: auto;
    padding: 0;
    border: 0;
    border-radius: var(--radius);
    background: none;
    color: color-mix(in srgb, var(--code-ink) 55%, transparent);
    cursor: pointer;
    transition:
      background-color 120ms ease,
      color 120ms ease,
      transform var(--duration-press) var(--ease-out);
  }

  /* 32px visual, 44px hit region (DESIGN.md hit-region floor). */
  .bar .copy::after {
    content: "";
    position: absolute;
    inset: -6px;
  }

  .bar .copy:active {
    transform: scale(0.97);
  }

  @media (hover: hover) and (pointer: fine) {
    .bar .copy:hover {
      background: color-mix(in srgb, var(--code-ink) 12%, transparent);
      color: var(--code-ink);
    }
  }

  .bar .copy .icon-copy,
  .bar .copy .icon-check {
    grid-area: 1 / 1;
    display: grid;
    place-items: center;
    transition: opacity var(--duration-icon) var(--ease-out);
  }

  .bar .copy .icon-copy {
    opacity: 1;
  }

  .bar .copy .icon-check {
    opacity: 0;
  }

  .bar .copy.copied .icon-copy {
    opacity: 0;
  }

  .bar .copy.copied .icon-check {
    opacity: 1;
  }

  /*
   * code-surface puts padding on the box; here the box is the scrollport.
   * Keep padding on the scrollable pre so inline-end gap survives horizontal
   * scroll (Blink/WebKit drop scrollport padding at the end of overflow).
   */
  .scroll-region {
    max-width: 100%;
    padding: 0;
    outline-offset: -2px;
  }

  .scroll-region :global(pre.hljs),
  .scroll-region :global(pre) {
    min-width: max-content;
    margin: 0;
    padding: 1rem;
    background: transparent !important;
    color: inherit;
    font-family: var(--code-font);
    font-size: 0.85rem;
    line-height: 1.6;
  }

  .scroll-region :global(code.hljs),
  .scroll-region :global(code) {
    background: transparent !important;
    font: inherit;
  }

  @media (max-width: 35rem) {
    .bar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .bar .copy {
      margin-left: 0;
    }
  }
</style>
