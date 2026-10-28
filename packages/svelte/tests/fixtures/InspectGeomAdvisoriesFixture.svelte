<script lang="ts">
  /**
   * Host for inspect-geom advisory mount tests (#1206). Mounts GeomCol (and
   * optionally GeomText value labels) as CHILD components under GGPlot so the
   * registry → assembled().layers → collector path is exercised; the
   * layers-prop path is covered inline in inspect-geom-diagnostics.test.ts.
   */
  import type { PlotDiagnostic } from "../../src/lib/diagnostics/deprecation.js";
  import type { InspectInput } from "../../src/lib/interaction/interaction.js";
  import GGPlot from "../../src/lib/GGPlot.svelte";
  import "../../src/lib/host-init.js";
  import GeomCol from "../../src/lib/geoms/GeomCol.svelte";
  import GeomText from "../../src/lib/geoms/GeomText.svelte";

  type Row = { id: string; x: number; y: number; label: string };

  const {
    data,
    aes,
    width = 480,
    height = 320,
    inspect,
    withLabels = false,
    ondiagnostic,
  }: {
    data: readonly Row[];
    aes: { x: string; y: string };
    width?: number;
    height?: number;
    inspect: InspectInput;
    withLabels?: boolean;
    ondiagnostic?: (diagnostic: PlotDiagnostic) => void;
  } = $props();
</script>

<GGPlot {data} {aes} {width} {height} {inspect} {ondiagnostic}>
  <GeomCol />
  {#if withLabels}
    <GeomText aes={{ x: aes.x, y: aes.y, label: "label" }} />
  {/if}
</GGPlot>
