import { pathSubpathIndex, renderPrimitiveCount } from "./candidate-geometry.js";
import type { GeometryBatch } from "./scene.js";

/** Semantic source-row keys associated with one renderer candidate. */
export interface SemanticCandidateKeys<Key extends PropertyKey = PropertyKey> {
  readonly batchIndex: number;
  /** A mark index, or a vertex index for path batches. */
  readonly primitiveIndex: number;
  readonly keys: readonly Key[];
}

/** Read-only focus projection for the renderer-level primitives in one batch. */
export interface BatchInteractionMask {
  readonly primitiveCount: number;
  readonly focusedCount: number;
  isFocused(primitiveIndex: number): boolean;
}

function pathForVertex(offsets: Uint32Array, vertexIndex: number): number | null {
  if (
    !Number.isInteger(vertexIndex) ||
    vertexIndex < 0 ||
    offsets.length < 2 ||
    vertexIndex >= offsets.at(-1)!
  )
    return null;
  return pathSubpathIndex(offsets, vertexIndex);
}

function rendererPrimitive(batch: GeometryBatch, candidateIndex: number): number | null {
  if (batch.kind === "paths") return pathForVertex(batch.pathOffsets, candidateIndex);
  const count = renderPrimitiveCount(batch);
  return Number.isInteger(candidateIndex) && candidateIndex >= 0 && candidateIndex < count
    ? candidateIndex
    : null;
}

function freezeMasks(
  batches: readonly GeometryBatch[],
  focused: Map<number, Uint8Array>,
): ReadonlyArray<BatchInteractionMask | null> {
  const masks = batches.map<BatchInteractionMask | null>((_, batchIndex) => {
    const values = focused.get(batchIndex);
    if (values === undefined) return null;
    let focusedCount = 0;
    for (const value of values) focusedCount += value;
    return Object.freeze({
      primitiveCount: values.length,
      focusedCount,
      isFocused(primitiveIndex: number): boolean {
        return values[primitiveIndex] === 1;
      },
    });
  });
  return Object.freeze(masks);
}

/**
 * Mark a **renderer** primitive index as focused (not a candidate vertex index).
 * Path callers must pass a subpath index; do not run path-vertex remapping here.
 */
function markFocusedPrimitive(
  focused: Map<number, Uint8Array>,
  batches: readonly GeometryBatch[],
  batchIndex: number,
  primitiveIndex: number,
): void {
  const batch = batches[batchIndex];
  if (batch === undefined) return;
  const count = renderPrimitiveCount(batch);
  if (!Number.isInteger(primitiveIndex) || primitiveIndex < 0 || primitiveIndex >= count) return;
  let values = focused.get(batchIndex);
  if (values === undefined) {
    values = new Uint8Array(count);
    focused.set(batchIndex, values);
  }
  values[primitiveIndex] = 1;
}

/** Renderer primitive address for direct (keyless) inspection focus. */
export interface FocusedPrimitive {
  readonly batchIndex: number;
  readonly primitiveIndex: number;
}

/**
 * Project semantic emphasis keys onto renderer primitives without exposing a
 * mutable backing array. Batches without semantic candidates remain `null`,
 * so pure annotation-only geometry is not inadvertently de-emphasized —
 * except presentation-only path batches (`candidates: false`) that share a
 * layer with a focused batch (ribbon outlines), which mirror that layer's mask
 * so unselected outlines mute with their fill.
 */
