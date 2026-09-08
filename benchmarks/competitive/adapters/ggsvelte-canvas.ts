/**
 * Canvas-mark ggsvelte mounts (pipeline + planStrata + drawStratum).
 * All imports stay on the lean graph (@ggts-sh/core/render + /dom) so canvas
 * charts never install the Temporal polyfill.
 *
 * Spec uses a named data ref (`{ name: "main" }`) so mount/update feed columns
 * via RunOptions.data without snapshotting 30k cells through toPortable each
 * draw (same data path product code uses for live updates).
 */
import { cssColorResolver, drawStratum, sizeCanvasForDpr } from "@ggts-sh/core/dom";
import { planStrata, runPipeline } from "@ggts-sh/core/headless";
import type { SpecInput } from "@ggts-sh/spec/portable";

import {
  PLOT_HEIGHT,
  PLOT_WIDTH,
  type ScatterColumns,
  type ScenarioId,
  type SeriesColumns,
} from "../scenarios";

export type UpdateColumns = ScatterColumns | SeriesColumns;

export type MountHandle = {
  destroy: () => void;
  update: (data: UpdateColumns) => void;
};

export type MountResult = { markHint: number; handle: MountHandle };

const DATA_NAME = "main";

/** Named-data portable specs — built once per scenario, data swapped at run.
 * theme_void + color/fill guide none: no legend layout (peer canvas fixtures
 * draw marks only). Keep axis guides on so the panel size stays near the
 * LayerCake padding box — disabling axes expands the canvas and slowed paint.
 * Guide form must be `{ type: "none" }` (string `"none"` is not normalized). */
function scatterPortable(): SpecInput {
  return {
    data: { name: DATA_NAME },
    aes: { x: "x", y: "y", color: "cls" },
    layers: [{ geom: "point", render: "canvas", params: { size: 1.5, alpha: 0.7 } }],
    theme: "void",
    guides: { color: { type: "none" } },
  };
}

function linePortable(): SpecInput {
  return {
    data: { name: DATA_NAME },
    aes: { x: "x", y: "y", color: "series", group: "series" },
    layers: [{ geom: "line", render: "canvas" }],
    theme: "void",
    guides: { color: { type: "none" } },
  };
}

function areaPortable(): SpecInput {
  // Identity (not stack): competitors overlay series; default geomArea is stack.
  return {
    data: { name: DATA_NAME },
    aes: { x: "x", y: "y", fill: "series", group: "series" },
    layers: [{ geom: "area", position: "identity", render: "canvas" }],
    theme: "void",
    guides: { fill: { type: "none" } },
  };
}

function portableFor(scenario: ScenarioId) {
  switch (scenario) {
    case "scatter-color":
      return scatterPortable();
    case "line-multiseries":
      return linePortable();
    case "area-multiseries":
      return areaPortable();
    default:
      throw new Error(`unsupported canvas scenario ${scenario}`);
  }
}

export function mountGgsvelteCanvas(
  scenario: ScenarioId,
  data: ScatterColumns | SeriesColumns,
  root: HTMLElement,
): MountResult {
  if (scenario === "bars-stacked") {
    throw new Error("ggsvelte-canvas competitive path skips bars-stacked");
  }
  // Build the portable once: only columns change on update.
  const portable = portableFor(scenario);
  root.replaceChildren();
  // Axes/text stay un-drawn in this harness (canvas marks only) so paint cost
  // isolates mark drawing — documented in README fairness notes. theme_void
  // matches that posture (no axis chrome reserve).
  const canvas = document.createElement("canvas");
  canvas.style.width = `${PLOT_WIDTH}px`;
  canvas.style.height = `${PLOT_HEIGHT}px`;
  root.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (ctx === null) throw new Error("2d context unavailable");
  const dpr = window.devicePixelRatio || 1;
  const resolve = cssColorResolver(canvas);
  let sized = false;
  const draw = (d: UpdateColumns): number => {
    const model = runPipeline(portable, {
      width: PLOT_WIDTH,
      height: PLOT_HEIGHT,
      data: { [DATA_NAME]: d },
    });
    const strata = planStrata(model.scene, model.layerBackends);
    if (!sized) {
      sizeCanvasForDpr(canvas, ctx, model.scene.width, model.scene.height, dpr);
      sized = true;
    }
    // No adapter-side clearRect: drawStratum clears the CSS-px viewport per
    // its documented contract, so a redraw never accumulates.
    let batches = 0;
    for (const stratum of strata) {
      if (stratum.backend !== "canvas") continue;
      drawStratum(ctx, model.scene, stratum.batches, resolve);
      batches += stratum.batches.length;
    }
    return batches;
  };
  const markHint = draw(data);
  return {
    markHint,
    handle: {
      // Full pipeline re-run on the SAME canvas element — ggsvelte's lean
      // canvas path has no incremental redraw, so update == remount-minus-DOM.
      update: (d) => {
        draw(d);
      },
      destroy: () => {
        root.replaceChildren();
      },
    },
  };
}

export function bundleScatterCanvas(data: ScatterColumns): unknown {
  return runPipeline(scatterPortable(), {
    width: PLOT_WIDTH,
    height: PLOT_HEIGHT,
    data: { [DATA_NAME]: data },
  });
}

export function bundleLineCanvas(data: SeriesColumns): unknown {
  return runPipeline(linePortable(), {
    width: PLOT_WIDTH,
    height: PLOT_HEIGHT,
    data: { [DATA_NAME]: data },
  });
}

export function bundleAreaCanvas(data: SeriesColumns): unknown {
  return runPipeline(areaPortable(), {
    width: PLOT_WIDTH,
    height: PLOT_HEIGHT,
    data: { [DATA_NAME]: data },
  });
}
