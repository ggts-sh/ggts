import "../setup-register-all.js";
import { describe, expect, it } from "vitest";

import { runPipeline, type CandidateFacts, type RenderModel } from "@ggts-sh/core";
import { aes, gg } from "@ggts-sh/spec";

// Characterization via the stable resolver.js re-export path (internal barrel).
import {
  clearInspectionFingerprint,
  createInspectionCoordinator,
} from "../../src/lib/inspection/resolver.js";

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

describe("clearInspectionFingerprint", () => {
  it("scopes clear dedupe tokens by interaction source", () => {
    expect(clearInspectionFingerprint("pointer")).toBe("clear:pointer");
    expect(clearInspectionFingerprint("keyboard")).toBe("clear:keyboard");
    expect(clearInspectionFingerprint("programmatic")).toBe("clear:programmatic");
    expect(clearInspectionFingerprint("pointer")).not.toBe(clearInspectionFingerprint("touch"));
  });
});

describe("inspection coordinator", () => {
  it("materializes at most eight transient members and owns exactly two memo slots", () => {
    const data = Array.from({ length: 12 }, (_, index) => ({
      id: `row-${index}`,
      x: 1,
      y: index,
      series: `series-${index}`,
    }));
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y", color: "series" }))
        .geomPoint()
        .spec(),
      { width: 480, height: 320 },
    );
    const coordinator = createInspectionCoordinator(idKeys(data));
    const base = {
      model,
      seed: model.candidates.candidate(0)!,
      mode: "x" as const,
      source: "pointer" as const,
      identityEpoch: 1,
      layoutEpoch: 1,
    };
    const transient = coordinator.resolve({ ...base, state: "transient" })!;
    expect(transient.snapshot.members).toHaveLength(8);
    expect(coordinator.resolve({ ...base, state: "transient" })).toBe(transient);
    const pinned = coordinator.resolve({ ...base, state: "pinned" })!;
    expect(pinned.snapshot.members).toHaveLength(12);
    expect(coordinator.memoSize).toBe(2);
    coordinator.release("pinned");
    expect(coordinator.memoSize).toBe(1);
    coordinator.invalidate();
    expect(coordinator.memoSize).toBe(0);
    model.dispose();
  });
  it("separates semantic changes from presentation-only layout changes", () => {
    const data = [
      { id: "a", x: 1, y: 2 },
      { id: "b", x: 2, y: 3 },
    ];
    const makeModel = (width: number) =>
      runPipeline(
        gg(data, aes({ x: "x", y: "y" }))
          .geomPoint()
          .spec(),
        {
          width,
          height: 300,
        },
      );
    const first = makeModel(400);
    const coordinator = createInspectionCoordinator(idKeys(data));
    coordinator.resolve({
      model: first,
      seed: first.candidates.candidate(0)!,
      mode: "xy",
      state: "pinned",
      source: "pointer",
      identityEpoch: "data-1",
      layoutEpoch: "layout-1",
    });
    const resized = makeModel(700);
    const reconciled = coordinator.reconcilePinned({
      model: resized,
      identityEpoch: "data-1",
      layoutEpoch: "layout-2",
    })!;
    expect(reconciled.semanticChanged).toBe(false);
    expect(reconciled.presentationChanged).toBe(true);
    first.dispose();
    resized.dispose();
  });
  it("reconciles pins from their unique stable seed and invalidates keyless pins on data epochs", () => {
    const makeModel = (rows: { id: string; x: number; y: number }[], width = 400) =>
      runPipeline(
        gg(rows, aes({ x: "x", y: "y" }))
          .geomPoint()
          .spec(),
        {
          width,
          height: 300,
        },
      );
    const data = [{ id: "a", x: 1, y: 2 }];
    // Production rebuilds its key bag per identity epoch, so the resolver must
    // follow the active rows rather than close over the first model's.
    let activeRows: { id: string }[] = data;
    const first = makeModel(data);
    const keyed = createInspectionCoordinator((index) => activeRows[index]?.id ?? null);
    keyed.resolve({
      model: first,
      seed: first.candidates.candidate(0)!,
      mode: "xy",
      state: "pinned",
      source: "pointer",
      identityEpoch: 1,
      layoutEpoch: 1,
    });
    const movedRows = [{ id: "a", x: 4, y: 8 }];
    const moved = makeModel(movedRows, 600);
    activeRows = movedRows;
    const movedPin = keyed.reconcilePinned({
      model: moved,
      identityEpoch: 2,
      layoutEpoch: 2,
    })!;
    expect(movedPin.snapshot.focus.key).toBe("a");
    expect(movedPin.snapshot.source).toBe("programmatic");
    expect(movedPin.semanticChanged).toBe(true);
    expect(movedPin.snapshot.focus.anchor).not.toEqual(
      keyed.resolve({
        model: first,
        seed: first.candidates.candidate(0)!,
        mode: "xy",
        state: "transient",
        source: "pointer",
        identityEpoch: 1,
        layoutEpoch: 1,
      })!.snapshot.focus.anchor,
    );

    const keyless = createInspectionCoordinator(() => null);
    keyless.resolve({
      model: first,
      seed: first.candidates.candidate(0)!,
      mode: "xy",
      state: "pinned",
      source: "pointer",
      identityEpoch: "same-data",
      layoutEpoch: 1,
    });
    const keylessResized = makeModel([{ id: "a", x: 1, y: 2 }], 650);
    expect(
      keyless.reconcilePinned({
        model: keylessResized,
        identityEpoch: "same-data",
        layoutEpoch: 2,
      }),
    ).not.toBeNull();
    expect(
      keyless.reconcilePinned({
        model: moved,
        identityEpoch: "new-data",
        layoutEpoch: 3,
      }),
    ).toBeNull();

    const ambiguousRows = [
      { id: "a", x: 4, y: 8 },
      { id: "a", x: 5, y: 9 },
    ];
    const ambiguous = makeModel(ambiguousRows);
    keyed.resolve({
      model: moved,
      seed: moved.candidates.candidate(0)!,
      mode: "xy",
      state: "pinned",
      source: "pointer",
      identityEpoch: 2,
      layoutEpoch: 2,
    });
    activeRows = ambiguousRows;
    expect(
      keyed.reconcilePinned({
        model: ambiguous,
        identityEpoch: 3,
        layoutEpoch: 3,
      }),
    ).toBeNull();
    first.dispose();
    moved.dispose();
    ambiguous.dispose();
    keylessResized.dispose();
  });
  it("keeps a synthetic keyless seed across a layout-only epoch", () => {
    const data = [{ x: "a" }, { x: "a" }, { x: "b" }];
    const makeModel = (width: number) =>
      runPipeline(
        gg(data, aes({ x: "x" }))
          .geomBar()
          .spec(),
        { width, height: 300 },
      );
    const first = makeModel(400);
    const coordinator = createInspectionCoordinator(() => null);
    coordinator.resolve({
      model: first,
      seed: first.candidates.candidate(0)!,
      mode: "exact",
      state: "pinned",
      source: "pointer",
      identityEpoch: "same-data",
      layoutEpoch: 1,
    });
    const resized = makeModel(700);
    expect(
      coordinator.reconcilePinned({
        model: resized,
        identityEpoch: "same-data",
        layoutEpoch: 2,
      }),
    ).not.toBeNull();
    first.dispose();
    resized.dispose();
  });
  it("reconciles the stable batch role of synthetic composite marks", () => {
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
    const boxSpec = gg(
      [
        { group: "a", y: 1 },
        { group: "a", y: 2 },
        { group: "a", y: 3 },
        { group: "a", y: 100 },
      ],
      aes({ x: "group", y: "y" }),
    )
      .geomBoxplot()
      .spec();

    for (const spec of [smoothSpec, boxSpec]) {
      const first = runPipeline(spec, { width: 400, height: 300 });
      const resized = runPipeline(spec, { width: 700, height: 300 });
      const collidingSeeds = Array.from({ length: first.candidates.size }, (_, id) =>
        first.candidates.candidate(id)!,
      ).filter((fact, _, all) =>
        all.some(
          (other) =>
            other.id !== fact.id &&
            other.layerIndex === fact.layerIndex &&
            other.kind === fact.kind &&
            other.primitiveIndex === fact.primitiveIndex &&
            other.xValue === fact.xValue &&
            other.yValue === fact.yValue,
        ),
      );
      expect(collidingSeeds.length).toBeGreaterThanOrEqual(2);

      for (const seed of collidingSeeds) {
        const coordinator = createInspectionCoordinator(() => null);
        coordinator.resolve({
          model: first,
          seed,
          mode: seed.autoMode,
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
        expect(sameKindBatchOrdinal(resized, reconciled!.seed)).toBe(
          sameKindBatchOrdinal(first, seed),
        );
      }
      first.dispose();
      resized.dispose();
    }
  });
});
