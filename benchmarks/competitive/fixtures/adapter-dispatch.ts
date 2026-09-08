/**
 * Library dispatch for the browser harness: `mountSync` maps every browser
 * LibId to its adapter mount. Core ggsvelte scene registrations run at
 * module init, before any mount can happen.
 */
import {
  registerBasicAreas,
  registerBasicBars,
  registerBasicLines,
  registerBasicPoints,
  registerBandGuide,
  registerOrdinalColor,
} from "@ggsvelte/core/headless/register";

import { mountChartJs } from "../adapters/chartjs";
import { mountD3 } from "../adapters/d3";
import { mountEcharts } from "../adapters/echarts";
import { mountGgsvelteCanvas } from "../adapters/ggsvelte-canvas";
import { mountGgsvelteSvg } from "../adapters/ggsvelte-svg";
import { mountLayerCake, mountLayerCakeCanvas } from "../adapters/layercake";
import { mountSveltePlot } from "../adapters/svelteplot";
import { mountTanstackReact } from "../adapters/tanstack-react";
import { mountTanstackSvelte } from "../adapters/tanstack-svelte";
import { mountUnovis } from "../adapters/unovis";
import { mountUplot } from "../adapters/uplot";
import {
  LIBS,
  type LibId,
  type ScenarioCase,
  type ScenarioId,
  type UpdateColumns,
} from "../scenarios";
import type { MountHandle } from "./lifecycle";

// The harness loads the requested GGPlot host on its own page.
// A static import would install its registrations in every peer cell.
const ggplotAdapter = new URLSearchParams(location.search).has("ggplot")
  ? await import("../adapters/ggsvelte-ggplot")
  : null;
const reactAdapter = new URLSearchParams(location.search).has("ggreact")
  ? await import("../adapters/ggsvelte-react")
  : null;

registerBasicPoints();
registerBasicLines();
registerBasicAreas();
registerBasicBars();
registerOrdinalColor();
registerBandGuide();

export function mountSync(
  lib: LibId,
  scenario: ScenarioId,
  data: UpdateColumns,
  root: HTMLElement,
): { markHint: number; handle?: MountHandle } {
  switch (lib) {
    case "ggsvelte-svg":
      return mountGgsvelteSvg(scenario, data, root);
    case "ggsvelte-canvas":
      return mountGgsvelteCanvas(scenario, data, root);
    case "d3":
      return mountD3(scenario, data, root);
    case "uplot": {
      const r = mountUplot(scenario, data as never, root);
      return { markHint: r.markHint, handle: r.handle };
    }
    case "chartjs": {
      const r = mountChartJs(scenario, data, root);
      return { markHint: r.markHint, handle: r.handle };
    }
    case "echarts": {
      const r = mountEcharts(scenario, data, root);
      return { markHint: r.markHint, handle: r.handle };
    }
    case "svelteplot": {
      const r = mountSveltePlot(scenario, data, root);
      return { markHint: r.markHint, handle: r.handle };
    }
    case "layercake": {
      const r = mountLayerCake(scenario, data, root);
      return { markHint: r.markHint, handle: r.handle };
    }
    case "layercake-canvas": {
      const r = mountLayerCakeCanvas(scenario, data, root);
      return { markHint: r.markHint, handle: r.handle };
    }
    case "unovis": {
      const r = mountUnovis(scenario, data, root);
      return { markHint: r.markHint, handle: r.handle };
    }
    case "tanstack-svelte": {
      const r = mountTanstackSvelte(scenario, data, root);
      return { markHint: r.markHint, handle: r.handle };
    }
    case "tanstack-react": {
      const r = mountTanstackReact(scenario, data, root);
      return { markHint: r.markHint, handle: r.handle };
    }
    case "ggsvelte-ggplot": {
      if (ggplotAdapter === null) throw new Error("ggsvelte-ggplot is not loaded");
      return ggplotAdapter.mountGgsvelteGgplot(scenario, data, root);
    }
    case "ggsvelte-react": {
      if (reactAdapter === null) throw new Error("ggsvelte-react is not loaded");
      return reactAdapter.mountGgsvelteReact(scenario, data, root);
    }
    default:
      throw new Error(
        `lib ${lib} has no browser harness (bundle-only peer — see scenarios.ts LIBS)`,
      );
  }
}

/** Shared mount guards for mountLib/updateLib: lib must exist, be browser
 * mounted (ggplot counts once its adapter has loaded), and support the case's
 * scenario. */
export function assertMountable(lib: string, c: ScenarioCase): void {
  const meta = LIBS.find((l) => l.id === lib);
  if (meta === undefined) throw new Error(`unknown lib ${lib}`);
  if (
    !meta.browser &&
    !(lib === "ggsvelte-ggplot" && ggplotAdapter !== null) &&
    !(lib === "ggsvelte-react" && reactAdapter !== null)
  ) {
    throw new Error(`${lib} is bundle-only in this harness`);
  }
  if (!meta.scenarios.includes(c.scenario)) {
    throw new Error(`${lib} does not support scenario ${c.scenario}`);
  }
}

/** Whether the optional ggplot adapter loaded (drives catalog availability). */
export function ggplotLoaded(): boolean {
  return ggplotAdapter !== null;
}

export function reactLoaded(): boolean {
  return reactAdapter !== null;
}
