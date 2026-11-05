import { pathSubpathIndex } from "../../candidate-geometry.js";
import type { GeometryBatch } from "../../scene.js";
import type { LayerFrame } from "../types.js";

// ---------------------------------------------------------------------------
// Candidate frame row
// ---------------------------------------------------------------------------
/**
 * Build per-group frame-row indices sorted by xNumeric (fallback: row index).
 * Path candidate resolution looks up local vertex → frame row from this index.
 */
export function buildPathGroupSortedRows(
  frame: Pick<LayerFrame, "groups" | "xNumeric">,
): Map<number, number[]> {
  const byGroup = new Map<number, number[]>();
  for (let row = 0; row < frame.groups.length; row++) {
    const group = frame.groups[row]!;
    const rows = byGroup.get(group);
    if (rows === undefined) byGroup.set(group, [row]);
    else rows.push(row);
  }
  for (const rows of byGroup.values()) {
    rows.sort((a, b) => (frame.xNumeric?.[a] ?? a) - (frame.xNumeric?.[b] ?? b));
  }
  return byGroup;
}

/** One sorted-row index per LayerFrame for the duration of candidate construction. */
const pathGroupSortedRowsCache = new WeakMap<
  Pick<LayerFrame, "groups" | "xNumeric">,
  Map<number, number[]>
>();

/** Return the cached per-group sorted rows for `frame`, building once if needed. */
export function getPathGroupSortedRows(
  frame: Pick<LayerFrame, "groups" | "xNumeric">,
): Map<number, number[]> {
  let cached = pathGroupSortedRowsCache.get(frame);
  if (cached !== undefined) return cached;
  cached = buildPathGroupSortedRows(frame);
  pathGroupSortedRowsCache.set(frame, cached);
  return cached;
}

/** Closed-band layout: cumulative vertex starts per ordered group (2× rows each). */
interface ClosedBandLayout {
  readonly starts: readonly number[];
  readonly groups: readonly number[];
  readonly rowsByGroup: ReadonlyMap<number, readonly number[]>;
  readonly total: number;
}

const closedBandLayoutCache = new WeakMap<object, ClosedBandLayout>();

function getClosedBandLayout(
  frame: Pick<LayerFrame, "groups" | "xNumeric">,
  orderedGroups: readonly number[],
): ClosedBandLayout {
  let cached = closedBandLayoutCache.get(frame);
  if (
    cached !== undefined &&
    cached.groups.length === orderedGroups.length &&
    cached.groups.every((group, index) => group === orderedGroups[index])
  ) {
    return cached;
  }
  const rowsByGroup = getPathGroupSortedRows(frame);
  const starts: number[] = [];
  let cursor = 0;
  for (const group of orderedGroups) {
    starts.push(cursor);
    cursor += (rowsByGroup.get(group)?.length ?? 0) * 2;
  }
  cached = {
    starts,
    groups: orderedGroups,
    rowsByGroup,
    total: cursor,
  };
  closedBandLayoutCache.set(frame, cached);
  return cached;
}

function resolveClosedBandFrameRow(
  layout: ClosedBandLayout,
  primitiveIndex: number,
): { frameRow: number; derivedGroup: number } | null {
  if (primitiveIndex < 0 || primitiveIndex >= layout.total || layout.starts.length === 0)
    return null;
  // Binary search last start ≤ primitiveIndex (O(log G)).
  let lo = 0;
  let hi = layout.starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (layout.starts[mid]! <= primitiveIndex) lo = mid;
    else hi = mid - 1;
  }
  const group = layout.groups[lo]!;
  const rowsInGroup = layout.rowsByGroup.get(group) ?? [];
  const local = primitiveIndex - layout.starts[lo]!;
  const reflected =
    local < rowsInGroup.length ? local : Math.max(0, rowsInGroup.length * 2 - 1 - local);
  return {
    frameRow: rowsInGroup[Math.min(reflected, rowsInGroup.length - 1)] ?? 0,
    derivedGroup: group,
  };
}

type PathBatch = Extract<GeometryBatch, { kind: "paths" }>;
type SegmentBatch = Extract<GeometryBatch, { kind: "segments" }>;

interface FrameRowResolution {
  frameRow: number;
  derivedGroup: number;
}

function defaultFrameRow(
  frame: LayerFrame | undefined,
  primitiveIndex: number,
): FrameRowResolution {
  const frameRow = Math.min(primitiveIndex, Math.max(0, (frame?.n ?? 1) - 1));
  return { frameRow, derivedGroup: frame?.groups[frameRow] ?? 0 };
}

