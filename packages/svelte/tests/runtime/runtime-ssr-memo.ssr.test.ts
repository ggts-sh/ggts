/**
 * #1328: SSR runtime must not re-run the pipeline on every getter read.
 *
 * Seam: createPlotRuntime getters (model / strata / hasCanvas) on the server
 * path (`typeof window === "undefined"`). Client $derived caching is unchanged.
 *
 * Evidence of a pipeline run is a deps.effectiveSpec() read inside resolveModel
 * (that function always reads effectiveSpec before calling runPipeline).
 *
 * Call createPlotRuntime directly: $effect.root does not run its setup body
 * during Svelte SSR, and the factory's $effect registrations are no-ops on
 * the server path anyway.
 */
import { aes, gg, type PortableSpec } from "@ggts-sh/spec";
import { describe, expect, it } from "vitest";

import { createPlotRuntime } from "../../src/lib/runtime/runtime.svelte.js";

const minimalSpec: PortableSpec = gg(
  [
    { x: 1, y: 10, cls: "a" },
    { x: 2, y: 20, cls: "b" },
  ],
  aes({ x: "x", y: "y", color: "cls" }),
)
  .geomPoint()
  .spec();

function makeCountingDeps(options?: { zoom?: boolean; initialSpec?: PortableSpec | null }): {
  deps: Parameters<typeof createPlotRuntime>[0];
  effectiveSpecReads: () => number;
  setEffectiveSpec: (spec: PortableSpec | null) => void;
} {
  let effectiveSpecReads = 0;
  let effectiveSpec: PortableSpec | null =
    options?.initialSpec === undefined ? minimalSpec : options.initialSpec;
  const zoomDomains =
    options?.zoom === true ? { x: [0.5, 1.5] as const, y: [5, 15] as const } : null;
  return {
    effectiveSpecReads: () => effectiveSpecReads,
    setEffectiveSpec: (spec) => {
      effectiveSpec = spec;
    },
    deps: {
      widthProp: () => 480,
      heightProp: () => 320,
      assembled: () => effectiveSpec,
      effectiveSpec: () => {
        effectiveSpecReads += 1;
        return effectiveSpec;
      },
      effectiveZoomDomains: () => zoomDomains,
      effectiveLegendFilters: () => [],
      root: () => null,
      resetZoom: () => {},
      // Getter returns the optional host callback; none registered in this fixture.
      onrender: () => {
        /* no onrender callback */
      },
    },
  };
}

function hammerGetters(runtime: ReturnType<typeof createPlotRuntime>): void {
  // ~20 getter reads is the issue's reported SSR render shape (model + strata
  // + hasCanvas interleaved the way markup and host deriveds hit them).
  for (let i = 0; i < 7; i++) {
    void runtime.model;
    void runtime.strata;
    void runtime.hasCanvas;
  }
}

describe("createPlotRuntime SSR pipeline memo (#1328)", () => {
  it("runs the model resolve once across many model/strata/hasCanvas reads", () => {
    expect(typeof window).toBe("undefined");

    const { deps, effectiveSpecReads } = makeCountingDeps();
    const runtime = createPlotRuntime(deps);

    hammerGetters(runtime);

    // One resolveModel per SSR pass — not one per getter read.
    expect(effectiveSpecReads()).toBe(1);
    expect(runtime.model).not.toBeNull();
    expect(runtime.strata.length).toBeGreaterThan(0);
    expect(runtime.hasCanvas).toBe(false);
    // Stable identity: later reads return the same memoized model.
    const first = runtime.model;
    const second = runtime.model;
    expect(first).toBe(second);
  });

  it("still resolves once when zoom forces the baseline + effective pipeline pair", () => {
    expect(typeof window).toBe("undefined");

    const { deps, effectiveSpecReads } = makeCountingDeps({ zoom: true });
    const runtime = createPlotRuntime(deps);

    hammerGetters(runtime);

    // resolveModel still enters once; the zoom baseline is a second runPipeline
    // inside that single resolve, not a second resolve from getter thrash.
    expect(effectiveSpecReads()).toBe(1);
    expect(runtime.model).not.toBeNull();
  });

  it("does not latch an early null before children register a real spec", () => {
    expect(typeof window).toBe("undefined");

    // Mimic the empty-registry window: first reads see null assembled, later
    // reads (after declaration children register) see the complete spec.
    const { deps, effectiveSpecReads, setEffectiveSpec } = makeCountingDeps({
      initialSpec: null,
    });
    const runtime = createPlotRuntime(deps);

    expect(runtime.model).toBeNull();
    expect(runtime.strata).toEqual([]);
    expect(runtime.hasCanvas).toBe(false);
    const earlyReads = effectiveSpecReads();
    expect(earlyReads).toBeGreaterThan(0);

    setEffectiveSpec(minimalSpec);
    hammerGetters(runtime);

    // After the first non-null resolve, thrashing does not re-run the pipeline.
    expect(runtime.model).not.toBeNull();
    expect(runtime.model!.candidates.size).toBe(2);
    expect(effectiveSpecReads()).toBe(earlyReads + 1);
  });
});
