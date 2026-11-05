import "../setup-register-all.js";
import { describe, expect, it, vi } from "vitest";

import { runPipeline } from "@ggts-sh/core";
import { aes, gg } from "@ggts-sh/spec";

import { createInspectionCoordinator } from "../../src/lib/inspection/resolver.js";

const size = { width: 640, height: 400 };

function smoothModel(rowCount: number) {
  const rows = Array.from({ length: rowCount }, (_, index) => ({
    id: `r${index}`,
    x: index,
    y: index * 0.5 + (index % 7),
  }));
  return {
    rows,
    model: runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomSmooth({ method: "lm" })
        .spec(),
      size,
    ),
  };
}

/** Bars with the same height at the same x, built from different source rows. */
function barModel(groups: readonly string[]) {
  return runPipeline(
    gg(
      groups.map((g) => ({ g })),
      aes({ x: "g" }),
    )
      .geomBar()
      .spec(),
    size,
  );
}

const hover = { mode: "x", state: "transient", source: "pointer", identityEpoch: 1 } as const;

describe("source keys of one lineage", () => {
  it("walks the rows of a stat line once as the pointer moves along it", () => {
    const rowCount = 500;
    const { rows, model } = smoothModel(rowCount);
    let keyReads = 0;
    const coordinator = createInspectionCoordinator<Record<string, never>, string>((index) => {
      keyReads++;
      return rows[index]?.id ?? null;
    });
    const lineages = new Set<number>();
    const hovers = 30;
    let last = null;
    for (let step = 0; step < hovers; step++) {
      const id = Math.floor((step / hovers) * model.candidates.size);
      const seed = model.candidates.candidate(id)!;
      lineages.add(seed.lineage);
      last = coordinator.resolve({ ...hover, model, seed, layoutEpoch: 1 });
    }
    expect(lineages.size).toBe(1);
    expect(last?.snapshot.focus.sourceKeys).toHaveLength(rowCount);
    expect(last?.snapshot.focus.sourceKeys).toContain(`r${rowCount - 1}`);
    expect(keyReads).toBeLessThan(rowCount * 2);
    model.dispose();
  });

  it("reads new keys when the key mapping changes for the same model", () => {
    const { model } = smoothModel(40);
    let prefix = "a";
    let identity = {};
    const coordinator = createInspectionCoordinator<Record<string, never>, string>(
      (index) => `${prefix}${index}`,
      () => identity,
    );
    const seed = model.candidates.candidate(0)!;
    const before = coordinator.resolve({ ...hover, model, seed, layoutEpoch: 1 });
    expect(before?.snapshot.focus.sourceKeys).toContain("a0");

    prefix = "b";
    identity = {};
    const after = coordinator.resolve({ ...hover, model, seed, layoutEpoch: 2 });
    expect(after?.snapshot.focus.sourceKeys).toContain("b0");
    expect(after?.snapshot.focus.sourceKeys).not.toContain("a0");
    model.dispose();
  });

  it("reads new keys for a new model and after invalidate", () => {
    const first = smoothModel(40);
    const second = smoothModel(60);
    let keyReads = 0;
    const coordinator = createInspectionCoordinator<Record<string, never>, string>((index) => {
      keyReads++;
      return `k${index}`;
    });
    const resolve = (model: typeof first.model, layoutEpoch: number) =>
      coordinator.resolve({
        ...hover,
        model,
        seed: model.candidates.candidate(0)!,
        layoutEpoch,
      })?.snapshot.focus.sourceKeys;
    expect(resolve(first.model, 1)).toHaveLength(40);
    expect(resolve(second.model, 2)).toHaveLength(60);

    coordinator.invalidate();
    keyReads = 0;
    expect(resolve(second.model, 3)).toHaveLength(60);
    expect(keyReads).toBeGreaterThanOrEqual(60);
    first.model.dispose();
    second.model.dispose();
  });
});

