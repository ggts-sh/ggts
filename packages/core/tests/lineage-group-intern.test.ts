/**
 * A stat mark's lineage is the whole group it summarizes. The per-group bucket
 * is built once and frozen, and `LineageStore` interns such an array by identity
 * so a group is tokenized once however many marks point at it.
 *
 * Two things defeated that: the represented-rows fallback handed back a clone,
 * which is not frozen and so never matched the identity cache; and the cache
 * lookup sat behind an `Object.isFrozen` check that walks the array in this
 * engine. Either one alone leaves the work quadratic — marks x group rows.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { LineageStore } from "../src/identity.ts";
import { runPipeline } from "../src/pipeline.ts";

/**
 * Two measurements while `run` builds a candidate store:
 *  - `distinctArrays`: how many *different* arrays are handed to `intern`.
 *    Sharing one frozen bucket across a group's marks makes this 1; cloning
 *    per mark makes it one per mark.
 *  - `frozenCheckElements`: elements walked by `Object.isFrozen` during
 *    construction. That check is linear in this engine, so putting it in front
 *    of the identity cache costs a pass over the group per mark.
 */
function internStats(run: () => ReturnType<typeof runPipeline>): {
  distinctArrays: number;
  frozenCheckElements: number;
  candidates: number;
} {
  // oxlint-disable-next-line typescript/unbound-method -- re-invoked with .call below
  const originalIntern = LineageStore.prototype.intern;
  const originalIsFrozen = Object.isFrozen;
  const arrays = new Set<object>();
  let frozenCheckElements = 0;
  LineageStore.prototype.intern = function counting(this: LineageStore, keys: Iterable<never>) {
    if (Array.isArray(keys)) arrays.add(keys);
    return originalIntern.call(this, keys);
  } as typeof originalIntern;
  Object.isFrozen = function countingIsFrozen(value: unknown) {
    if (Array.isArray(value)) frozenCheckElements += value.length;
    return originalIsFrozen(value);
  } as typeof Object.isFrozen;
  try {
    const model = run();
    // The candidate store is deferred; querying it forces construction.
    const candidates = model.candidates.size;
    for (let id = 0; id < candidates; id++) model.candidates.candidate(id);
    model.dispose();
    return { distinctArrays: arrays.size, frozenCheckElements, candidates };
  } finally {
    LineageStore.prototype.intern = originalIntern;
    Object.isFrozen = originalIsFrozen;
  }
}

function xOnly(n: number) {
  return { x: Array.from({ length: n }, (_, i) => (i * 0.37) % 101) };
}

function xy(n: number) {
  return {
    x: Array.from({ length: n }, (_, i) => (i * 0.37) % 101),
    y: Array.from({ length: n }, (_, i) => (i * 7) % 53),
  };
}

