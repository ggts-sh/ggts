/**
 * Optional candidate-build runtime hook.
 *
 * The lean `@ggts-sh/core/render` entry leaves this unset so headless/SSR
 * bundles never carry the candidate-store graph (build-candidates →
 * candidate-store → hit geometry/spatial indexes). The full package barrel
 * installs it via `install-candidates.ts` (mirrors `temporal-runtime.ts` +
 * `install-temporal.ts`).
 *
 * `RenderModel.candidates` / `RenderModel.lineage` build lazily through this
 * hook on first access; a pipeline run that only renders never pays the
 * candidate-build cost.
 */
import type { CandidateStore } from "./candidate-store.js";
import type { LineageStore } from "./identity.js";
import type { buildPipelineCandidates } from "./pipeline/build-candidates.js";

/** Inputs finalize retains for the lazy candidate build (type-only import —
 * this module stays in the lean render graph, build-candidates does not). */
export type CandidateBuildInput = Parameters<typeof buildPipelineCandidates>[0];

export interface CandidateBuildRuntime {
  readonly build: (input: CandidateBuildInput) => CandidateStore;
}

/**
 * Finalize's lazy interaction bundle: the lineage store is created eagerly
 * (cheap, empty) and populated by the store's assembly once `ensure()` has
 * produced it — `ensure()` is the only guarded accessor.
 */
export interface LazyInteraction {
  readonly lineageStore: LineageStore<number>;
  /** Build (once) and return the candidate store; its assembly populates
   *  `lineageStore`. */
  readonly ensure: () => CandidateStore;
  /** The built store, or null when interaction was never accessed. */
  readonly built: () => CandidateStore | null;
  /** Drop the retained build inputs (model dispose) so a released model does
   *  not keep the source table / prepared panels alive through the thunk. */
  readonly release: () => void;
}

let runtime: CandidateBuildRuntime | null = null;

/** Install candidate construction (full entry). Idempotent; may replace. */
export function installCandidateRuntime(next: CandidateBuildRuntime): void {
  runtime = next;
}

export function getCandidateRuntime(): CandidateBuildRuntime | null {
  return runtime;
}

const EMPTY_F32 = new Float32Array(0);
const EMPTY_U32 = new Uint32Array(0);

/**
 * Inert store returned when interaction is first accessed after the model's
 * dispose released the build inputs. Preserves the pre-#1421 contract for
 * late hit-tests on a released chart (quiet nulls, never a crash) without
 * keeping the source table alive. Interface drift breaks tsc, not callers.
 */
export const RELEASED_CANDIDATE_STORE: CandidateStore = {
  epoch: -1,
  size: 0,
  x: EMPTY_F32,
  y: EMPTY_F32,
  candidate: () => null,
  hitTest: () => null,
  nearest: () => null,
  group: () => null,
  traverse: () => null,
  cycle: () => null,
  queryRect: () => EMPTY_U32,
  dispose: () => {},
};

/**
 * Test-only: clear the runtime so the lean render path is exercised.
 * Restore with `installCandidates()` (bunfig preload shares module state
 * across test files).
 */
export function resetCandidateRuntimeForTests(): void {
  runtime = null;
}
