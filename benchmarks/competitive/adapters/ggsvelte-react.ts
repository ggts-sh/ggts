import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { GGPlot } from "@ggsvelte/react";
import { scenarioSpec } from "./ggsvelte-svg";
import { PLOT_HEIGHT, PLOT_WIDTH, type ScenarioId, type UpdateColumns } from "../scenarios";

export function mountGgsvelteReact(scenario: ScenarioId, data: UpdateColumns, root: HTMLElement) {
  root.replaceChildren();
  const el = document.createElement("div");
  el.style.width = `${PLOT_WIDTH}px`;
  el.style.height = `${PLOT_HEIGHT}px`;
  root.appendChild(el);
  const reactRoot = createRoot(el);
  const render = (next: UpdateColumns) => {
    flushSync(() =>
      reactRoot.render(
        createElement(GGPlot, {
          spec: { ...scenarioSpec(scenario), data: { columns: next } },
          width: PLOT_WIDTH,
          height: PLOT_HEIGHT,
        }),
      ),
    );
  };
  render(data);
  return {
    markHint: root.querySelectorAll("circle, path, rect").length,
    handle: {
      update: render,
      destroy() {
        flushSync(() => reactRoot.unmount());
      },
    },
  };
}