export function buildInteractionMasks<Key extends PropertyKey>(
  batches: readonly GeometryBatch[],
  emphasisKeys: Iterable<Key>,
  candidates: Iterable<SemanticCandidateKeys<Key>>,
  primitives?: Iterable<FocusedPrimitive>,
): ReadonlyArray<BatchInteractionMask | null> {
  const emphasis = new Set(emphasisKeys);
  if (emphasis.size === 0) {
    return primitives === undefined
      ? Object.freeze(Array.from<null>({ length: batches.length }).fill(null))
      : buildPrimitiveInteractionMasks(batches, primitives);
  }

  const focused = new Map<number, Uint8Array>();
  for (const candidate of candidates) {
    markFocusedCandidate(focused, batches, candidate, emphasis);
  }

  // Mirror fill-batch focus onto presentation-only path batches on the same
  // layer (ribbon outline open paths). Null masks stay fully opaque in canvas.
  // The mask source is the lowest-indexed same-layer batch holding a mask at
  // that point in the loop — masks mirrored onto earlier outlines included —
  // so the per-layer index below must track masks this loop adds, not just
  // the candidate-derived ones.
  let peerByLayer: Map<number, { batchIndex: number; values: Uint8Array; count: number }> | null =
    null;
  for (let index = 0; index < batches.length; index++) {
    const batch = batches[index];
    if (batch === undefined || batch.kind !== "paths" || batch.candidates !== false) continue;
    if (focused.has(index)) continue;
    if (peerByLayer === null) {
      peerByLayer = new Map();
      for (let other = 0; other < batches.length; other++) {
        const candidate = batches[other];
        if (candidate === undefined || peerByLayer.has(candidate.layerIndex)) continue;
        const values = focused.get(other);
        if (values === undefined) continue;
        peerByLayer.set(candidate.layerIndex, {
          batchIndex: other,
          values,
          count: renderPrimitiveCount(candidate),
        });
      }
    }
    const peer = peerByLayer?.get(batch.layerIndex);
    mirrorPeerMask(focused, peerByLayer, batch, index, peer);
  }

  // Direct focus belongs to its target batch, after semantic outline mirroring.
  if (primitives !== undefined) {
    for (const primitive of primitives) {
      markFocusedPrimitive(focused, batches, primitive.batchIndex, primitive.primitiveIndex);
    }
  }

  return freezeMasks(batches, focused);
}

function markFocusedCandidate<Key extends PropertyKey>(
  focused: Map<number, Uint8Array>,
  batches: readonly GeometryBatch[],
  candidate: SemanticCandidateKeys<Key>,
  emphasis: ReadonlySet<Key>,
): void {
  if (candidate.keys.length === 0) return;
  const batch = batches[candidate.batchIndex];
  if (batch === undefined) return;
  const primitiveIndex = rendererPrimitive(batch, candidate.primitiveIndex);
  if (primitiveIndex === null) return;
  let values = focused.get(candidate.batchIndex);
  if (values === undefined) {
    values = new Uint8Array(renderPrimitiveCount(batch));
    focused.set(candidate.batchIndex, values);
  }
  if (candidate.keys.some((key) => emphasis.has(key))) values[primitiveIndex] = 1;
}

function mirrorPeerMask(
  focused: Map<number, Uint8Array>,
  peerByLayer: Map<number, { batchIndex: number; values: Uint8Array; count: number }> | null,
  batch: GeometryBatch,
  index: number,
  peer: { batchIndex: number; values: Uint8Array; count: number } | undefined,
): void {
  if (peer === undefined || peerByLayer === null) return;
  const source = peer.values;
  const sourceCount = peer.count;
  const outlineCount = renderPrimitiveCount(batch);
  const mirrored = new Uint8Array(outlineCount);
  if (outlineCount === sourceCount) mirrored.set(source);
  else if (sourceCount > 0 && outlineCount === sourceCount * 2) {
    for (let path = 0; path < sourceCount; path++) {
      const bit = source[path]!;
      mirrored[path * 2] = bit;
      mirrored[path * 2 + 1] = bit;
    }
  }
  focused.set(index, mirrored);
  if (index < peer.batchIndex)
    peerByLayer.set(batch.layerIndex, { batchIndex: index, values: mirrored, count: outlineCount });
}

/**
 * Build focus masks from explicit renderer primitives (no semantic keys).
 * Used for rect inspection de-emphasis when the chart has no datum keys (#386).
 */
export function buildPrimitiveInteractionMasks(
  batches: readonly GeometryBatch[],
  primitives: Iterable<FocusedPrimitive>,
): ReadonlyArray<BatchInteractionMask | null> {
  const focused = new Map<number, Uint8Array>();
  let any = false;
  for (const primitive of primitives) {
    any = true;
    markFocusedPrimitive(focused, batches, primitive.batchIndex, primitive.primitiveIndex);
  }
  if (!any) return Object.freeze(Array.from<null>({ length: batches.length }).fill(null));
  return freezeMasks(batches, focused);
}
