<script lang="ts">
  import { base } from "$app/paths";
  import { onMount } from "svelte";
  import type { ColorScaleSpec } from "@ggts-sh/spec";

  import { observeUserIntent } from "$lib/load-on-intent";

  const {
    label,
    scale,
    staticSrc,
    height = 360,
  }: {
    label: string;
    scale: ColorScaleSpec;
    staticSrc: string;
    height?: number;
  } = $props();

  let host = $state<HTMLDivElement | null>(null);
  let Live = $state<
    typeof import("./SequentialColorLabLive.svelte").default | null
  >(null);

  onMount(() => {
    const el = host;
    if (el === null) return;
    let cancelled = false;
    const stop = observeUserIntent(el, () => {
      if (cancelled || Live !== null) return;
      void import("./SequentialColorLabLive.svelte").then((mod) => {
        if (!cancelled) Live = mod.default;
      });
    });
    return () => {
      cancelled = true;
      stop();
    };
  });
</script>

<div class="plot-panel" bind:this={host} style:min-height="{height}px">
  {#if Live !== null}
    <Live {label} {scale} {height} />
  {:else}
    <img
      class="static-shell"
      src={`${base}${staticSrc}`}
      alt=""
      width="832"
      {height}
      decoding="async"
      loading="lazy"
    />
  {/if}
</div>

<style>
  .plot-panel {
    width: min(100%, 52rem);
    min-width: 0;
  }

  .plot-panel :global(svg),
  .static-shell {
    display: block;
    max-width: 100%;
    height: auto;
  }
</style>
