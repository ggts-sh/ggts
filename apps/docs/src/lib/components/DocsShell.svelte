<script lang="ts">
  import type { Snippet } from "svelte";

  import { GUIDE_NAVIGATION, primaryNavigationOwner } from "$lib/routes-nav";
  import type { DocsRouteMetadata } from "$lib/route-types";
  import { buildDocsCrumbs } from "$scripts/docs-breadcrumbs";

  import Breadcrumbs from "./Breadcrumbs.svelte";
  import DocsSidebar from "./DocsSidebar.svelte";
  import OnThisPage from "./OnThisPage.svelte";
  import PrevNext from "./PrevNext.svelte";

  const {
    route,
    path,
    previous,
    next,
    children,
  }: {
    route: DocsRouteMetadata;
    path: string;
    previous?: DocsRouteMetadata;
    next?: DocsRouteMetadata;
    children: Snippet;
  } = $props();

  let chapterDialog = $state<HTMLDialogElement>();
  const headings = $derived(route.headings ?? []);
  const displayTitle = $derived(
    route.navigation?.label ?? route.title.replace(" — ggts", ""),
  );
  const reference = $derived(primaryNavigationOwner(route) === "reference");
  const crumbs = $derived(buildDocsCrumbs(path, displayTitle, reference));

  function openChapters(): void {
    chapterDialog?.showModal();
  }

  function closeChapters(): void {
    chapterDialog?.close();
  }

  function closeFromBackdrop(event: MouseEvent): void {
    if (event.target === chapterDialog) closeChapters();
  }
</script>

<a class="skip-link docs-skip" href="#guide-chapters-trigger"
  >Skip to docs navigation</a
>

<div class="docs-mobile-tools site-chrome">
  <button
    id="guide-chapters-trigger"
    type="button"
    aria-label="Open docs navigation"
    onclick={openChapters}>Menu</button
  >
  {#if headings.length > 0}
    <details>
      <summary>On this page</summary>
      <OnThisPage {headings} />
    </details>
  {/if}
</div>

<div class="docs-layout">
  <aside id="guide-chapters" class="docs-rail" tabindex="-1">
    <DocsSidebar groups={GUIDE_NAVIGATION} {path} />
  </aside>

  <div class="docs-article">
    <Breadcrumbs {crumbs} />
    {@render children()}
    <PrevNext {previous} {next} />
  </div>

  <aside class="contents-rail">
    <OnThisPage {headings} />
  </aside>
</div>

<dialog
  class="chapter-dialog"
  bind:this={chapterDialog}
  onclick={closeFromBackdrop}
>
  <div class="chapter-dialog__panel">
    <div class="chapter-dialog__heading">
      <span>Docs</span>
      <button
        type="button"
        aria-label="Close docs navigation"
        onclick={closeChapters}>Close</button
      >
    </div>
    <DocsSidebar groups={GUIDE_NAVIGATION} {path} onNavigate={closeChapters} />
  </div>
</dialog>
