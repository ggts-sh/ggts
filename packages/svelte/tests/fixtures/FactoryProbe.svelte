<script lang="ts">
  /**
   * Thin shell that exercises createGeomLayer the same way real Geom*
   * components do: live $props proxy + schema-derived param whitelist.
   */
  import type { GeomName } from "@ggts-sh/spec";
  import { untrack } from "svelte";

  import {
    createGeomLayer,
    type GeomProps,
  } from "../../src/lib/geoms/factory.svelte.js";

  interface Props extends GeomProps {
    geom: GeomName;
    /** Any geom params (alpha, size, …) travel via the live props proxy. */
    [key: string]: unknown;
  }

  const props: Props = $props();
  createGeomLayer(
    untrack(() => props.geom),
    () => props,
  );
</script>
