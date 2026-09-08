<script lang="ts">
  import { base } from "$app/paths";
  import { onMount } from "svelte";

  import {
    readDocsAppearance,
    toggleDocsAppearance,
    writeDocsAppearance,
    type DocsAppearance,
  } from "$lib/docs-appearance";
  import { primaryNavLinks } from "$lib/primary-nav-links";
  import { primaryNavigationOwner } from "$lib/routes-nav";
  import type { DocsRouteMetadata } from "$lib/route-types";
  import type { Component } from "svelte";

  type SiteSearchApi = { open: (trigger: HTMLElement) => void };

  const { path, route }: { path: string; route?: DocsRouteMetadata } = $props();
  const owner = $derived(primaryNavigationOwner(route));

  let menu = $state<HTMLDialogElement>();
  let search = $state<SiteSearchApi | undefined>();
  // Dynamic component; bind:this is narrowed via $effect after mount.
  let SiteSearch = $state<Component | null>(null);
  /** Open target while SiteSearch is mounting (first open only). */
  let pendingSearchTrigger = $state<HTMLElement | null>(null);
  let appearance = $state<DocsAppearance>("light");

  const links = $derived(primaryNavLinks(path, owner));

  function syncAppearance(): void {
    appearance = readDocsAppearance();
  }

  function toggleAppearance(): void {
    syncAppearance();
    appearance = toggleDocsAppearance(appearance);
    writeDocsAppearance(appearance);
  }

  function openMenu(): void {
    menu?.showModal();
  }

  /**
   * Search UI + index stay off the first-paint graph. Mount the dialog on the
   * first open, then call open() once bind:this is set.
   */
  async function openSearch(event: MouseEvent): Promise<void> {
    if (!(event.currentTarget instanceof HTMLElement)) return;
    const trigger = event.currentTarget;
    if (search !== undefined) {
      search.open(trigger);
      return;
    }
    pendingSearchTrigger = trigger;
    if (SiteSearch === null) {
      const mod = await import("./SiteSearch.svelte");
      SiteSearch = mod.default;
    }
  }

  $effect(() => {
    const api = search;
    const trigger = pendingSearchTrigger;
    if (api === undefined || trigger === null) return;
    pendingSearchTrigger = null;
    api.open(trigger);
  });

  function closeMenu(): void {
    menu?.close();
  }

  function closeFromBackdrop(event: MouseEvent): void {
    if (event.target === menu) closeMenu();
  }

  onMount(syncAppearance);
</script>

<header class="site-header site-chrome">
  <div class="site-header__inner">
    <a class="site-brand" href={`${base}/`} aria-label="ggts home">ggts</a>

    <nav class="desktop-nav" aria-label="Primary">
      {#each links as link (link.href)}
        <a
          href={`${base}${link.href}`}
          aria-current={link.active ? "page" : undefined}>{link.label}</a
        >
      {/each}
    </nav>

    <div class="site-actions desktop-actions">
      <button type="button" class="search-trigger" onclick={openSearch}>
        Search <span class="visually-hidden">documentation</span>
      </button>
      <button type="button" class="appearance" onclick={toggleAppearance}>
        {appearance === "dark" ? "Light" : "Dark"}
        <span class="visually-hidden">appearance</span>
      </button>
      <a
        class="github-link"
        href="https://github.com/ggts-sh/ggts"
        rel="external"
        aria-label="GitHub"
        title="GitHub"
      >
        <!-- Phosphor GithubLogo fill; currentColor follows light/dark chrome. -->
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          fill="currentColor"
          viewBox="0 0 256 256"
          aria-hidden="true"
        >
          <path
            d="M216,104v8a56.06,56.06,0,0,1-48.44,55.47A39.8,39.8,0,0,1,176,192v40a8,8,0,0,1-8,8H104a8,8,0,0,1-8-8V216H72a40,40,0,0,1-40-40A24,24,0,0,0,8,152a8,8,0,0,1,0-16,40,40,0,0,1,40,40,24,24,0,0,0,24,24H96v-8a39.8,39.8,0,0,1,8.44-24.53A56.06,56.06,0,0,1,56,112v-8a58.14,58.14,0,0,1,7.69-28.32A59.78,59.78,0,0,1,69.07,28,8,8,0,0,1,76,24a59.75,59.75,0,0,1,48,24h24a59.75,59.75,0,0,1,48-24,8,8,0,0,1,6.93,4,59.74,59.74,0,0,1,5.37,47.68A58,58,0,0,1,216,104Z"
          />
        </svg>
      </a>
    </div>

    <button
      type="button"
      class="mobile-search-trigger"
      aria-label="Search documentation"
      onclick={openSearch}>Search</button
    >

    <button
      type="button"
      class="menu-trigger"
      aria-label="Open site menu"
      onclick={openMenu}
    >
      <span aria-hidden="true"></span><span aria-hidden="true"></span><span
        aria-hidden="true"
      ></span>
    </button>
  </div>
</header>

<dialog class="site-menu" bind:this={menu} onclick={closeFromBackdrop}>
  <div class="site-menu__panel">
    <div class="site-menu__heading">
      <span>Navigate</span>
      <button type="button" aria-label="Close site menu" onclick={closeMenu}
        >Close</button
      >
    </div>
    <nav aria-label="Primary">
      {#each links as link (link.href)}
        <a
          href={`${base}${link.href}`}
          aria-current={link.active ? "page" : undefined}
          onclick={closeMenu}>{link.label}</a
        >
      {/each}
      <a
        href="https://github.com/ggts-sh/ggts"
        rel="external"
        onclick={closeMenu}>GitHub ↗</a
      >
    </nav>
    <button
      type="button"
      class="appearance mobile-appearance"
      onclick={toggleAppearance}
    >
      Use {appearance === "dark" ? "light" : "dark"} appearance
    </button>
  </div>
</dialog>

{#if SiteSearch}
  <SiteSearch
    bind:this={
      () => search,
      (value) => {
        search = value as unknown as SiteSearchApi | undefined;
      }
    }
  />
{/if}
