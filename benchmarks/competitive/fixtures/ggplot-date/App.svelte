<script lang="ts">
  /** Bundle-attribution positive control: a temporal scale installs full Temporal support. */
  import { GeomPoint, GGPlot, ScaleXDate } from "@ggts-sh/svelte";

  const data = [
    { date: "2026-01-01", value: 10 },
    { date: "2026-02-01", value: 20 },
    { date: "2026-03-01", value: 15 },
  ];
</script>

<GGPlot {data} aes={{ x: "date", y: "value" }} width={480} height={320}>
  <ScaleXDate />
  <GeomPoint size={3} />
</GGPlot>
