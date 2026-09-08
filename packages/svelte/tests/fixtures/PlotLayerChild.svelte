<script lang="ts">
  /**
   * Test-only non-mark plot-layer child. Registers via `registerPlotLayer`
   * during init (same contract product children will use in later slices).
   * Live getter over `$props` so prop updates flow without re-registration.
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

  import { registerPlotLayer } from "../../src/lib/index.js";

  type Kind =
    "scale" | "theme" | "coord" | "facet" | "labs" | "guides" | "legend";

  const {
    kind,
    value,
  }: {
    kind: Kind;
    value:
      | Scales
      | ThemeName
      | ThemeSpec
      | CoordSpec
      | "flip"
      | FacetInput
      | Labs
      | GuidesSpec
      | LegendSpec;
  } = $props();

  // Init-time registration; value is a live getter over the props proxy.
  const k = untrack(() => kind);
  if (k === "scale") {
    registerPlotLayer({
      kind: "scale",
      get value() {
        return value as Scales;
      },
    });
  } else if (k === "theme") {
    registerPlotLayer({
      kind: "theme",
      get value() {
        return value as ThemeName | ThemeSpec;
      },
    });
  } else if (k === "coord") {
    registerPlotLayer({
      kind: "coord",
      get value() {
        return value as CoordSpec | "flip";
      },
    });
  } else if (k === "facet") {
    registerPlotLayer({
      kind: "facet",
      get value() {
        return value as FacetInput;
      },
    });
  } else if (k === "labs") {
    registerPlotLayer({
      kind: "labs",
      get value() {
        return value as Labs;
      },
    });
  } else if (k === "guides") {
    registerPlotLayer({
      kind: "guides",
      get value() {
        return value as GuidesSpec;
      },
    });
  } else {
    registerPlotLayer({
      kind: "legend",
      get value() {
        return value as LegendSpec;
      },
    });
  }
</script>
