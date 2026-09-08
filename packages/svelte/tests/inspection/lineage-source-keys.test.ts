import "../setup-register-all.js";
/**
 * Lineage source keys resolve by row index, not by materializing every source
 * row. `model.row` copies every column on each call, and the production key
 * resolver only ever needs the index, so those objects were pure garbage.
 */
import { describe, expect, it, vi } from "vitest";

import { runPipeline } from "@ggts-sh/core";
import { aes, gg } from "@ggts-sh/spec";

import {
  materializeInspection,
  resolveInspection,
  resolvedTarget,
} from "../../src/lib/inspection/resolver.js";

/** A smooth layer: one mark's lineage covers every row in the group. */
function smoothModel(rowCount: number) {
  const data = Array.from({ length: rowCount }, (_, i) => ({
    id: `r${i}`,
    x: i,
    y: (i * 7) % 11,
  }));
  return runPipeline(
    gg(data, aes({ x: "x", y: "y" }))
      .geomSmooth({ method: "lm", se: false })
      .spec(),
    { width: 480, height: 320 },
  );
}

/** Index-keyed resolver, the shape production wires in. */
function keyByIndex(model: ReturnType<typeof runPipeline>) {
  return (index: number): string | null => {
    const row = model.row(index);
    return row === null ? null : (row["id"] as string);
  };
}

describe("lineage source keys", () => {
  it("does not materialize a row per lineage entry", () => {
    const model = smoothModel(60);
    const seed = model.candidates.candidate(0)!;
    const target = resolvedTarget(model, seed, "x")!;
    // Build the key bag up front so the resolver itself does no row work; this
    // mirrors production, where keys come from a prebuilt index-keyed map.
    const keys = new Map<number, string>();
    for (let i = 0; i < 60; i++) {
      const row = model.row(i);
      if (row !== null) keys.set(i, row["id"] as string);
    }
    const spy = vi.spyOn(model, "row");
    const snapshot = materializeInspection(
      { model, seed, mode: "x", state: "transient", source: "pointer" },
      target,
      "complete",
      (index) => keys.get(index) ?? null,
    );
    // Smooth marks are synthetic evaluation-grid vertices with no source row,
    // so datum reads no row for them at all. What matters is that the lineage
    // walk adds nothing: it covers far more rows than the member count.
    const members = snapshot.members.length;
    expect(snapshot.focus.sourceKeys.length).toBeGreaterThan(members);
    // Exactly zero, not a slack bound: these members have no source row, so any
    // row read at all would mean the lineage walk is materializing again.
    expect(spy.mock.calls.length).toBe(0);
    spy.mockRestore();
    model.dispose();
  });

  it("keeps source key values and first-seen order", () => {
    const model = smoothModel(12);
    const seed = model.candidates.candidate(0)!;
    const target = resolvedTarget(model, seed, "x")!;
    const keyAt = keyByIndex(model);
    const snapshot = materializeInspection(
      { model, seed, mode: "x", state: "transient", source: "pointer" },
      target,
      "complete",
      keyAt,
    );
    // Walk the focus candidate's lineage directly and dedupe first-seen; the
    // snapshot must match that list exactly, values and order.
    const focusCandidate = model.candidates.candidate(target.group?.focusId ?? seed.id) ?? seed;
    const seen = new Set<string>();
    const expected: string[] = [];
    for (const index of model.lineage.keys(focusCandidate.lineage)) {
      const key = keyAt(index);
      if (key !== null && !seen.has(key)) {
        seen.add(key);
        expected.push(key);
      }
    }
    expect(expected.length).toBeGreaterThan(1);
    expect([...snapshot.focus.sourceKeys]).toEqual(expected);
    model.dispose();
  });

  it("skips indexes whose key is null rather than emitting them", () => {
    const model = smoothModel(10);
    const seed = model.candidates.candidate(0)!;
    const target = resolvedTarget(model, seed, "x")!;
    // Only even indexes carry a key; odd ones resolve to null and must vanish.
    const snapshot = materializeInspection(
      { model, seed, mode: "x", state: "transient", source: "pointer" },
      target,
      "complete",
      (index) => (index % 2 === 0 ? `k${index}` : null),
    );
    const keysOut = [...snapshot.focus.sourceKeys] as string[];
    expect(keysOut.length).toBeGreaterThan(0);
    expect(keysOut.every((k) => k.startsWith("k"))).toBe(true);
    expect(keysOut.includes("null")).toBe(false);
    model.dispose();
  });

  it("resolveInspection still reads rows for its row-shaped keyOf", () => {
    // The legacy entry point keeps its contract: a keyOf that needs the row
    // gets one, and a row that does not resolve yields no key.
    const model = smoothModel(8);
    const seed = model.candidates.candidate(0)!;
    const inspection = resolveInspection({
      model,
      seed,
      mode: "x",
      state: "transient",
      source: "pointer",
      keyOf: (row) => row["id"] as string,
    });
    expect(inspection.focus.sourceKeys.length).toBeGreaterThan(0);
    expect((inspection.focus.sourceKeys as string[]).every((k) => k.startsWith("r"))).toBe(true);
    model.dispose();
  });

  it("reads a row-backed member's own row once, not twice", () => {
    // geom_point members are real source rows, so datum must read each one for
    // PlotDatum.row -- and only once. The legacy adapter reads a row to answer
    // by key, which without care doubles that.
    const data = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, x: 1, y: i }));
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y" }))
        .geomPoint()
        .spec(),
      { width: 480, height: 320 },
    );
    const seed = model.candidates.candidate(0)!;
    const target = resolvedTarget(model, seed, "x")!;
    const withRows = target.members.filter((m) => m.rowIndex !== null).length;

    const spy = vi.spyOn(model, "row");
    resolveInspection({
      model,
      seed,
      mode: "x",
      state: "transient",
      source: "pointer",
      keyOf: (row) => row["id"] as string,
    });
    // Each member's own row plus the lineage walk, which for identity marks is
    // one row per member. Reading a member's row twice breaks this.
    expect(withRows).toBeGreaterThan(0);
    // Each datum reads its member's own row for PlotDatum.row, and the adapter
    // answers the key from that same row rather than copying it again. Dropping
    // the adapter's one-slot memo doubles this to 6.
    expect(spy.mock.calls.length).toBe(3);
    spy.mockRestore();
    model.dispose();
  });

  it("gives a member no key when its row does not resolve", () => {
    // The resolver hands back a key for every index; the row gate is the only
    // thing stopping a dead row from carrying one. sourceKeys deliberately
    // still take the resolver's word, so the asymmetry is visible here.
    const model = smoothModel(6);
    const seed = model.candidates.candidate(0)!;
    const target = resolvedTarget(model, seed, "x")!;
    vi.spyOn(model, "row").mockReturnValue(null);
    const snapshot = materializeInspection(
      { model, seed, mode: "x", state: "transient", source: "pointer" },
      target,
      "complete",
      () => "ghost",
    );
    expect(snapshot.focus.key).toBeNull();
    expect(snapshot.focus.row).toBeNull();
    expect([...snapshot.focus.sourceKeys]).toEqual(["ghost"]);
    vi.restoreAllMocks();
    model.dispose();
  });
});
