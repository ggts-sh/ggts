import { flushSync, mount, unmount } from "svelte";

import GGPlotChart from "../components/ggsvelte/GGPlotChart.svelte";
import { PLOT_HEIGHT, PLOT_WIDTH, type UpdateColumns, type ScenarioId } from "../scenarios";

export function mountGgsvelteGgplot(scenario: ScenarioId, data: UpdateColumns, root: HTMLElement) {
  root.replaceChildren();
  const component = mount(GGPlotChart, {
    target: root,
    props: { data, scenario, width: PLOT_WIDTH, height: PLOT_HEIGHT },
  });
  flushSync();
  return {
    markHint: root.querySelectorAll("circle, path, rect").length,
    handle: {
      update(next: UpdateColumns) {
        component.setData(next);
        flushSync();
      },
      destroy() {
        void unmount(component);
      },
    },
  };
}
