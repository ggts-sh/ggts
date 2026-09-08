import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { GGPlot } from "@ggts-sh/react";
import { scenarioSpec } from "../adapters/ggsvelte-svg";
import { makeScatter, PLOT_HEIGHT, PLOT_WIDTH } from "../scenarios";

const data = makeScatter(1000);

export function renderOnce(): { bytes: number; marks: number; head: string } {
  const body = renderToString(
    createElement(GGPlot, {
      spec: { ...scenarioSpec("scatter-color"), data: { columns: data } },
      width: PLOT_WIDTH,
      height: PLOT_HEIGHT,
    }),
  );
  return {
    bytes: body.length,
    marks: (body.match(/<circle[\s>]/g) ?? []).length,
    head: body.slice(0, 300),
  };
}
