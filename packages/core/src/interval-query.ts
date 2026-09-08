import type { RenderModel, SemanticViewport } from "./index.js";

import type { InteractionSource, IntervalSelection } from "./interaction-types.js";
import type { PlotRect } from "./semantic-viewport.js";
import {
  intervalSelectionFromRows,
  lineageRowIndexesFromCandidates,
  type IntervalDomain,
  type SelectAreaMode,
} from "./interval-selection.js";

/**
 * Narrow model-owned surface for interval query. Coordinate algebra remains
 * behind SemanticViewport; this adapter adds only lineage resolution.
 */
export type IntervalQueryScene = {
  readonly viewport: SemanticViewport;
  lineageKeys(lineageId: number): Iterable<number>;
};

/**
 * Structural port for building an IntervalQueryScene without requiring a full
 * RenderModel (tests use plain objects; production passes the live model).
 */
export type IntervalQueryModelPort = {
  readonly viewport: RenderModel["viewport"];
  readonly lineage: Pick<RenderModel["lineage"], "keys">;
};

/**
 * Map a model port into the interval query scene adapter.
 * Hosts keep the `model === null` gate; this helper assumes a live model.
 */
export function intervalQuerySceneFromModel(model: IntervalQueryModelPort): IntervalQueryScene {
  return {
    viewport: model.viewport,
    lineageKeys(lineageId) {
      return model.lineage.keys(lineageId);
    },
  };
}

export type ResolveIntervalQueryPartsInput = {
  readonly pixels: PlotRect;
  readonly mode: SelectAreaMode;
  readonly scene: IntervalQueryScene | null;
  /** Stable origin panel identity captured when the brush starts. */
  readonly panelId?: string | null;
};

/**
 * Expand the brush by select mode, collect lineage rows, invert domains when
 * a single panel is present. Empty/null scene yields empty keys and domain.
 */
export function resolveIntervalQueryParts(input: ResolveIntervalQueryPartsInput): {
  readonly rowIndexes: Set<number>;
  readonly panelId: string | null;
  readonly invertedDomain: IntervalDomain;
} {
  const scene = input.scene;
  const firstPanel = scene?.viewport.panels[0];
  if (scene === null || firstPanel === undefined) {
    return {
      rowIndexes: new Set(),
      panelId: null,
      invertedDomain: {},
    };
  }
  const requestedPanel =
    input.panelId === undefined || input.panelId === null
      ? null
      : scene.viewport.panel(input.panelId);
  const panel = requestedPanel ?? firstPanel;
  const candidates = panel.query(input.pixels, input.mode);
  const rowIndexes = lineageRowIndexesFromCandidates(candidates, (id) => scene.lineageKeys(id));
  const invertedDomain =
    scene.viewport.panels.length === 1 || requestedPanel !== null ? panel.invert(input.pixels) : {};
  return {
    rowIndexes,
    panelId: panel.id,
    invertedDomain,
  };
}

export type BuildIntervalSelectionFromSceneInput = {
  readonly phase: IntervalSelection["phase"];
  readonly mode: SelectAreaMode;
  readonly source: InteractionSource;
  readonly pixels: PlotRect;
  readonly scene: IntervalQueryScene | null;
  readonly panelId?: string | null;
  readonly keyForRow: (rowIndex: number) => PropertyKey | null;
};

/** Full interval selection event from normalized pixels + scene adapter. */
export function buildIntervalSelectionFromScene(
  input: BuildIntervalSelectionFromSceneInput,
): IntervalSelection {
  const parts = resolveIntervalQueryParts({
    pixels: input.pixels,
    mode: input.mode,
    scene: input.scene,
    ...(input.panelId !== undefined && { panelId: input.panelId }),
  });
  return intervalSelectionFromRows({
    phase: input.phase,
    mode: input.mode,
    panelId: parts.panelId,
    pixels: input.pixels,
    source: input.source,
    rowIndexes: parts.rowIndexes,
    keyForRow: input.keyForRow,
    invertedDomain: parts.invertedDomain,
  });
}
