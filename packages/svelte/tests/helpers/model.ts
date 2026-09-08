/**
 * Canonical test viewport for controller-extraction suites: one shared
 * pipeline fixture so cross-suite domain/pixel assertions stay comparable.
 */
import { installCandidates, registerAll, runPipeline, type RenderModel } from "@ggts-sh/core";
import type { PortableSpec } from "@ggts-sh/spec";

// Spec-driven test helper: no <Geom*> components in this path to
// self-register specialty geoms/stats (#1420), so opt into the full grammar.
// Candidates install explicitly too (#1421): consumers may hit-test.
registerAll();
installCandidates();

export function modelFor(spec: PortableSpec): RenderModel {
  return runPipeline(spec, { width: 360, height: 260 });
}
