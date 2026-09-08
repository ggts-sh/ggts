import { render } from "svelte/server";
import GGPlotChart from "../components/ggsvelte/GGPlotChart.svelte";
import { makeScatter, PLOT_HEIGHT, PLOT_WIDTH } from "../scenarios";

const data = makeScatter(1000);

export function renderOnce(): { bytes: number; marks: number; head: string } {
  const { body } = render(GGPlotChart, {
    props: { data, scenario: "scatter-color", width: PLOT_WIDTH, height: PLOT_HEIGHT },
  });
  return {
    bytes: body.length,
    marks: (body.match(/<circle[\s>]/g) ?? []).length,
    head: body.slice(0, 300),
  };
}
