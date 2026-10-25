<script lang="ts">
  import type { ComponentType } from "react";
  import { createElement } from "react";
  import { createRoot, type Root } from "react-dom/client";
  import { onMount } from "svelte";

  const { component }: { component: ComponentType } = $props();

  let host = $state<HTMLDivElement | undefined>();

  onMount(() => {
    const el = host;
    if (el === undefined) return;
    const root: Root = createRoot(el);
    root.render(createElement(component));
    return () => {
      root.unmount();
    };
  });
</script>

<div class="react-mount" data-plot="react" bind:this={host}></div>
