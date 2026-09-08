<script lang="ts">
  /**
   * Host + probe for createPlotLayer: provideRegistry, capture, and a child
   * that registers one non-mark layer with a live value getter over $props.
   */
  import type {
    CoordSpec,
    FacetInput,
    GuidesSpec,
    Labs,
    LegendSpec,
    Scales,
    ThemeName,
    ThemeSpec,
  } from "@ggts-sh/spec";
  import { untrack } from "svelte";

  import type { LayerRegistry } from "../../src/lib/geoms/registry.svelte.js";
  import { provideRegistry } from "../../src/lib/geoms/registry.svelte.js";
  import {
    createPlotLayer,
    type PlotLayerKind,
  } from "../../src/lib/layers/plot-layer.svelte.js";

  type ValueFor =
    | Scales
    | ThemeName
    | ThemeSpec
    | CoordSpec
    | "flip"
    | FacetInput
    | Labs
    | GuidesSpec
    | LegendSpec;

  const {
    capture,
    kind,
    value,
  }: {
    capture?: (registry: LayerRegistry) => void;
    kind: PlotLayerKind;
    value: ValueFor;
  } = $props();

  const registry = provideRegistry();
  untrack(() => capture?.(registry));

  // Kind is fixed at init (ADR 0001 register-once); only `value` is live.
  // Literal arms keep createPlotLayer's kind→value correlation at each site.
  const fixedKind = untrack(() => kind);
  if (fixedKind === "scale") {
    createPlotLayer("scale", () => value as Scales);
  } else if (fixedKind === "theme") {
    createPlotLayer("theme", () => value as ThemeName | ThemeSpec);
  } else if (fixedKind === "coord") {
    createPlotLayer("coord", () => value as CoordSpec | "flip");
  } else if (fixedKind === "facet") {
    createPlotLayer("facet", () => value as FacetInput);
  } else if (fixedKind === "labs") {
    createPlotLayer("labs", () => value as Labs);
  } else if (fixedKind === "guides") {
    createPlotLayer("guides", () => value as GuidesSpec);
  } else {
    createPlotLayer("legend", () => value as LegendSpec);
  }
</script>
