import { render } from "svelte/server";
import GGPlotChart from "../components/ggsvelte/GGPlotChart.svelte";
import { makeMultiSeries, PLOT_HEIGHT, PLOT_WIDTH } from "../scenarios";

const data = makeMultiSeries(3, 1000);

export function renderOnce(): { bytes: number; marks: number; head: string } {
  const { body } = render(GGPlotChart, {
    props: { data, scenario: "line-multiseries", width: PLOT_WIDTH, height: PLOT_HEIGHT },
  });
  return {
    bytes: body.length,
    marks: (body.match(/<path[\s>]/g) ?? []).length,
    head: body.slice(0, 300),
  };
}