describe("lineage identity across models", () => {
  it("treats equal rows in a rebuilt model as the same mark", () => {
    const first = barModel(["a", "a", "b", "b"]);
    const rebuilt = barModel(["a", "a", "b", "b"]);
    const coordinator = createInspectionCoordinator<Record<string, never>, string>(() => null);
    const inspect = (model: typeof first, layoutEpoch: number) =>
      coordinator.resolve({
        ...hover,
        mode: "exact",
        model,
        seed: model.candidates.candidate(0)!,
        layoutEpoch,
      });
    expect(inspect(first, 1)?.semanticChanged).toBe(true);
    expect(inspect(rebuilt, 2)?.semanticChanged).toBe(false);
    first.dispose();
    rebuilt.dispose();
  });

  it("treats a mark with the same height from other rows as a new mark", () => {
    const first = barModel(["a", "a", "b", "b"]);
    const other = barModel(["a", "b", "a", "b"]);
    const coordinator = createInspectionCoordinator<Record<string, never>, string>(() => null);
    const inspect = (model: typeof first, layoutEpoch: number) =>
      coordinator.resolve({
        ...hover,
        mode: "exact",
        model,
        seed: model.candidates.candidate(0)!,
        layoutEpoch,
      });
    expect(inspect(first, 1)?.semanticChanged).toBe(true);
    expect(inspect(other, 2)?.semanticChanged).toBe(true);
    first.dispose();
    other.dispose();
  });

  it("treats a mark that differs only in its last row as a new mark", () => {
    const first = barModel(["a", "a", "a", "b"]);
    const other = barModel(["a", "a", "b", "a"]);
    const coordinator = createInspectionCoordinator<Record<string, never>, string>(() => null);
    const inspect = (model: typeof first, layoutEpoch: number) =>
      coordinator.resolve({
        ...hover,
        mode: "exact",
        model,
        seed: model.candidates.candidate(0)!,
        layoutEpoch,
      });
    expect(inspect(first, 1)?.semanticChanged).toBe(true);
    expect(inspect(other, 2)?.semanticChanged).toBe(true);
    first.dispose();
    other.dispose();
  });

  it("keeps a keyless pin only when the rows behind the mark are equal", () => {
    const first = barModel(["a", "a", "b", "b"]);
    const equal = barModel(["a", "a", "b", "b"]);
    const other = barModel(["a", "b", "a", "b"]);
    const coordinator = createInspectionCoordinator<Record<string, never>, string>(() => null);
    coordinator.resolve({
      ...hover,
      mode: "exact",
      state: "pinned",
      model: first,
      seed: first.candidates.candidate(0)!,
      identityEpoch: "same",
      layoutEpoch: 1,
    });
    const reconcile = (model: typeof first, layoutEpoch: number) =>
      coordinator.reconcilePinned({ model, identityEpoch: "same", layoutEpoch });
    expect(reconcile(equal, 2)).not.toBeNull();
    expect(reconcile(other, 3)).toBeNull();
    first.dispose();
    equal.dispose();
    other.dispose();
  });

  it("reads the rows of a stat line once for its identity as the pointer moves", () => {
    const rowCount = 200;
    const { model } = smoothModel(rowCount);
    const lineageKeys = model.lineage.keys.bind(model.lineage);
    const counted = new Map<number, readonly number[]>();
    let rowReads = 0;
    vi.spyOn(model.lineage, "keys").mockImplementation((lineage) => {
      let rows = counted.get(lineage);
      if (rows === undefined) {
        rows = new Proxy(lineageKeys(lineage), {
          get(target, property, receiver) {
            if (typeof property === "string" && /^\d+$/.test(property)) rowReads++;
            return Reflect.get(target, property, receiver) as unknown;
          },
        });
        counted.set(lineage, rows);
      }
      return rows;
    });
    const coordinator = createInspectionCoordinator<Record<string, never>, string>(() => null);
    const hovers = 20;
    for (let step = 0; step < hovers; step++) {
      const id = Math.floor((step / hovers) * model.candidates.size);
      coordinator.resolve({
        ...hover,
        model,
        seed: model.candidates.candidate(id)!,
        layoutEpoch: 1,
      });
    }
    // One walk for the identity and one for the source keys.
    expect(rowReads).toBeLessThan(rowCount * 3);
    model.dispose();
  });
});
