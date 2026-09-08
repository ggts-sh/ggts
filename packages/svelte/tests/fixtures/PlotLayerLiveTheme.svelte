<script lang="ts">
  /**
   * Live theme getter harness: mutates a source prop and asserts assembled
   * theme updates with registrationCount unchanged (ADR 0001 live getters).
   */
  import { untrack } from "svelte";
  import type { ThemeName } from "@ggts-sh/spec";

  import {
    provideRegistry,
    registerPlotLayer,
    type LayerRegistry,
  } from "../../src/lib/geoms/registry.svelte.js";

  const {
    theme,
    capture,
  }: {
    theme: ThemeName;
    capture?: (registry: LayerRegistry) => void;
  } = $props();

  const registry = provideRegistry();
  untrack(() => capture?.(registry));

  registerPlotLayer({
    kind: "theme",
    get value() {
      return theme;
    },
  });
</script>
