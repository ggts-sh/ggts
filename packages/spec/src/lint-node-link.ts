import { LINT_CATALOG } from "./lint-catalog.js";
import type { SpecAdvisory } from "./lint.js";
import type { Aes, CellValue, ChannelName } from "./schema.js";
import { effectiveChannel, type FieldEvidenceMap } from "./validate-data.js";
import { isRecord } from "./validate-structure-layer-shared.js";

interface FacetField {
  field: string;
  levels?: Set<string>;
}

interface PanelRows {
  values: string[];
  rows: number[];
}

interface Coordinates {
  index: number;
  x: readonly CellValue[];
  y: readonly CellValue[];
  xend?: readonly CellValue[];
  yend?: readonly CellValue[];
  fields: string[];
  panels: PanelRows[];
}

function coordinateKey(x: CellValue | undefined, y: CellValue | undefined): string | null {
  return typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y)
    ? `${x},${y}`
    : null;
}

/** JSON distinguishes valid facet cell types, except signed zero. */
function facetKey(value: unknown): string {
  return Object.is(value, -0) ? "-0" : (JSON.stringify(value) ?? "undefined");
}

function facetFields(spec: Record<string, unknown>): FacetField[] {
  const facet = spec["facet"];
  if (!isRecord(facet)) return [];
  const fields: FacetField[] = [];
  for (const axis of ["wrap", "rows", "cols"]) {
    const ref = facet[axis];
    if (!isRecord(ref) || typeof ref["field"] !== "string") continue;
    fields.push({
      field: ref["field"],
      ...(Array.isArray(ref["levels"]) && {
        levels: new Set(ref["levels"].map(facetKey)),
      }),
    });
  }
  return fields;
}

/** Missing facet columns broadcast; present columns partition before matching. */
function partition(fields: FieldEvidenceMap, facets: FacetField[], count: number) {
  const present = facets.filter((f) => fields.has(f.field));
  const columns = present.map((f) => fields.get(f.field)!.values);
  const panels = new Map<string, PanelRows>();
  for (let row = 0; row < count; row++) {
    const values = columns.map((column) => facetKey(column?.[row] ?? null));
    if (present.some((f, index) => f.levels !== undefined && !f.levels.has(values[index]!)))
      continue;
    const key = JSON.stringify(values);
    let panel = panels.get(key);
    if (panel === undefined) {
      panel = { values, rows: [] };
      panels.set(key, panel);
    }
    panel.rows.push(row);
  }
  return { fields: present.map((f) => f.field), panels: [...panels.values()] };
}

function hasNetwork(segment: Coordinates, rows: number[], nodes: Set<string>): boolean {
  let endpoints = 0;
  let matched = 0;
  let hub = false;
  const degree = new Map<string, number>();
  const countEndpoint = (key: string, diagonal: boolean) => {
    if (!nodes.has(key)) return;
    matched++;
    if (!diagonal) return;
    const count = (degree.get(key) ?? 0) + 1;
    degree.set(key, count);
    if (count >= 3) hub = true;
  };
  for (const row of rows) {
    const start = coordinateKey(segment.x[row], segment.y[row]);
    const end = coordinateKey(segment.xend?.[row], segment.yend?.[row]);
    if (start === null || end === null) continue;
    endpoints += 2;
    const diagonal =
      segment.x[row] !== segment.xend?.[row] && segment.y[row] !== segment.yend?.[row];
    countEndpoint(start, diagonal);
    countEndpoint(end, diagonal);
  }
  return endpoints > 0 && matched / endpoints >= 0.8 && hub;
}

function matchesPanels(
  segment: Coordinates,
  point: Coordinates,
  nodePanels: Map<PanelRows, Set<string>>,
): boolean {
  const shared = segment.fields.filter((field) => point.fields.includes(field));
  const segmentIndices = shared.map((field) => segment.fields.indexOf(field));
  const pointIndices = shared.map((field) => point.fields.indexOf(field));
  const byShared = new Map<string, Set<string>[]>();
  for (const panel of point.panels) {
    const sharedKey = JSON.stringify(pointIndices.map((index) => panel.values[index]));
    let groups = byShared.get(sharedKey);
    if (groups === undefined) {
      groups = [];
      byShared.set(sharedKey, groups);
    }
    groups.push(nodePanels.get(panel)!);
  }
  for (const panel of segment.panels) {
    const candidates = byShared.get(
      JSON.stringify(segmentIndices.map((index) => panel.values[index])),
    );
    if (candidates?.some((nodes) => hasNetwork(segment, panel.rows, nodes))) return true;
  }
  return false;
}

