/**
 * Lazy interaction candidates (#1421).
 *
 * The lean render entry (`@ggts-sh/core/render`) must not carry the
 * candidate-store graph, and even the full entry must not BUILD the store
 * until something actually touches `model.candidates` / `model.lineage`
 * (headless SSR renders never hit-test).
 *
 * Candidate construction therefore runs through a runtime hook
 * (`candidate-runtime.ts`, mirroring `temporal-runtime.ts`): GGPlot's runtime
 * and the test preload install it via `install-candidates.ts` (explicit since
 * #1420); the lean entry leaves it unset and candidate access throws a plain
 * Error naming the full entry. `model.lineage` is populated by the store's
 * assembly, exactly as before #1421.
 */
import { afterAll, describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";

import {
  getCandidateRuntime,
  installCandidateRuntime,
  resetCandidateRuntimeForTests,
} from "../../src/candidate-runtime.js";
import { installCandidates } from "../../src/install-candidates.js";
import { runPipeline } from "../../src/pipeline/run-pipeline.js";
import { renderToSVGString } from "../../src/render-svg-full.js";

const spec = gg({ x: [1, 2, 3, 4], y: [4, 3, 5, 2] }, aes({ x: "x", y: "y" }))
  .geomPoint()
  .spec();

const size = { width: 400, height: 300 };

/** Swap in a build-counting wrapper around the installed runtime. */
function countBuilds(): { builds: () => number } {
  const real = getCandidateRuntime();
  if (real === null) throw new Error("expected the full candidate runtime (test preload)");
  let builds = 0;
  installCandidateRuntime({
    build: (input) => {
      builds += 1;
      return real.build(input);
    },
  });
  return { builds: () => builds };
}

afterAll(() => {
  installCandidates();
});

describe("lazy interaction candidates", () => {
  it("builds zero stores during runPipeline; first .candidates access builds exactly one", () => {
    const counter = countBuilds();
    try {
      const model = runPipeline(spec, size);
      // The SSR/headless win: a pipeline run that never interacts builds nothing.
      expect(counter.builds()).toBe(0);

      const first = model.candidates;
      expect(counter.builds()).toBe(1);
      expect(first.size).toBeGreaterThan(0);

      // Memoized: repeat access returns the same store without rebuilding.
      expect(model.candidates).toBe(first);
      expect(counter.builds()).toBe(1);
    } finally {
      installCandidates();
    }
  });

  it(".lineage alone builds nothing; candidate assembly populates it (pre-change semantics)", () => {
    const counter = countBuilds();
    try {
      const model = runPipeline(spec, size);
      // A lineage-only reader pays nothing — same as the pre-#1421 eager
      // build, which also assembled (and populated lineage) lazily.
      const lineage = model.lineage;
      expect(counter.builds()).toBe(0);

      const candidate = model.candidates.candidate(0);
      expect(candidate).not.toBeNull();
      expect(lineage.keys(candidate!.lineage).length).toBeGreaterThan(0);
    } finally {
      installCandidates();
    }
  });

  it("lean render path: no runtime → renderToSVGString works, candidate access throws", () => {
    resetCandidateRuntimeForTests();
    try {
      const svg = renderToSVGString(spec, size);
      expect(svg).toContain("<svg");

      const model = runPipeline(spec, size);
      expect(() => model.candidates).toThrowError(/@ggts-sh\/core/);
    } finally {
      installCandidates();
    }
  });

  it("dispose releases the retained build inputs; late interaction is quiet-null", () => {
    const counter = countBuilds();
    try {
      const model = runPipeline(spec, size);
      expect(counter.builds()).toBe(0);
      model.dispose();
      // Never built: dispose dropped the retained inputs, and a late hit-test
      // gets the inert released store (pre-#1421 quiet-null contract), not a
      // crash and not a resurrected build.
      expect(counter.builds()).toBe(0);
      const store = model.candidates;
      expect(counter.builds()).toBe(0);
      expect(store.size).toBe(0);
      expect(store.nearest(10, 10, { mode: "exact", maxDistance: 20 })).toBeNull();
      expect(store.candidate(0)).toBeNull();
      expect(model.candidates).toBe(store);
    } finally {
      installCandidates();
    }
  });

  it("dispose after a build still returns the built store (pre-change semantics)", () => {
    const counter = countBuilds();
    try {
      const model = runPipeline(spec, size);
      const store = model.candidates;
      expect(counter.builds()).toBe(1);
      model.dispose();
      expect(model.candidates).toBe(store);
    } finally {
      installCandidates();
    }
  });

  it("installCandidates() restores the real runtime after a test-only swap", () => {
    const real = getCandidateRuntime();
    installCandidateRuntime({ build: (input) => real!.build(input) });
    installCandidates();
    expect(getCandidateRuntime()).toBe(real);
  });
});
