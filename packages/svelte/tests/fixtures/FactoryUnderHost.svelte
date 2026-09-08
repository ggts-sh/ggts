<script lang="ts">
  /**
   * Stable registry host wrapping FactoryProbe so createGeomLayer registers
   * under provideRegistry and live prop updates share one registry instance.
   */
  import type { GeomName } from "@ggts-sh/spec";
  import { untrack } from "svelte";

  import type { LayerRegistry } from "../../src/lib/geoms/registry.svelte.js";
  import { provideRegistry } from "../../src/lib/geoms/registry.svelte.js";
  import FactoryProbe from "./FactoryProbe.svelte";

  const {
    capture,
    geom,
    layerRender,
    ...rest
  }: {
    capture?: (registry: LayerRegistry) => void;
    geom: GeomName;
    /** Maps to GeomProps.render (backend hint). */
    layerRender?: "svg" | "canvas" | "auto";
    [key: string]: unknown;
  } = $props();

  const registry = provideRegistry();
  // The registry is intentionally exposed once during component init.
  untrack(() => capture?.(registry));
</script>

<FactoryProbe {geom} render={layerRender} {...rest} />
