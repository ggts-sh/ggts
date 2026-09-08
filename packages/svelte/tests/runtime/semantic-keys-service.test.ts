import "../setup-register-all.js";
/**
 * Unit tests for createSemanticKeyService (rune-backed).
 * Factories own effects — instantiate under `$effect.root` and destroy.
 */
import { flushSync } from "svelte";
import { describe, expect, it, vi } from "vitest";

import type { RenderModel } from "@ggts-sh/core";

import { createSourceIdentityTracker } from "../../src/lib/runtime/semantic-source-identity.js";
import { createSemanticKeyService } from "../../src/lib/runtime/semantic-keys.svelte.js";
import { withEffectRoot, withFlushedEffectRoot } from "../helpers/effect-root.svelte.js";
import { buildPointModel } from "../helpers/point-model.js";
import { reactiveBox } from "../helpers/reactive-box.svelte.js";

const rows = [
  { id: "a", x: 1, y: 10 },
  { id: "b", x: 2, y: 20 },
];

// Reactive service (from plot-shared-services.test.ts)
// ---------------------------------------------------------------------------

describe("createSemanticKeyService", () => {
  it("keeps stable identity across a data-preserving re-render and flags key mutation as unstable", () => {
    // Mutable rows: same array identity (same data token) across renders.
    const mutableRows = [
      { id: "a", x: 1, y: 10 },
      { id: "b", x: 2, y: 20 },
    ];
    const buildModel = () => buildPointModel(mutableRows);
    const model = reactiveBox(buildModel());
    const tracker = createSourceIdentityTracker();
    const diagnostics: string[] = [];

    const { value: service, destroy } = withFlushedEffectRoot(() => {
      const created = createSemanticKeyService({
        model: () => model.value,
        assembled: () => ({
          data: mutableRows,
          layers: [{ geom: "point" }],
          aes: { x: { field: "x" }, y: { field: "y" }, color: { field: "id" } },
        }),
        datumKey: () => "id",
        data: () => mutableRows,
        spec: () => null,
        sourceIdentity: (value) => tracker.sourceIdentity(value),
        deliverDiagnostic: (d) => {
          diagnostics.push(d.code);
        },
      });
      return created;
    });

    const first = [service.keyAt(0), service.keyAt(1)];
    expect(first).toEqual(["a", "b"]);
    expect(diagnostics).toEqual([]);

    // Data-preserving re-render: NEW model, same data token → same keys, no
    // diagnostics. (model is reactive state, so the swap re-resolves keys.)
    const previous = model.value;
    model.set(buildModel());
    flushSync();
    expect([service.keyAt(0), service.keyAt(1)]).toEqual(first);
    expect(diagnostics).toEqual([]);
    previous.dispose();

    // Key mutation under the SAME data token: priorKeys must catch it — the
    // mutated row's key becomes null and an unstable-key diagnostic fires.
    // This also proves the re-render above genuinely re-resolved (the same
    // code path now observably reacts to the model swap).
    mutableRows[0].id = "z";
    const beforeMutation = model.value;
    model.set(buildModel());
    flushSync();
    expect(service.keyAt(0)).toBeNull();
    expect(service.keyAt(1)).toBe("b");
    expect(diagnostics).toContain("INTERACTION_UNSTABLE_KEY");
    beforeMutation.dispose();
    model.value.dispose();
    destroy();
  });

  it("keyAt re-resolves against a wholly new data token", () => {
    // Restored from the pre-S16 access-contract test: a FULL dataset
    // replacement (new data token) must re-resolve keys — a service that
    // pins keys from the first token would keep answering with stale keys.
    const dataA = [
      { id: "a", x: 1, y: 10 },
      { id: "b", x: 2, y: 20 },
    ];
    const dataB = [
      { id: "c", x: 3, y: 30 },
      { id: "d", x: 4, y: 40 },
    ];
    const dataBox = reactiveBox(dataA);
    const model = reactiveBox(buildPointModel(dataA));
    const tracker = createSourceIdentityTracker();

    const { value: service, destroy } = withFlushedEffectRoot(() => {
      const created = createSemanticKeyService({
        model: () => model.value,
        assembled: () => null,
        datumKey: () => "id",
        data: () => dataBox.value,
        spec: () => null,
        sourceIdentity: (value) => tracker.sourceIdentity(value),
        deliverDiagnostic: () => {},
      });
      return created;
    });

    expect([service.keyAt(0), service.keyAt(1)]).toEqual(["a", "b"]);

    const previous = model.value;
    dataBox.set(dataB);
    model.set(buildPointModel(dataB));
    flushSync();
    expect([service.keyAt(0), service.keyAt(1)]).toEqual(["c", "d"]);

    previous.dispose();
    model.value.dispose();
    destroy();
  });

  it("delivers diagnostics once per change (behavior, not implementation)", () => {
    const duplicateRows = () => [
      { id: "a", x: 1, y: 1 },
      { id: "a", x: 2, y: 2 },
    ];
    const buildModel = (data: { id: string; x: number; y: number }[]) =>
      buildPointModel(data, { x: "x", y: "y" }, { width: 200, height: 200 });
    const dataBox = reactiveBox(duplicateRows());
    const modelBox = reactiveBox<RenderModel | null>(buildModel(dataBox.value));
    const diagnostics: string[] = [];
    const tracker = createSourceIdentityTracker();

    const { destroy } = withFlushedEffectRoot(() => {
      const created = createSemanticKeyService({
        model: () => modelBox.value,
        assembled: () => ({
          data: dataBox.value,
          layers: [{ geom: "point" }],
          aes: { x: { field: "x" }, y: { field: "y" } },
        }),
        datumKey: () => "id",
        data: () => dataBox.value,
        spec: () => null,
        sourceIdentity: (value) => tracker.sourceIdentity(value),
        deliverDiagnostic: (d) => {
          diagnostics.push(d.code);
        },
      });
      return created;
    });

    // Duplicate "a"/"a" keys → exactly one duplicate diagnostic on first resolve.
    expect(diagnostics).toEqual(["INTERACTION_DUPLICATE_KEY"]);
    // Re-flush without changing any dependency must not re-deliver.
    flushSync();
    expect(diagnostics).toEqual(["INTERACTION_DUPLICATE_KEY"]);

    // A REAL change (new data identity, same duplicate condition) re-resolves
    // and delivers the diagnostic exactly once more — once per change, not
    // once per flush and not zero.
    const previous = modelBox.value;
    dataBox.set(duplicateRows());
    modelBox.set(buildModel(dataBox.value));
    flushSync();
    expect(diagnostics).toEqual(["INTERACTION_DUPLICATE_KEY", "INTERACTION_DUPLICATE_KEY"]);
    previous?.dispose();
    modelBox.value?.dispose();
    destroy();
  });

  it("does not invoke deps during construction", () => {
    let calls = 0;
    const counting = <T>(value: T) => {
      calls++;
      return value;
    };
    const model = buildPointModel(rows);
    const { destroy } = withEffectRoot(() =>
      createSemanticKeyService({
        model: () => counting(model),
        assembled: () => counting(null),
        datumKey: () => counting("id" as const),
        data: () => counting(rows),
        spec: () => counting(null),
        sourceIdentity: (v) => {
          calls++;
          return String(v);
        },
        deliverDiagnostic: () => {
          calls++;
        },
      }),
    );
    expect(calls).toBe(0);
    destroy();
    model.dispose();
  });

  it("returns per-candidate semantic keys from lineage + row keys", () => {
    const model = buildPointModel(rows);
    const tracker = createSourceIdentityTracker();
    const { value: service, destroy } = withFlushedEffectRoot(() =>
      createSemanticKeyService({
        model: () => model,
        assembled: () => null,
        datumKey: () => "id",
        data: () => rows,
        spec: () => null,
        sourceIdentity: (value) => tracker.sourceIdentity(value),
        deliverDiagnostic: () => {},
      }),
    );

    const keysById: PropertyKey[][] = [];
    for (let id = 0; id < model.candidates.size; id++) {
      const candidate = model.candidates.candidate(id);
      expect(candidate).not.toBeNull();
      keysById.push(service.candidateSemanticKeys(candidate!));
    }
    expect(keysById).toEqual([["a"], ["b"]]);

    destroy();
    model.dispose();
  });

  it("shares one candidate→keys projection across repeated full-store walks", () => {
    // Interval + selection + masks each used to re-walk lineage per candidate.
    // Within one model/key epoch, N full walks must not re-pay O(C×L).
    const model = buildPointModel(rows);
    const keysSpy = vi.spyOn(model.lineage, "keys");
    const tracker = createSourceIdentityTracker();
    const { value: service, destroy } = withFlushedEffectRoot(() =>
      createSemanticKeyService({
        model: () => model,
        assembled: () => null,
        datumKey: () => "id",
        data: () => rows,
        spec: () => null,
        sourceIdentity: (value) => tracker.sourceIdentity(value),
        deliverDiagnostic: () => {},
      }),
    );

    const walkAll = () => {
      const out: PropertyKey[][] = [];
      for (let id = 0; id < model.candidates.size; id++) {
        const candidate = model.candidates.candidate(id);
        if (candidate === null) continue;
        out.push(service.candidateSemanticKeys(candidate));
      }
      return out;
    };

    const first = walkAll();
    const callsAfterFirstWalk = keysSpy.mock.calls.length;
    expect(first).toEqual([["a"], ["b"]]);
    // Distinct point lineages: one cold expansion per candidate membership.
    expect(callsAfterFirstWalk).toBeGreaterThanOrEqual(model.candidates.size);

    // Two more full walks (interval + selection consumers) must reuse the
    // shared projection — no additional lineage.keys work.
    expect(walkAll()).toEqual(first);
    expect(walkAll()).toEqual(first);
    expect(keysSpy.mock.calls.length).toBe(callsAfterFirstWalk);

    keysSpy.mockRestore();
    destroy();
    model.dispose();
  });

  it("expands a shared lineage once on a full-store cold walk (smooth-shaped)", () => {
    // Smooth eval grids share one lineage of L rows across C marks. The service
    // must not call lineage.keys once per mark on the first projection walk.
    const sharedRows = Array.from({ length: 40 }, (_, i) => i);
    const lineage = {
      keys: vi.fn((id: number) => (id === 7 ? sharedRows : [])),
    };
    const candidates = {
      size: 12,
      candidate(id: number) {
        if (id < 0 || id >= 12) return null;
        return {
          id,
          lineage: 7,
          rowIndex: null,
          layerIndex: 0,
          x: 0,
          y: 0,
          kind: "points",
          batchIndex: 0,
          primitiveIndex: id,
          panelId: "p0",
        };
      },
    };
    const model = {
      candidates,
      lineage,
      row: (index: number) => ({ id: `k${String(index)}` }),
      dispose() {},
    } as unknown as RenderModel;

    const tracker = createSourceIdentityTracker();
    const { value: service, destroy } = withFlushedEffectRoot(() =>
      createSemanticKeyService({
        model: () => model,
        assembled: () => null,
        datumKey: () => "id",
        data: () => sharedRows.map((i) => ({ id: `k${String(i)}` })),
        spec: () => null,
        sourceIdentity: (value) => tracker.sourceIdentity(value),
        deliverDiagnostic: () => {},
      }),
    );

    // resolveSemanticKeys already expanded lineage once at construction.
    const afterResolve = lineage.keys.mock.calls.length;
    expect(afterResolve).toBeGreaterThanOrEqual(1);

    const bags: PropertyKey[][] = [];
    for (let id = 0; id < 12; id++) {
      const c = candidates.candidate(id);
      expect(c).not.toBeNull();
      bags.push(service.candidateSemanticKeys(c as never));
    }
    // Projection expands the shared lineage once more (not once per mark).
    expect(lineage.keys.mock.calls.length - afterResolve).toBe(1);
    expect(bags[0]?.length).toBe(40);
    expect(bags[11]).toBe(bags[0]);

    destroy();
  });

  it("rebuilds the candidate projection when the model is replaced", () => {
    const dataA = [
      { id: "a", x: 1, y: 10 },
      { id: "b", x: 2, y: 20 },
    ];
    const dataB = [
      { id: "x", x: 3, y: 30 },
      { id: "y", x: 4, y: 40 },
    ];
    const dataBox = reactiveBox(dataA);
    const modelBox = reactiveBox(buildPointModel(dataA));
    const tracker = createSourceIdentityTracker();

    const { value: service, destroy } = withFlushedEffectRoot(() =>
      createSemanticKeyService({
        model: () => modelBox.value,
        assembled: () => null,
        datumKey: () => "id",
        data: () => dataBox.value,
        spec: () => null,
        sourceIdentity: (value) => tracker.sourceIdentity(value),
        deliverDiagnostic: () => {},
      }),
    );

    const keysFor = (m: RenderModel) => {
      const out: PropertyKey[][] = [];
      for (let id = 0; id < m.candidates.size; id++) {
        const candidate = m.candidates.candidate(id);
        if (candidate === null) continue;
        out.push(service.candidateSemanticKeys(candidate));
      }
      return out;
    };

    expect(keysFor(modelBox.value)).toEqual([["a"], ["b"]]);

    const previous = modelBox.value;
    dataBox.set(dataB);
    modelBox.set(buildPointModel(dataB));
    flushSync();
    expect(keysFor(modelBox.value)).toEqual([["x"], ["y"]]);

    previous.dispose();
    modelBox.value.dispose();
    destroy();
  });

  it("does not project candidate keys until candidateSemanticKeys is read", () => {
    // Interval union / empty-focus short-circuits never call
    // candidateSemanticKeys — the shared projection must stay lazy so idle
    // plots do not pay O(C×L) on every model tick.
    const model = buildPointModel(rows);
    const keysSpy = vi.spyOn(model.lineage, "keys");
    const tracker = createSourceIdentityTracker();
    const { value: service, destroy } = withFlushedEffectRoot(() =>
      createSemanticKeyService({
        model: () => model,
        assembled: () => null,
        datumKey: () => "id",
        data: () => rows,
        spec: () => null,
        sourceIdentity: (value) => tracker.sourceIdentity(value),
        deliverDiagnostic: () => {},
      }),
    );

    // Row-key resolution walks lineage once per candidate.
    expect(service.keyAt(0)).toBe("a");
    expect(service.keyAt(1)).toBe("b");
    const afterRowKeys = keysSpy.mock.calls.length;
    expect(afterRowKeys).toBeGreaterThanOrEqual(model.candidates.size);

    // No candidateSemanticKeys → no second projection walk.
    flushSync();
    expect(keysSpy.mock.calls.length).toBe(afterRowKeys);

    keysSpy.mockRestore();
    destroy();
    model.dispose();
  });

  it("resolves only the requested candidate on first candidateSemanticKeys call", () => {
    // Point-toggle (surface) hits one candidate. Eager full-store fill would
    // regress click cost from O(L) to O(C×L); cache must fill per id.
    const model = buildPointModel(rows);
    const keysSpy = vi.spyOn(model.lineage, "keys");
    const tracker = createSourceIdentityTracker();
    const { value: service, destroy } = withFlushedEffectRoot(() =>
      createSemanticKeyService({
        model: () => model,
        assembled: () => null,
        datumKey: () => "id",
        data: () => rows,
        spec: () => null,
        sourceIdentity: (value) => tracker.sourceIdentity(value),
        deliverDiagnostic: () => {},
      }),
    );

    // Warm row keys first so subsequent lineage.keys calls are projection-only.
    expect(service.keyAt(0)).toBe("a");
    const afterRowKeys = keysSpy.mock.calls.length;

    const first = model.candidates.candidate(0);
    expect(first).not.toBeNull();
    expect(service.candidateSemanticKeys(first!)).toEqual(["a"]);
    // Exactly one extra lineage walk for the hit candidate — not a full store.
    expect(keysSpy.mock.calls.length).toBe(afterRowKeys + 1);

    keysSpy.mockRestore();
    destroy();
    model.dispose();
  });

  it("returns empty keys when model becomes null", () => {
    const model = buildPointModel(rows);
    const candidate = model.candidates.candidate(0);
    expect(candidate).not.toBeNull();
    const modelBox = reactiveBox<RenderModel | null>(model);
    const tracker = createSourceIdentityTracker();
    const { value: service, destroy } = withFlushedEffectRoot(() =>
      createSemanticKeyService({
        model: () => modelBox.value,
        assembled: () => null,
        datumKey: () => "id",
        data: () => rows,
        spec: () => null,
        sourceIdentity: (value) => tracker.sourceIdentity(value),
        deliverDiagnostic: () => {},
      }),
    );

    expect(service.candidateSemanticKeys(candidate!)).toEqual(["a"]);
    modelBox.set(null);
    flushSync();
    expect(service.candidateSemanticKeys(candidate!)).toEqual([]);

    destroy();
    model.dispose();
  });
});
