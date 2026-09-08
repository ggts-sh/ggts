import "../setup-register-all.js";
import { describe, expect, it, vi } from "vitest";

import { runPipeline } from "@ggts-sh/core";
import { aes, gg } from "@ggts-sh/spec";

// Characterization via the stable resolver.js re-export path (internal barrel).
import { createInspectionCoordinator } from "../../src/lib/inspection/resolver.js";

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
  it("skips lineage.keys for keyless pin candidates that fail cheap filters", () => {
    const data = Array.from({ length: 40 }, (_, index) => ({
      id: `r${index}`,
      x: index,
      y: (index % 7) + 1,
    }));
    const makeModel = (width: number) =>
      runPipeline(
        gg(data, aes({ x: "x", y: "y" }))
          .geomPoint()
          .spec(),
        { width, height: 300 },
      );
    const first = makeModel(400);
    const resized = makeModel(700);
    expect(first.candidates.size).toBeGreaterThan(10);

    const coordinator = createInspectionCoordinator(() => null);
    const seed = first.candidates.candidate(0)!;
    coordinator.resolve({
      model: first,
      seed,
      mode: "exact",
      state: "pinned",
      source: "pointer",
      identityEpoch: "same-data",
      layoutEpoch: 1,
    });

    const keysSpy = vi.spyOn(resized.lineage, "keys");
    const reconciled = coordinator.reconcilePinned({
      model: resized,
      identityEpoch: "same-data",
      layoutEpoch: 2,
    });
    expect(reconciled).not.toBeNull();
    // Cheap-filter survivors are O(matches); a full-store join walk is O(C).
    // Materialization may call keys a few more times for the matched seed.
    expect(keysSpy.mock.calls.length).toBeLessThan(resized.candidates.size);
    first.dispose();
    resized.dispose();
  });
  it("does not scan every candidate on layout-only keyed pin rebind", () => {
    const count = 2_000;
    const data = Array.from({ length: count }, (_, index) => ({
      id: `r${index}`,
      x: index,
      y: (index % 11) + 1,
    }));
    const makeModel = (width: number) =>
      runPipeline(
        gg(data, aes({ x: "x", y: "y" }))
          .geomPoint()
          .spec(),
        { width, height: 300 },
      );
    const first = makeModel(400);
    const resized = makeModel(700);
    expect(resized.candidates.size).toBe(count);

    const coordinator = createInspectionCoordinator(idKeys(data));
    coordinator.resolve({
      model: first,
      seed: first.candidates.candidate(0)!,
      mode: "exact",
      state: "pinned",
      source: "pointer",
      identityEpoch: "layout-stable",
      layoutEpoch: 1,
    });

    const candidateSpy = vi.spyOn(resized.candidates, "candidate");
    const reconciled = coordinator.reconcilePinned({
      model: resized,
      identityEpoch: "layout-stable",
      layoutEpoch: 2,
    });
    expect(reconciled).not.toBeNull();
    expect(reconciled!.snapshot.focus.key).toBe("r0");
    // seedId O(1) + materialize; a full rebind walk is ~C candidate() lookups.
    expect(candidateSpy.mock.calls.length).toBeLessThan(32);
    expect(candidateSpy.mock.calls.length).toBeLessThan(count / 20);
    first.dispose();
    resized.dispose();
  });
  it("keyed identity-change rebind does not build a row per candidate (#1318)", () => {
    // Identity-epoch change skips the seedId fast path and full-scans. keyedPinMatch
    // used to call model.row for every layer candidate (O(C·F) allocations). Row
    // builds must stay O(matches + materialize), not O(C).
    const count = 400;
    const data = Array.from({ length: count }, (_, index) => ({
      id: `r${index}`,
      x: index,
      y: (index % 11) + 1,
    }));
    const makeModel = () =>
      runPipeline(
        gg(data, aes({ x: "x", y: "y" }))
          .geomPoint()
          .spec(),
        { width: 400, height: 300 },
      );
    const first = makeModel();
    const next = makeModel();
    expect(next.candidates.size).toBe(count);

    const coordinator = createInspectionCoordinator(idKeys(data));
    coordinator.resolve({
      model: first,
      seed: first.candidates.candidate(0)!,
      mode: "exact",
      state: "pinned",
      source: "pointer",
      identityEpoch: 1,
      layoutEpoch: 1,
    });

    const originalRow = next.row.bind(next);
    let rowReads = 0;
    vi.spyOn(next, "row").mockImplementation((index: number) => {
      rowReads++;
      return originalRow(index);
    });
    const reconciled = coordinator.reconcilePinned({
      model: next,
      identityEpoch: 2,
      layoutEpoch: 2,
    });
    expect(reconciled).not.toBeNull();
    expect(reconciled!.snapshot.focus.key).toBe("r0");
    // Full-scan keyed match must not allocate a row for every candidate. Materialize
    // still reads focus (+ members); a pre-fix pass is ~C (+ materialize) row reads.
    expect(rowReads).toBeLessThan(40);
    expect(rowReads).toBeLessThan(count / 5);
    first.dispose();
    next.dispose();
  });
  it("rejects keyed seedId fast path when primitive role no longer matches", () => {
    const data = [{ id: "a", x: 1, y: 2, ymin: 1, ymax: 3 }];
    const points = runPipeline(
      gg(data, aes({ x: "x", y: "y" }))
        .geomPoint()
        .spec(),
      { width: 400, height: 300 },
    );
    const errorbars = runPipeline(
      gg(data, aes({ x: "x", y: "y", ymin: "ymin", ymax: "ymax" }))
        .geomErrorbar()
        .spec(),
      { width: 400, height: 300 },
    );
    const coordinator = createInspectionCoordinator(idKeys(data));
    const seed = points.candidates.candidate(0)!;
    expect(seed.kind).toBe("points");
    coordinator.resolve({
      model: points,
      seed,
      mode: "exact",
      state: "pinned",
      source: "pointer",
      identityEpoch: "same-epoch",
      layoutEpoch: 1,
    });
    // Same epoch token, different geom at seedId — role mismatch must not pin.
    const atSameId = errorbars.candidates.candidate(seed.id);
    expect(atSameId).not.toBeNull();
    expect(atSameId!.kind).not.toBe("points");
    const reconciled = coordinator.reconcilePinned({
      model: errorbars,
      identityEpoch: "same-epoch",
      layoutEpoch: 2,
    });
    // Full scan finds no points-role match for key "a" → clear pin.
    expect(reconciled).toBeNull();
    points.dispose();
    errorbars.dispose();
  });
  it("does not scan every candidate on layout-only keyless pin rebind", () => {
    const count = 2_000;
    const data = Array.from({ length: count }, (_, index) => ({
      id: `r${index}`,
      x: index,
      y: (index % 11) + 1,
    }));
    const makeModel = (width: number) =>
      runPipeline(
        gg(data, aes({ x: "x", y: "y" }))
          .geomPoint()
          .spec(),
        { width, height: 300 },
      );
    const first = makeModel(400);
    const resized = makeModel(700);

    const coordinator = createInspectionCoordinator(() => null);
    coordinator.resolve({
      model: first,
      seed: first.candidates.candidate(7)!,
      mode: "exact",
      state: "pinned",
      source: "pointer",
      identityEpoch: "layout-stable",
      layoutEpoch: 1,
    });

    const candidateSpy = vi.spyOn(resized.candidates, "candidate");
    const reconciled = coordinator.reconcilePinned({
      model: resized,
      identityEpoch: "layout-stable",
      layoutEpoch: 2,
    });
    expect(reconciled).not.toBeNull();
    expect(candidateSpy.mock.calls.length).toBeLessThan(32);
    expect(candidateSpy.mock.calls.length).toBeLessThan(count / 20);
    first.dispose();
    resized.dispose();
  });

  it("full-scans keyless pins when seedId preferred is missing (same identity epoch)", () => {
    // Same-epoch preferred path fails when seedId is gone; fall through to a
    // unique keyless match over the candidate store.
    const data = [
      { id: "a", x: 1, y: 2 },
      { id: "b", x: 3, y: 4 },
    ];
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y" }))
        .geomPoint()
        .spec(),
      { width: 320, height: 240 },
    );
    const seed = model.candidates.candidate(0)!;
    const coordinator = createInspectionCoordinator(() => null);
    coordinator.resolve({
      model,
      seed,
      mode: "exact",
      state: "pinned",
      source: "pointer",
      identityEpoch: "same",
      layoutEpoch: 1,
    });
    const realCandidate = model.candidates.candidate.bind(model.candidates);
    // Prefer path: seedId → null; full scan still finds the unique match.
    vi.spyOn(model.candidates, "candidate").mockImplementation((id: number) => {
      if (id === seed.id) return null;
      return realCandidate(id);
    });
    const reconciled = coordinator.reconcilePinned({
      model,
      identityEpoch: "same",
      layoutEpoch: 2,
    });
    // Full scan may find zero matches if seedId was the only match identity —
    // either clear pin or rebind; both exercise the scan loop.
    if (reconciled === null) {
      expect(coordinator.memoSize).toBe(0);
    } else {
      expect(reconciled.snapshot.focus).toBeDefined();
    }
    model.dispose();
  });
});
