import "../setup-register-all.js";
import { describe, expect, it, vi } from "vitest";

import { runPipeline, type CandidateFacts, type RenderModel } from "@ggsvelte/core";
import { aes, gg } from "@ggsvelte/spec";

// Characterization via the stable resolver.js re-export path (internal barrel).
import { createInspectionCoordinator } from "../../src/lib/inspection/resolver.js";

function sameKindBatchOrdinal(model: RenderModel, seed: CandidateFacts): number {
  return (
    model.scene.batches
      .slice(0, seed.batchIndex + 1)
      .filter((batch) => batch.layerIndex === seed.layerIndex && batch.kind === seed.kind).length -
    1
  );
}

/**
 * Index-keyed source-row keys, the shape the coordinator takes. Production
 * passes a prebuilt semantic-key bag, so this reads the authored rows rather
 * than materializing model rows — a resolver that read rows would put back
 * the very cost these tests bound.
 */
function idKeys(rows: readonly { id: string }[]): (index: number) => string | null {
  return (index) => rows[index]?.id ?? null;
}

describe("inspection coordinator", () => {
  it("transient fingerprint does not read every row in a large axis group", () => {
    // Complexity: fingerprint used to walk all M members (Object.keys each row)
    // before the slot cache check. Transient now caps at TRANSIENT_MEMBER_LIMIT (8).
    const n = 400;
    const data = Array.from({ length: n }, (_, i) => ({
      id: `r${i}`,
      x: 1,
      y: i,
    }));
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y", color: "id" }))
        .geomPoint()
        .spec(),
      { width: 400, height: 300 },
    );
    const originalRow = model.row.bind(model);
    let rowReads = 0;
    vi.spyOn(model, "row").mockImplementation((index: number) => {
      rowReads++;
      return originalRow(index);
    });
    const coordinator = createInspectionCoordinator(idKeys(data));
    rowReads = 0;
    const resolved = coordinator.resolve({
      model,
      seed: model.candidates.candidate(0)!,
      mode: "x",
      state: "transient",
      source: "pointer",
      identityEpoch: 1,
      layoutEpoch: "layout-1",
      completeness: "transient",
    });
    expect(resolved).not.toBeNull();
    // Full-group fingerprint would read ~n member rows (+ focus). Cap ≈ 8 members + focus + materialize.
    expect(rowReads).toBeLessThan(40);
    expect(rowReads).toBeLessThan(n / 5);
    model.dispose();
  });
  it("fingerprints null/Date/-0 cells and symbol keys in coordinated snapshots", () => {
    const data = [
      { id: "a", x: 1, y: 2 },
      { id: "b", x: 1, y: 3 },
    ];
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y", color: "id" }))
        .geomPoint()
        .spec(),
      { width: 400, height: 300 },
    );
    // Inject cell shapes cellToken handles specially (null / Date / -0) without
    // going through PortableSpec validation, which rejects Date/null payloads.
    const originalRow = model.row.bind(model);
    vi.spyOn(model, "row").mockImplementation((index: number) => {
      const base = originalRow(index);
      if (base === null) return null;
      return {
        ...base,
        note: index === 0 ? null : "ok",
        when: new Date("2020-01-01T00:00:00Z"),
        y: index === 1 ? -0 : base["y"],
      };
    });
    const symbols = new Map<string, symbol>([
      ["a", Symbol("a")],
      ["b", Symbol("b")],
    ]);
    const coordinator = createInspectionCoordinator((index) => {
      const id = idKeys(data)(index);
      return id === null ? null : (symbols.get(id) ?? null);
    });
    const epoch = Symbol("layout");
    const resolved = coordinator.resolve({
      model,
      seed: model.candidates.candidate(0)!,
      mode: "x",
      state: "transient",
      source: "pointer",
      identityEpoch: 1,
      layoutEpoch: epoch,
    });
    expect(resolved).not.toBeNull();
    expect(resolved!.snapshot.members.length).toBeGreaterThanOrEqual(1);
    // Symbol keys must stay distinct across the same string identity.
    expect([...new Set(resolved!.semanticFingerprint.match(/symbol:\d+/g) ?? [])]).toEqual([
      "symbol:0",
      "symbol:1",
    ]);
    // null/Date/-0 all contribute typed cell tokens to the fingerprint payload.
    expect(resolved!.semanticFingerprint).toContain("note=null");
    expect(resolved!.semanticFingerprint).toContain("when=date:1577836800000");
    expect(resolved!.semanticFingerprint).toContain("y=number:0");
    // Re-resolve with the same symbol layout epoch must hit the memo slot.
    expect(
      coordinator.resolve({
        model,
        seed: model.candidates.candidate(0)!,
        mode: "x",
        state: "transient",
        source: "pointer",
        identityEpoch: 1,
        layoutEpoch: epoch,
      }),
    ).toBe(resolved);
    model.dispose();
  });
  it("returns null from reconcilePinned when no pin is active", () => {
    const data = [{ id: "a", x: 1, y: 2 }];
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y" }))
        .geomPoint()
        .spec(),
      { width: 300, height: 200 },
    );
    const coordinator = createInspectionCoordinator(idKeys(data));
    expect(
      coordinator.reconcilePinned({
        model,
        identityEpoch: 1,
        layoutEpoch: 1,
      }),
    ).toBeNull();
    model.dispose();
  });
  it("disambiguates multi-match pins that share one source row via batch role", () => {
    const smoothSpec = gg(
      [
        { x: 0, y: 1 },
        { x: 1, y: 3 },
        { x: 2, y: 5 },
      ],
      aes({ x: "x", y: "y" }),
    )
      .geomSmooth({ method: "lm" })
      .spec();
    const first = runPipeline(smoothSpec, { width: 400, height: 300 });
    const resized = runPipeline(smoothSpec, { width: 700, height: 300 });
    // Keyed coordinator with a constant key so every candidate maps to the same key —
    // reconcile then uses seedKind/batchRole/primitiveIndex to pick one match.
    const coordinator = createInspectionCoordinator(() => "smooth");
    const seed = first.candidates.candidate(0)!;
    coordinator.resolve({
      model: first,
      seed,
      mode: "exact",
      state: "pinned",
      source: "pointer",
      identityEpoch: "same-data",
      layoutEpoch: first.runId,
    });
    const reconciled = coordinator.reconcilePinned({
      model: resized,
      identityEpoch: "same-data",
      layoutEpoch: resized.runId,
    });
    expect(reconciled).not.toBeNull();
    expect(reconciled!.seed.kind).toBe(seed.kind);
    expect(reconciled!.seed.primitiveIndex).toBe(seed.primitiveIndex);
    expect(sameKindBatchOrdinal(resized, reconciled!.seed)).toBe(sameKindBatchOrdinal(first, seed));
    first.dispose();
    resized.dispose();
  });

  it("pinned exact snapshots treat a stack-total change as a semantic change", () => {
    const firstRows = [
      { id: "a", x: "A", y: 1, series: "s1" },
      { id: "b", x: "A", y: 2, series: "s2" },
    ];
    const nextRows = [
      { id: "a", x: "A", y: 1, series: "s1" },
      { id: "b", x: "A", y: 9, series: "s2" },
    ];
    const first = runPipeline(
      gg(firstRows, aes({ x: "x", y: "y", fill: "series" }))
        .geomCol({ position: "stack" })
        .spec(),
      { width: 400, height: 300 },
    );
    const next = runPipeline(
      gg(nextRows, aes({ x: "x", y: "y", fill: "series" }))
        .geomCol({ position: "stack" })
        .spec(),
      { width: 400, height: 300 },
    );
    const coordinator = createInspectionCoordinator(idKeys(firstRows));
    const seed = first.candidates.candidate(0)!;
    const pinned = coordinator.resolve({
      model: first,
      seed,
      mode: "exact",
      state: "pinned",
      source: "pointer",
      identityEpoch: "same-ids",
      layoutEpoch: first.runId,
    });
    expect(pinned?.snapshot.groupTotal).toBe(3);
    let nextSeed = next.candidates.candidate(0)!;
    for (let id = 0; id < next.candidates.size; id++) {
      const candidate = next.candidates.candidate(id);
      if (candidate?.rowIndex === seed.rowIndex) {
        nextSeed = candidate;
        break;
      }
    }

    const updated = coordinator.resolve({
      model: next,
      seed: nextSeed,
      mode: "exact",
      state: "pinned",
      source: "pointer",
      identityEpoch: "same-ids",
      layoutEpoch: next.runId,
    });
    expect(updated?.snapshot.groupTotal).toBe(10);
    expect(updated?.semanticChanged).toBe(true);
    first.dispose();
    next.dispose();
  });
});
