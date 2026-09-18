import type { CanonicalAxisToken } from "./candidate-axis-token.js";
import type { CandidateFacts, CandidateStore } from "./candidate-store-types.js";
import type { Scene } from "./scene.js";
import type { CellValue } from "./table.js";

/** Compact typed-array indexes + traversal/group tables for an assembled candidate store. */
export type CandidateStoreIndexes = {
  readonly scene: Scene;
  readonly epoch: number;
  readonly flip: boolean;
  readonly hitTolerance: number;
  readonly n: number;
  readonly batchIds: Uint32Array;
  readonly primitiveIds: Uint32Array;
  readonly panelIds: Uint32Array;
  readonly rows: Uint32Array;
  readonly series: Uint32Array;
  readonly ranks: Uint32Array;
  readonly sources: Uint32Array;
  readonly lineages: Uint32Array;
  readonly autoModes: Uint8Array;
  readonly xs: Float32Array;
  readonly ys: Float32Array;
  readonly xTokenIds: Int32Array;
  readonly yTokenIds: Int32Array;
  readonly xDates: Uint8Array;
  readonly yDates: Uint8Array;
  readonly tokens: CanonicalAxisToken[];
  readonly invalidX: Map<number, CellValue>;
  readonly invalidY: Map<number, CellValue>;
  readonly traversal: Uint32Array;
  readonly traversalRank: Uint32Array;
  readonly orderByX: Uint32Array;
  readonly coincidentStack: (Uint32Array | undefined)[];
  readonly coincidentAt: Uint32Array;
  /** Resolve groups through tables built on first group query, never first hover. */
  group: CandidateStore["group"];
  fact(id: number): CandidateFacts | null;
};