function resolveUnprojectedPathRow(
  frame: LayerFrame,
  batch: PathBatch,
  primitiveIndex: number,
  orderedGroups: readonly number[],
  fallback: FrameRowResolution,
): FrameRowResolution {
  const subpath = pathSubpathIndex(batch.pathOffsets, primitiveIndex);
  if (subpath === null) return fallback;
  const derivedGroup = orderedGroups[Math.min(subpath, orderedGroups.length - 1)] ?? 0;
  const rowsInGroup = getPathGroupSortedRows(frame).get(derivedGroup) ?? [];
  const local = primitiveIndex - (batch.pathOffsets[subpath] ?? 0);
  const reflected =
    local < rowsInGroup.length ? local : Math.max(0, rowsInGroup.length * 2 - 1 - local);
  return {
    frameRow: rowsInGroup[Math.min(reflected, rowsInGroup.length - 1)] ?? fallback.frameRow,
    derivedGroup,
  };
}

function resolveProjectedClosedPathRow(
  frame: LayerFrame,
  primitiveIndex: number,
  orderedGroups: readonly number[],
  fallback: FrameRowResolution,
): FrameRowResolution {
  const resolved = resolveClosedBandFrameRow(
    getClosedBandLayout(frame, orderedGroups),
    primitiveIndex,
  );
  if (resolved !== null) return resolved;
  const frameRow = Math.min(Math.max(0, primitiveIndex), Math.max(0, frame.n - 1));
  return {
    frameRow,
    derivedGroup: frame.groups[frameRow] ?? fallback.derivedGroup,
  };
}

function resolvePathFrameRow(
  frame: LayerFrame,
  batch: PathBatch,
  primitiveIndex: number,
  orderedGroups: readonly number[],
  fallback: FrameRowResolution,
): FrameRowResolution {
  const explicitFrameRow = batch.frameRowIndex?.[primitiveIndex];
  if (explicitFrameRow !== undefined && explicitFrameRow < frame.n) {
    return {
      frameRow: explicitFrameRow,
      derivedGroup: frame.groups[explicitFrameRow] ?? fallback.derivedGroup,
    };
  }
  const emittedClosedRow =
    batch.closed === true ? batch.closedFrameRows?.[primitiveIndex] : undefined;
  if (emittedClosedRow !== undefined) {
    return {
      frameRow: emittedClosedRow,
      derivedGroup: frame.groups[emittedClosedRow] ?? fallback.derivedGroup,
    };
  }
  if (batch.semanticIndex === undefined) {
    return resolveUnprojectedPathRow(frame, batch, primitiveIndex, orderedGroups, fallback);
  }
  if (batch.closed === true) {
    return resolveProjectedClosedPathRow(frame, primitiveIndex, orderedGroups, fallback);
  }
  const frameRow = Math.min(Math.max(0, primitiveIndex), Math.max(0, frame.n - 1));
  return {
    frameRow,
    derivedGroup: frame.groups[frameRow] ?? fallback.derivedGroup,
  };
}

function resolveSegmentFrameRow(
  frame: LayerFrame,
  batch: SegmentBatch,
  primitiveIndex: number,
  fallback: FrameRowResolution,
): FrameRowResolution {
  let frameRow = fallback.frameRow;
  if (frame.binding.layer.geom === "errorbar") frameRow = Math.floor(primitiveIndex / 3);
  else if (frame.binding.layer.geom === "boxplot" && batch.rowIndex.length >= frame.n * 2)
    frameRow = Math.floor(primitiveIndex / 2);
  return {
    frameRow,
    derivedGroup:
      frame.groups[Math.min(frameRow, frame.groups.length - 1)] ?? fallback.derivedGroup,
  };
}

function resolveBoxplotOutlierRow(
  frame: LayerFrame,
  primitiveIndex: number,
  fallback: FrameRowResolution,
): FrameRowResolution {
  const frameRow = frame.box?.outlierBox[primitiveIndex] ?? fallback.frameRow;
  return {
    frameRow,
    derivedGroup: frame.groups[frameRow] ?? fallback.derivedGroup,
  };
}

export function resolveCandidateFrameRow(input: {
  frame: LayerFrame | undefined;
  batch: GeometryBatch;
  primitiveIndex: number;
  orderedGroups: readonly number[];
  outlierLocalRow: number | null;
}): { frameRow: number; derivedGroup: number } {
  const { frame, batch, primitiveIndex, orderedGroups } = input;
  const fallback = defaultFrameRow(frame, primitiveIndex);
  if (frame === undefined) return fallback;
  if (batch.kind === "rects" || batch.kind === "points" || batch.kind === "segments") {
    // The emitter dropped marks, so the primitive index is not a frame row.
    const kept = batch.frameRowIndex?.[primitiveIndex];
    if (kept !== undefined) {
      return { frameRow: kept, derivedGroup: frame.groups[kept] ?? fallback.derivedGroup };
    }
  }
  if (batch.kind === "paths")
    return resolvePathFrameRow(frame, batch, primitiveIndex, orderedGroups, fallback);
  if (batch.kind === "segments")
    return resolveSegmentFrameRow(frame, batch, primitiveIndex, fallback);
  if (frame.box !== null && frame.binding.layer.geom === "boxplot" && batch.kind === "points")
    return resolveBoxplotOutlierRow(frame, primitiveIndex, fallback);
  return fallback;
}
