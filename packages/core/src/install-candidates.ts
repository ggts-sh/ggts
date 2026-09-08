/**
 * Explicit candidate install (#1421, made call-site-explicit in #1420):
 * wire candidate-store construction into the pipeline so
 * `RenderModel.candidates` resolves. Called by GGPlot's runtime and the test
 * preload; the lean `@ggts-sh/core/render` entry omits it and never carries
 * the candidate-store graph.
 */
import { installCandidateRuntime, getCandidateRuntime } from "./candidate-runtime.js";
import type { CandidateBuildRuntime } from "./candidate-runtime.js";
import { buildPipelineCandidates } from "./pipeline/build-candidates.js";

const REAL_RUNTIME: CandidateBuildRuntime = {
  build: (input) => buildPipelineCandidates(input),
};

/**
 * Install the real candidate-build runtime. Idempotent, and restores the real
 * runtime after a test-only clear OR replacement (a counting wrapper that
 * delegates must not survive its test's restore).
 */
export function installCandidates(): void {
  if (getCandidateRuntime() === REAL_RUNTIME) return;
  installCandidateRuntime(REAL_RUNTIME);
}