describe("stat lineage interning", () => {
  it("hands every mark of a group the same bucket array", () => {
    // ecdf emits one mark per distinct x and every mark's lineage is the whole
    // single group. Cloning the bucket per mark gave one array per mark.
    const n = 400;
    const { distinctArrays, candidates } = internStats(() =>
      runPipeline(
        gg(xOnly(n), aes({ x: "x" }))
          .geomLine({ stat: "ecdf" } as never)
          .spec(),
        { width: 640, height: 400 },
      ),
    );
    expect(candidates).toBeGreaterThan(n / 2);
    // The group's bucket, plus the handful of singleton arrays interned for
    // marks that do carry a source row. Cloning gave one array per mark — 401
    // here — so the bound only has to sit far below the candidate count.
    expect(distinctArrays).toBeLessThan(10);
  });

  it("does not walk the group to reach the identity cache", () => {
    const n = 400;
    const { frozenCheckElements } = internStats(() =>
      runPipeline(
        gg(xOnly(n), aes({ x: "x" }))
          .geomLine({ stat: "ecdf" } as never)
          .spec(),
        { width: 640, height: 400 },
      ),
    );
    // `Object.isFrozen` is linear in this engine, so asking it once per mark
    // about an n-element bucket is itself the quadratic. It belongs behind the
    // cache lookup, not in front of it.
    expect(frozenCheckElements).toBeLessThan(n * 3);
  });

  it("keeps every candidate's lineage membership unchanged", () => {
    // Sharing the bucket must not change who is in a mark's lineage.
    const model = runPipeline(
      gg(xOnly(60), aes({ x: "x" }))
        .geomLine({ stat: "ecdf" } as never)
        .spec(),
      { width: 640, height: 400 },
    );
    const seen: number[][] = [];
    for (let id = 0; id < model.candidates.size; id++) {
      const candidate = model.candidates.candidate(id);
      if (candidate === null) continue;
      seen.push([...model.lineage.keys(candidate.lineage)].toSorted((a, b) => a - b));
    }
    expect(seen.length).toBeGreaterThan(1);
    // Every ecdf mark summarizes the whole group, so each lineage is all 60 rows.
    for (const keys of seen) {
      expect(keys.length).toBe(60);
      expect(keys.at(0)).toBe(0);
      expect(keys.at(-1)).toBe(59);
    }
    model.dispose();
  });

  it("still clones and narrows when a filter applies", async () => {
    // Reach the changed line the way the finite-y cache tests do: call the
    // filter directly with no index maps, so the fallback arm runs. Through
    // runPipeline a boxplot returns at the indexed group-by-x arm above it and
    // never gets here.
    const { preparePanels } = await import("../src/pipeline/prepare-panels.ts");
    const { filterRepresentedSourceRows } =
      await import("../src/pipeline/candidate-construction/represented-rows.ts");
    const { normalize } = await import("@ggts-sh/spec");

    const prepared = preparePanels(
      normalize({
        data: {
          values: [
            { g: "a", y: 1 },
            { g: "a", y: Number.NaN },
            { g: "a", y: 3 },
            { g: "b", y: 4 },
          ],
        },
        layers: [
          { geom: "pointrange", stat: "summary", aes: { x: { field: "g" }, y: { field: "y" } } },
        ],
      }),
      { width: 640, height: 400 },
      [],
      [],
    );
    const frame = prepared.panelFrames[0]![0]!;
    const baseRows = Object.freeze([0, 1, 2]);
    const narrowed = filterRepresentedSourceRows({
      frame,
      table: prepared.table,
      frameRow: 0,
      baseRows,
    });
    // summary sets the finite-y filter, so row 1 (NaN y) must be dropped and the
    // result must be a new array, not the bucket handed straight back.
    expect([...narrowed]).toEqual([0, 2]);
    expect(narrowed).not.toBe(baseRows);

    // smooth sets the finite-y filter without the x one, so it pins that term
    // of the guard on its own.
    const smoothPrepared = preparePanels(
      normalize({
        data: {
          values: [
            { x: 1, y: 1 },
            { x: 2, y: Number.NaN },
            { x: 3, y: 3 },
          ],
        },
        layers: [{ geom: "line", stat: "smooth", aes: { x: { field: "x" }, y: { field: "y" } } }],
      }),
      { width: 640, height: 400 },
      [],
      [],
    );
    const smoothFrame = smoothPrepared.panelFrames[0]![0]!;
    const smoothBase = Object.freeze([0, 1, 2]);
    const smoothNarrowed = filterRepresentedSourceRows({
      frame: smoothFrame,
      table: smoothPrepared.table,
      frameRow: 0,
      baseRows: smoothBase,
    });
    expect([...smoothNarrowed]).toEqual([0, 2]);
    expect(smoothNarrowed).not.toBe(smoothBase);
  });

  it("leaves identity geoms at one source row per mark", () => {
    const model = runPipeline(
      gg(xy(30), aes({ x: "x", y: "y" }))
        .geomPoint()
        .spec(),
      { width: 640, height: 400 },
    );
    let checked = 0;
    for (let id = 0; id < model.candidates.size; id++) {
      const candidate = model.candidates.candidate(id);
      if (candidate === null) continue;
      expect(model.lineage.count(candidate.lineage)).toBe(1);
      checked += 1;
    }
    expect(checked).toBe(30);
    model.dispose();
  });
});

describe("LineageStore identity cache", () => {
  it("does not cache an array it cannot trust to stay put", async () => {
    // The identity cache is consulted before `Object.isFrozen`, which is only
    // sound because nothing stores an unfrozen array. Drop that guard and a
    // caller could mutate an array after interning it and get the stale ref
    // back — so pin it here rather than leaving it to a comment.
    const { LineageStore: Store } = await import("../src/identity.ts");
    const store = new Store<number>();
    const mutable = [1, 2];
    const first = store.intern(mutable);
    mutable.push(3);
    const second = store.intern(mutable);
    expect(second).not.toBe(first);
    expect([...store.keys(second)].toSorted((a, b) => a - b)).toEqual([1, 2, 3]);

    // A frozen array is safe to cache, and interning it twice is one entry.
    const frozen = Object.freeze([7, 8]);
    expect(store.intern(frozen)).toBe(store.intern(frozen));
  });
});
