/**
 * Single field-evidence pass for validate()/dataChecks (no double plot pivot).
 * Production: validate.ts + validate-data-checks.ts + validate-data-evidence.ts.
 */
import { afterEach, describe, expect, it, spyOn } from "bun:test";

import * as evidence from "../src/validate-data-evidence.ts";
import { dataChecks, DEFAULT_VALIDATE_LIMITS } from "../src/validate-data.ts";
import { validate } from "../src/validate.ts";

describe("tier 2 — single field-evidence pass", () => {
  const spies: Array<{ mockRestore: () => void }> = [];
  afterEach(() => {
    while (spies.length > 0) spies.pop()!.mockRestore();
  });

  it("validate resolves layer evidence once and never re-runs plot-only resolve", () => {
    const layerSpy = spyOn(evidence, "resolveLayerFieldEvidence");
    const fieldSpy = spyOn(evidence, "resolveFieldEvidence");
    spies.push(layerSpy, fieldSpy);

    const n = 500;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = Array.from({ length: n }, (_, i) => i * 2);
    const result = validate(
      {
        data: { columns: { x, y } },
        layers: [{ geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } }],
      },
      { lint: true },
    );

    expect(result.ok).toBe(true);
    expect(layerSpy).toHaveBeenCalledTimes(1);
    expect(fieldSpy).toHaveBeenCalledTimes(0);
  });

  it("dataChecks with pre-resolved layer evidence does not call resolvers", () => {
    const pre = evidence.resolveLayerFieldEvidence(
      {
        data: { columns: { x: [1, 2], y: [3, 4] } },
        layers: [{ geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } }],
      },
      {},
      DEFAULT_VALIDATE_LIMITS,
    );
    expect(pre.status).toBe("ok");

    const layerSpy = spyOn(evidence, "resolveLayerFieldEvidence").mockImplementation(() => {
      throw new Error("dataChecks must not re-resolve when preResolvedLayer is provided");
    });
    const fieldSpy = spyOn(evidence, "resolveFieldEvidence").mockImplementation(() => {
      throw new Error("dataChecks must not call plot-only resolveFieldEvidence");
    });
    spies.push(layerSpy, fieldSpy);

    const errors = dataChecks(
      {
        data: { columns: { x: [1, 2], y: [3, 4] } },
        layers: [{ geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } }],
      },
      {},
      DEFAULT_VALIDATE_LIMITS,
      pre,
    );
    expect(errors).toEqual([]);
  });

  it("aggregate maxRows failure skips data-backed lint advisories", () => {
    // Plot alone is under the limit; plot + distinct layer table exceeds it.
    // Shared layer evidence is status "errors", so lint must not get plot values.
    const plotX = Array.from({ length: 3 }, (_, i) => i);
    const plotY = Array.from({ length: 3 }, (_, i) => i);
    const layerX = Array.from({ length: 3 }, (_, i) => i + 10);
    const layerY = Array.from({ length: 3 }, (_, i) => -(i + 1)); // negatives for stacked-area

    const result = validate(
      {
        data: { columns: { x: plotX, y: plotY } },
        labs: { title: "Aggregate limit", x: "x", y: "y" },
        layers: [
          {
            geom: "area",
            position: "stack",
            data: { columns: { x: layerX, y: layerY } },
            aes: { x: { field: "x" }, y: { field: "y" } },
          },
        ],
      },
      { lint: true, limits: { maxRows: 5 } },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === "validation-limit")).toBe(true);
    // Without shared evidence, stacked-area-negative cannot fire on layer y.
    expect(result.advisories ?? []).toEqual([]);
  });

  it("layer-only inline data keeps plot-scoped lint without layer values", () => {
    const result = validate(
      {
        labs: { title: "Layer-only data", x: "x", y: "y" },
        layers: [
          {
            geom: "area",
            position: "stack",
            data: {
              columns: {
                x: [1, 2, 3],
                y: [1, -2, 3],
              },
            },
            aes: { x: { field: "x" }, y: { field: "y" } },
          },
        ],
      },
      { lint: true },
    );
    // Layer-only data: plot evidence is null, so lint has no values for the
    // layer field (plot-scoped shared map). This matches prior plot-only lint
    // handoff; dataChecks still sees per-layer evidence for tier-2 errors.
    expect(result.ok).toBe(true);
    expect(result.advisories ?? []).toEqual([]);
  });

  it("plot-level under-limit data still shares evidence with lint", () => {
    const result = validate(
      {
        data: {
          columns: {
            x: [1, 2, 3],
            y: [1, -2, 3],
            cat: ["a", "b", "c"],
          },
        },
        layers: [
          {
            geom: "area",
            position: "stack",
            aes: { x: { field: "x" }, y: { field: "y" } },
          },
        ],
      },
      { lint: true },
    );
    expect(result.ok).toBe(true);
    expect(result.advisories?.some((a) => a.code === "stacked-area-negative")).toBe(true);
  });

  it("resolves a shared named dataset once, not once per layer", () => {
    // columnsFromDataRef pivots {values} rows into columns, so counting row
    // reads shows directly whether the pivot repeats per layer.
    const rows = Array.from({ length: 40 }, (_, i) => ({ x: i, y: i * 2 }));
    let reads = 0;
    const counted = new Proxy(rows, {
      get(target, prop) {
        if (typeof prop === "string" && /^\d+$/.test(prop)) reads += 1;
        return Reflect.get(target, prop) as unknown;
      },
    });
    const layers = Array.from({ length: 6 }, () => ({
      geom: "point",
      data: { name: "shared" },
      aes: { x: { field: "x" }, y: { field: "y" } },
    }));
    const resolved = evidence.resolveLayerFieldEvidence(
      { datasets: { shared: { values: counted } }, layers },
      {},
      DEFAULT_VALIDATE_LIMITS,
    );
    expect(resolved.status).toBe("ok");
    // One pivot of 40 rows x 2 columns costs 120 reads (40 for key discovery,
    // 40 per column). Six layers repeating it cost 720.
    expect(reads).toBeGreaterThan(0);
    expect(reads).toBeLessThan(240);
  });

  it("infers a shared named dataset's types once, not once per layer", () => {
    // A {columns} ref skips the pivot, so this counts the second stage: type
    // inference walks the column arrays themselves.
    const x = Array.from({ length: 40 }, (_, i) => i);
    let reads = 0;
    const counted = new Proxy(x, {
      get(target, prop) {
        if (typeof prop === "string" && /^\d+$/.test(prop)) reads += 1;
        return Reflect.get(target, prop) as unknown;
      },
    });
    const layers = Array.from({ length: 6 }, () => ({
      geom: "point",
      data: { name: "shared" },
      aes: { x: { field: "x" } },
    }));
    const resolved = evidence.resolveLayerFieldEvidence(
      { datasets: { shared: { columns: { x: counted } } }, layers },
      {},
      DEFAULT_VALIDATE_LIMITS,
    );
    expect(resolved.status).toBe("ok");
    expect(reads).toBeGreaterThan(0);
    // Six layers each inferring the column cost 1040 reads before; one pass
    // costs far less. The bound fails on the first repeat.
    expect(reads).toBeLessThan(400);
  });

  it("shares the plot's table with a layer that names it", () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ x: i }));
    let reads = 0;
    const counted = new Proxy(rows, {
      get(target, prop) {
        if (typeof prop === "string" && /^\d+$/.test(prop)) reads += 1;
        return Reflect.get(target, prop) as unknown;
      },
    });
    const resolved = evidence.resolveLayerFieldEvidence(
      {
        data: { name: "shared" },
        datasets: { shared: { values: counted } },
        layers: [
          { geom: "point", data: { name: "shared" }, aes: { x: { field: "x" } } },
          { geom: "line", data: { name: "shared" }, aes: { x: { field: "x" } } },
        ],
      },
      {},
      DEFAULT_VALIDATE_LIMITS,
    );
    expect(resolved.status).toBe("ok");
    if (resolved.status !== "ok") return;
    // The plot pivots once; naming the same dataset must not pivot again.
    expect(reads).toBeLessThan(2 * 40 * 2);
    expect(resolved.layers[0]).toBe(resolved.plot);
    expect(resolved.layers[1]).toBe(resolved.plot);
  });

  it("gives layers naming one dataset the same evidence content", () => {
    const spec = {
      datasets: {
        shared: {
          values: [
            { x: 1, y: 2 },
            { x: 3, y: 4 },
          ],
        },
      },
      layers: [
        { geom: "point", data: { name: "shared" }, aes: { x: { field: "x" }, y: { field: "y" } } },
        { geom: "line", data: { name: "shared" }, aes: { x: { field: "x" }, y: { field: "y" } } },
      ],
    };
    const resolved = evidence.resolveLayerFieldEvidence(spec, {}, DEFAULT_VALIDATE_LIMITS);
    expect(resolved.status).toBe("ok");
    if (resolved.status !== "ok") return;
    const [first, second] = resolved.layers;
    expect(first).not.toBeNull();
    expect([...first!.keys()].toSorted()).toEqual(["x", "y"]);
    expect([...second!.keys()].toSorted()).toEqual(["x", "y"]);
    expect(first!.get("x")!.type).toBe(second!.get("x")!.type);
    expect([...first!.get("x")!.values]).toEqual([...second!.get("x")!.values]);
  });

  it("keeps distinct inline layer datasets independent", () => {
    const resolved = evidence.resolveLayerFieldEvidence(
      {
        layers: [
          { geom: "point", data: { columns: { x: [1, 2] } }, aes: { x: { field: "x" } } },
          { geom: "point", data: { columns: { x: ["a", "b"] } }, aes: { x: { field: "x" } } },
        ],
      },
      {},
      DEFAULT_VALIDATE_LIMITS,
    );
    expect(resolved.status).toBe("ok");
    if (resolved.status !== "ok") return;
    expect([...resolved.layers[0]!.get("x")!.values]).toEqual([1, 2]);
    expect([...resolved.layers[1]!.get("x")!.values]).toEqual(["a", "b"]);
  });

  it("still counts a shared named dataset once toward the row limit", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ x: i }));
    const layer = () => ({ geom: "point", data: { name: "shared" }, aes: { x: { field: "x" } } });
    const resolved = evidence.resolveLayerFieldEvidence(
      { datasets: { shared: { values: rows } }, layers: [layer(), layer(), layer()] },
      {},
      { ...DEFAULT_VALIDATE_LIMITS, maxRows: 60 },
    );
    // 3 x 30 would breach 60; the name is counted once, so this stays ok.
    expect(resolved.status).toBe("ok");
  });

  it("treats a named ref missing from datasets as runtime for every layer", () => {
    const layer = () => ({ geom: "point", data: { name: "absent" }, aes: { x: { field: "x" } } });
    const resolved = evidence.resolveLayerFieldEvidence(
      { datasets: {}, layers: [layer(), layer()] },
      {},
      DEFAULT_VALIDATE_LIMITS,
    );
    expect(resolved.status).toBe("none");
  });
});
