<script lang="ts">
  /**
   * <GuideLegend> — declaration-only legend-guide layer for <GGPlot>
   * (#659 slice 6). Presentation of one aesthetic's legend: title, position,
   * direction, key size, collision, and the INTEGER placement rank `order`.
   *
   * Host interaction: `focus` and `filter` opt this channel into discrete
   * legend emphasis / data-changing checkboxes. They are NOT PortableSpec
   * fields — stripped before guideLegend() and registered as host layer
   * kinds `legendFocus` / `legendFilter`. Focus- or filter-only children
   * (no presentation options) do not force a guides entry, so continuous
   * colour scales keep their colorbar without a guide-aesthetic-incompatible
   * pipeline error.
   *
   * Not to be confused with <Legend order="sorted"/>, which is the plot-wide
   * entry-SORT enum (LegendSpec). Same word, unrelated concepts.
   * Emits NO markup.
   */
  import { guideLegend, type LegendGuideOptions } from "@ggts-sh/spec";

  import type { LegendFocusInput } from "../interaction/interaction.js";
  import type { LegendFilterInput } from "../legend/filter.js";
  import {
    isLegendFilterPropEnabled,
    type LegendFilterLayerValue,
  } from "../legend/resolve-legend-filter.js";
  import {
    isLegendFocusPropEnabled,
    type LegendFocusLayerValue,
  } from "../legend/resolve-legend-focus.js";
  import {
    createPlotLayer,
    definedProps,
  } from "../layers/plot-layer.svelte.js";
  import {
    splitChannel,
    type NonPositionGuideChannel,
  } from "./factory.svelte.js";

  type Props = LegendGuideOptions & {
    channel: NonPositionGuideChannel;
    /**
     * Opt this channel into discrete legend preview, focus, and linked
     * emphasis. Host-only — never appears in PortableSpec.
     */
    focus?: LegendFocusInput;
    /**
     * Opt this channel into data-changing filtering through discrete legend
     * checkboxes. Host-only — never appears in PortableSpec.
     */
    filter?: LegendFilterInput;
  };

  const props: Props = $props();

  createPlotLayer("guides", () => {
    const defined = definedProps(props) as Props;
    const { focus: _focus, filter: _filter, ...withoutHost } = defined;
    const { channel, options } = splitChannel(withoutHost);
    // Focus/filter-only: do not force type:"legend" (breaks continuous ramps).
    if (
      Object.keys(options).length === 0 &&
      (isLegendFocusPropEnabled(defined.focus) ||
        isLegendFilterPropEnabled(defined.filter))
    ) {
      return {};
    }
    return { [channel]: guideLegend(options) };
  });

  createPlotLayer("legendFocus", (): LegendFocusLayerValue => {
    const defined = definedProps(props) as Props;
    const focus = defined.focus;
    if (!isLegendFocusPropEnabled(focus)) return null;
    return {
      channel: defined.channel,
      input: focus === true ? true : focus,
    };
  });

  createPlotLayer("legendFilter", (): LegendFilterLayerValue => {
    const defined = definedProps(props) as Props;
    const filter = defined.filter;
    if (!isLegendFilterPropEnabled(filter)) return null;
    return {
      channel: defined.channel,
      input: filter === true ? true : filter,
    };
  });
</script>
