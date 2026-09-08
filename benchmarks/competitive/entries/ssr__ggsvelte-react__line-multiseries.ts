import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { GGPlot } from "@ggsvelte/react";
import { scenarioSpec } from "../adapters/ggsvelte-svg";
import { makeMultiSeries, PLOT_HEIGHT, PLOT_WIDTH } from "../scenarios";

const data = makeMultiSeries(3, 1000);

export function renderOnce(): { bytes: number; marks: number; head: string } {
  const body = renderToString(
    createElement(GGPlot, {
      spec: { ...scenarioSpec("line-multiseries"), data: { columns: data } },
      width: PLOT_WIDTH,
      height: PLOT_HEIGHT,
    }),
  );
  return {
    bytes: body.length,
    marks: (body.match(/<path[\s>]/g) ?? []).length,
    head: body.slice(0, 300),
  };
}