function continuousAxis(
  axis: "x" | "y",
  scale: unknown,
  layers: unknown[],
  plotAes: Aes | undefined,
  evidence: readonly (FieldEvidenceMap | null)[],
): boolean {
  if (isRecord(scale) && scale["type"] !== undefined) {
    return ["linear", "log", "time", "binned"].includes(String(scale["type"]));
  }
  for (let index = 0; index < layers.length; index++) {
    const layer = layers[index];
    if (!isRecord(layer)) continue;
    const aes = isRecord(layer["aes"]) ? (layer["aes"] as Aes) : undefined;
    const mapped = effectiveChannel(plotAes, aes, axis);
    if (mapped === undefined) continue;
    if (
      axis === "x" &&
      (layer["geom"] === "bar" || layer["geom"] === "col") &&
      layer["stat"] !== "bin"
    )
      return false;
    if ("field" in mapped && evidence[index]?.get(mapped.field)?.type !== "quantitative")
      return false;
  }
  return true;
}

function layerCoordinates(
  layer: Record<string, unknown>,
  index: number,
  fields: FieldEvidenceMap,
  plotAes: Aes | undefined,
  facets: FacetField[],
): Coordinates | null {
  if (
    (layer["stat"] !== undefined && layer["stat"] !== "identity") ||
    (layer["position"] !== undefined && layer["position"] !== "identity")
  )
    return null;
  const aes = isRecord(layer["aes"]) ? (layer["aes"] as Aes) : undefined;
  const column = (channel: ChannelName) => {
    const mapped = effectiveChannel(plotAes, aes, channel);
    const info = mapped !== undefined && "field" in mapped ? fields.get(mapped.field) : undefined;
    return info?.type === "quantitative" ? info.values : null;
  };
  const x = column("x");
  const y = column("y");
  if (x === null || y === null) return null;
  if (layer["geom"] === "point") return { index, x, y, ...partition(fields, facets, x.length) };
  const xend = column("xend");
  const yend = column("yend");
  if (xend === null || yend === null) return null;
  return { index, x, y, xend, yend, ...partition(fields, facets, x.length) };
}

function indexNodes(points: Coordinates[]): Map<PanelRows, Set<string>> {
  const nodePanels = new Map<PanelRows, Set<string>>();
  for (const point of points) {
    for (const panel of point.panels) {
      const nodes = new Set<string>();
      for (const row of panel.rows) {
        const key = coordinateKey(point.x[row], point.y[row]);
        if (key !== null) nodes.add(key);
      }
      nodePanels.set(panel, nodes);
    }
  }
  return nodePanels;
}

/** Match raw coordinates only for identity layers on continuous axes. */
export function collectNodeLinkAdvisories(
  spec: Record<string, unknown>,
  evidence: readonly (FieldEvidenceMap | null)[] | undefined,
): SpecAdvisory[] {
  if (evidence === undefined) return [];
  const layers = spec["layers"] as unknown[];
  if (
    !layers.some((layer) => isRecord(layer) && layer["geom"] === "segment") ||
    !layers.some((layer) => isRecord(layer) && layer["geom"] === "point")
  )
    return [];
  const plotAes = isRecord(spec["aes"]) ? (spec["aes"] as Aes) : undefined;
  const scales = isRecord(spec["scales"]) ? spec["scales"] : undefined;
  if (
    !continuousAxis("x", scales?.["x"], layers, plotAes, evidence) ||
    !continuousAxis("y", scales?.["y"], layers, plotAes, evidence)
  )
    return [];
  const facets = facetFields(spec);
  const points: Coordinates[] = [];
  const segments: Coordinates[] = [];
  for (let index = 0; index < layers.length; index++) {
    const layer = layers[index];
    if (!isRecord(layer) || (layer["geom"] !== "point" && layer["geom"] !== "segment")) continue;
    const fields = evidence[index];
    if (fields === null || fields === undefined) continue;
    const coordinates = layerCoordinates(layer, index, fields, plotAes, facets);
    if (coordinates === null) continue;
    (layer["geom"] === "point" ? points : segments).push(coordinates);
  }
  const nodePanels = indexNodes(points);
  const advisories: SpecAdvisory[] = [];
  for (const segment of segments) {
    if (points.some((point) => matchesPanels(segment, point, nodePanels))) {
      advisories.push({
        code: "node-link-layout",
        path: `/layers/${segment.index}`,
        message: LINT_CATALOG["node-link-layout"].rationale,
      });
    }
  }
  return advisories;
}
