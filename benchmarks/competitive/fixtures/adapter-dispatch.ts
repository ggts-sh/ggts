/**
 * Load the browser adapters before publishing the fixture API. Driver pages
 * select one library. The unscoped fixture supports multiple peers per page.
 */
import {
  registerBasicAreas,
  registerBasicBars,
  registerBasicLines,
  registerBasicPoints,
  registerBandGuide,
  registerOrdinalColor,
} from "@ggts-sh/core/headless/register";

import {
  LIBS,
  type LibId,
  type LibMeta,
  type ScenarioCase,
  type ScenarioId,
  type UpdateColumns,
} from "../scenarios";
import type { MountHandle } from "./lifecycle";

type MountAdapter = (
  scenario: ScenarioId,
  data: UpdateColumns,
  root: HTMLElement,
) => { markHint: number; handle?: MountHandle };

const params = new URLSearchParams(location.search);
const selected = params.get("lib");
const mounts = new Map<LibId, MountAdapter>();

async function loadAdapter(
  id: LibId,
  load: () => Promise<MountAdapter>,
  legacyFlag?: "ggplot" | "ggreact",
): Promise<void> {
  const enabled =
    selected === id || (legacyFlag === undefined ? selected === null : params.has(legacyFlag));
  if (enabled) mounts.set(id, await load());
}

// The catalog calls Canvas and uPlot only with scatter and long-series data.
await Promise.all([
  loadAdapter("ggsvelte-svg", () =>
    import("../adapters/ggsvelte-svg").then((m) => m.mountGgsvelteSvg),
  ),
  loadAdapter("ggsvelte-canvas", () =>
    import("../adapters/ggsvelte-canvas").then((m) => m.mountGgsvelteCanvas as MountAdapter),
  ),
  loadAdapter("d3", () => import("../adapters/d3").then((m) => m.mountD3)),
  loadAdapter("uplot", () => import("../adapters/uplot").then((m) => m.mountUplot as MountAdapter)),
  loadAdapter("chartjs", () => import("../adapters/chartjs").then((m) => m.mountChartJs)),
  loadAdapter("echarts", () => import("../adapters/echarts").then((m) => m.mountEcharts)),
  loadAdapter("svelteplot", () => import("../adapters/svelteplot").then((m) => m.mountSveltePlot)),
  loadAdapter("layercake", () => import("../adapters/layercake").then((m) => m.mountLayerCake)),
  loadAdapter("layercake-canvas", () =>
    import("../adapters/layercake").then((m) => m.mountLayerCakeCanvas),
  ),
  loadAdapter("unovis", () => import("../adapters/unovis").then((m) => m.mountUnovis)),
  loadAdapter("tanstack-svelte", () =>
    import("../adapters/tanstack-svelte").then((m) => m.mountTanstackSvelte),
  ),
  loadAdapter("tanstack-react", () =>
    import("../adapters/tanstack-react").then((m) => m.mountTanstackReact),
  ),
]);
await loadAdapter(
  "ggsvelte-ggplot",
  () => import("../adapters/ggsvelte-ggplot").then((m) => m.mountGgsvelteGgplot),
  "ggplot",
);
await loadAdapter(
  "ggsvelte-react",
  () => import("../adapters/ggsvelte-react").then((m) => m.mountGgsvelteReact),
  "ggreact",
);

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
  const mount = mounts.get(lib);
  if (mount !== undefined) return mount(scenario, data, root);
  if (selected !== null || lib === "ggsvelte-ggplot" || lib === "ggsvelte-react") {
    throw new Error(`${lib} is not loaded`);
  }
  throw new Error(`lib ${lib} has no browser harness (bundle-only peer — see scenarios.ts LIBS)`);
}

/** Check the fixture catalog and scope before beginning a timed mount. */
export function assertMountable(lib: string, c: ScenarioCase): void {
  const meta = LIBS.find((l) => l.id === lib);
  if (meta === undefined) throw new Error(`unknown lib ${lib}`);
  if (!meta.browser) throw new Error(`${lib} is bundle-only in this harness`);
  if (!meta.scenarios.includes(c.scenario)) {
    throw new Error(`${lib} does not support scenario ${c.scenario}`);
  }
  if (selected !== null && !mounts.has(meta.id)) throw new Error(`${lib} is not loaded`);
}

/** Legacy pages report the full browser catalog, including opt-in hosts. */
export function browserAvailable(lib: LibMeta): boolean {
  return selected === null ? lib.browser : mounts.has(lib.id);
}
