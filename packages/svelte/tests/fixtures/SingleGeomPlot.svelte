<script lang="ts">
  /**
   * Mount one declaration-only Geom* child under GGPlot for the parameterized
   * geoms suite (registration + prop → assembled layer path).
   */
  import type { Component } from "svelte";

  import type { AesInput } from "@ggts-sh/spec";

  import type { PortableSpec, RenderModel } from "../../src/lib/index.js";
  import GGPlot from "../../src/lib/GGPlot.svelte";

  const {
    Geom,
    geomProps = {},
    data,
    aes,
    onrender,
  }: {
    Geom: Component;
    geomProps?: Record<string, unknown>;
    data: readonly Record<string, unknown>[];
    aes: AesInput;
    onrender?: (model: RenderModel, spec: PortableSpec) => void;
  } = $props();
</script>

<GGPlot {data} {aes} width={480} height={320} {onrender}>
  <Geom {...geomProps} />
</GGPlot>
