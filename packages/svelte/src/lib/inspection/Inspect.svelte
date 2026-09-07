<script lang="ts">
  /**
   * <Inspect> — declaration-only host inspect capability for <GGPlot>.
   *
   * Presence enables inspection (tooltip, crosshair, pin, keyboard). Props
   * match InspectOptions (mode, pin, maxDistance, contentMode, muteSiblings,
   * tooltipTotal, content). Empty `<Inspect />` ≡ `inspect={true}` on GGPlot.
   *
   * Host-only: not folded into PortableSpec. Mark eligibility remains
   * `inspect={false}` on individual geoms.
   *
   * Emits NO markup; registers a live capability during component init and
   * unregisters on destroy. Inert without a <GGPlot> ancestor.
   */
  import type { Snippet } from "svelte";

  import type { CellValue } from "@ggsvelte/core";

  import type {
    InspectMode,
    PlotInspectionChange,
    TooltipTotal,
  } from "../interaction/interaction.js";

  import { definedProps } from "../layers/plot-layer.svelte.js";
  import { registerHostCapability } from "../geoms/registry.svelte.js";

  type Props = {
    mode?: InspectMode;
    pin?: boolean;
    maxDistance?: number;
    contentMode?: "informational" | "interactive";
    muteSiblings?: boolean;
    tooltipTotal?: TooltipTotal;

    /**
     * Durable row identity (column or accessor). Preferred over deprecated
     * GGPlot `key`. Default when omitted: `id` column or row index.
     */
    identity?:
      | PropertyKey
      | ((row: Record<string, CellValue>, index: number) => PropertyKey);
    /** Row/Key widen at the non-generic registry boundary (same as engine). */
    content?: Snippet<
      [PlotInspectionChange<Record<string, CellValue>, PropertyKey>]
    >;
  };

  /** Known InspectOptions keys — typo props never reach normalize silently. */
  const KNOWN = new Set([
    "mode",
    "pin",
    "maxDistance",
    "contentMode",
    "muteSiblings",
    "identity",
    "content",
    "tooltipTotal",
  ]);

  const props: Props = $props();

  registerHostCapability("inspect", () => {
    const bag = definedProps(props) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(bag)) {
      if (KNOWN.has(key)) out[key] = bag[key];
    }
    return out as Props;
  });
</script>
