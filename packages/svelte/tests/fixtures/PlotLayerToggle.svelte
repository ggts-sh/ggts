<script lang="ts">
  /**
   * Keyed {#each} toggle harness for ADR 0001 finding-3 stress on non-mark
   * layers: destroying one child and creating another in the same flush must
   * not lose the new registration.
   */
  import { untrack } from "svelte";
  import type { ThemeName } from "@ggts-sh/spec";

  import {
    provideRegistry,
    type LayerRegistry,
  } from "../../src/lib/geoms/registry.svelte.js";
  import PlotLayerRegisterChild from "./PlotLayerRegisterChild.svelte";

  const {
    tags,
    capture,
  }: {
    /** Theme tags; keyed so remove+add in one flush exercises the Map store. */
    tags: readonly string[];
    capture?: (registry: LayerRegistry) => void;
  } = $props();

  const registry = provideRegistry();
  untrack(() => capture?.(registry));

  function themeLayer(_tag: string) {
    return {
      kind: "theme" as const,
      get value(): ThemeName {
        return "light";
      },
    };
  }
</script>

{#each tags as tag (tag)}
  <PlotLayerRegisterChild layer={themeLayer(tag)} />
{/each}
