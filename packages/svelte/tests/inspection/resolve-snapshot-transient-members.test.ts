import { describe, expect, it } from "vitest";

import { registerAll, runPipeline } from "@ggts-sh/core";
import { aes, gg } from "@ggts-sh/spec";

// Temporal spec-driven suite (#1420): no components to self-register, and
// the lane setup skips Temporal deliberately — install the full grammar here.
registerAll();

// Barrel path characterization: production + tests historically import via resolver.js
import {
  materializeInspection,
  resolvedTarget,
  selectTransientMembers,
  TRANSIENT_MEMBER_LIMIT,
} from "../../src/lib/inspection/resolver.js";

describe("selectTransientMembers top-k by value (#1274)", () => {
  it("keeps stack order when the group fits in the hover limit", () => {
    const data = Array.from({ length: 5 }, (_, index) => ({
      id: `s${index}`,
      x: 1,
      y: index + 1,
      series: `s${index}`,
    }));
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y", color: "series" }))
        .geomPoint()
        .spec(),
      { width: 400, height: 300 },
    );
    const seed = model.candidates.candidate(0)!;
    const target = resolvedTarget(model, seed, "x")!;
    const selected = selectTransientMembers(target.members, seed.id, {
      groupAxis: "x",
      limit: TRANSIENT_MEMBER_LIMIT,
    });
    expect(selected.map((c) => c.id)).toEqual(target.members.map((c) => c.id));
    model.dispose();
  });

  it("fills non-focus slots with the largest |y| values and always includes focus", () => {
    // Stacking/group order is small→large (y = index+1). Focus the tiny first
    // series so without top-k the hover window would be the eight smallest.
    const data = Array.from({ length: 20 }, (_, index) => ({
      id: `s${index}`,
      x: 1,
      y: index + 1,
      series: `s${index}`,
    }));
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y", color: "series" }))
        .geomPoint()
        .spec(),
      { width: 400, height: 300 },
    );
    const focus = model.candidates.candidate(0)!; // y = 1
    expect(focus.yValue).toBe(1);
    const target = resolvedTarget(model, focus, "x")!;
    expect(target.members.length).toBe(20);

    const selected = selectTransientMembers(target.members, focus.id, {
      groupAxis: "x",
      limit: TRANSIENT_MEMBER_LIMIT,
    });
    expect(selected).toHaveLength(TRANSIENT_MEMBER_LIMIT);
    expect(selected.some((c) => c.id === focus.id)).toBe(true);
    // Non-focus slots: y = 20..14 (largest seven). Focus (y=1) is force-included.
    // Prefer .sort over .toSorted here: this package's TS lib target does not
    // declare Array#toSorted (oxlint type-aware treats it as error).
    const nonFocusYs = selected.filter((c) => c.id !== focus.id).map((c) => Number(c.yValue));
    nonFocusYs.sort((a, b) => b - a);
    expect(nonFocusYs).toEqual([20, 19, 18, 17, 16, 15, 14]);
    model.dispose();
  });

  it("materializeInspection transient path uses top-k selection, not first-N stack order", () => {
    const data = Array.from({ length: 20 }, (_, index) => ({
      id: `s${index}`,
      x: 1,
      y: index + 1,
      series: `s${index}`,
    }));
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y", color: "series" }))
        .geomPoint()
        .spec(),
      { width: 400, height: 300 },
    );
    const seed = model.candidates.candidate(0)!;
    const target = resolvedTarget(model, seed, "x")!;
    const inspection = materializeInspection(
      {
        model,
        seed,
        mode: "x",
        state: "transient",
        source: "pointer",
      },
      target,
      "transient",
      (index) => (model.row(index) as { id: string } | null)?.id ?? null,
    );
    expect(inspection.members).toHaveLength(TRANSIENT_MEMBER_LIMIT);
    expect(inspection.focus.key).toBe("s0");
    expect(inspection.members.some((m) => m.key === "s0")).toBe(true);
    const nonFocusY = inspection.members
      .filter((m) => m.key !== "s0")
      .map((m) => Number(m.fields.find((f) => f.channel === "y")?.value));
    nonFocusY.sort((a, b) => b - a);
    expect(nonFocusY).toEqual([20, 19, 18, 17, 16, 15, 14]);
    // Parallel multi-series points: no additive position → no Total.
    expect(inspection.mode).toBe("x");
    if (inspection.mode === "x" || inspection.mode === "y") {
      expect(inspection.groupTotal).toBeNull();
      expect(inspection.groupMemberCount).toBe(20);
    }
    model.dispose();
  });

  it("materializeInspection reports stack Total only for stack/fill positions", () => {
    const data = Array.from({ length: 5 }, (_, index) => ({
      id: `s${index}`,
      x: "A",
      y: index + 1,
      series: `s${index}`,
    }));
    const stacked = runPipeline(
      gg(data, aes({ x: "x", y: "y", fill: "series" }))
        .geomCol({ position: "stack" })
        .spec(),
      { width: 400, height: 300 },
    );
    const filled = runPipeline(
      gg(data, aes({ x: "x", y: "y", fill: "series" }))
        .geomCol({ position: "fill" })
        .spec(),
      { width: 400, height: 300 },
    );
    const dodged = runPipeline(
      gg(data, aes({ x: "x", y: "y", fill: "series" }))
        .geomCol({ position: "dodge" })
        .spec(),
      { width: 400, height: 300 },
    );
    const parallel = runPipeline(
      gg(data, aes({ x: "x", y: "y", color: "series" }))
        .geomLine()
        .spec(),
      { width: 400, height: 300 },
    );

    function completeAxisInspection(
      model: ReturnType<typeof runPipeline>,
    ): ReturnType<typeof materializeInspection> {
      const seed = model.candidates.candidate(0)!;
      return materializeInspection(
        {
          model,
          seed,
          mode: "x",
          state: "transient",
          source: "pointer",
        },
        resolvedTarget(model, seed, "x")!,
        "complete",
        (index) => (model.row(index) as { id: string } | null)?.id ?? null,
      );
    }

    const stackedInspection = completeAxisInspection(stacked);
    const filledInspection = completeAxisInspection(filled);
    const dodgedInspection = completeAxisInspection(dodged);
    const parallelInspection = completeAxisInspection(parallel);

    expect(stacked.layerPositions).toEqual(["stack"]);
    expect(filled.layerPositions).toEqual(["fill"]);
    expect(dodged.layerPositions).toEqual(["dodge"]);
    expect(parallel.layerPositions).toEqual(["identity"]);

    expect(stackedInspection.mode).toBe("x");
    if (stackedInspection.mode === "x" || stackedInspection.mode === "y") {
      expect(stackedInspection.groupTotal).toBe(15); // 1+2+3+4+5
      expect(stackedInspection.groupMemberCount).toBe(5);
    }
    expect(filledInspection.mode).toBe("x");
    if (filledInspection.mode === "x" || filledInspection.mode === "y") {
      // Fill inspect y is the post-position share; Total sums those shares.
      expect(filledInspection.groupTotal).toBeCloseTo(1, 8);
      expect(filledInspection.groupMemberCount).toBe(5);
      const fillYs: number[] = [];
      for (const member of filledInspection.members) {
        const yField = member.fields.find((field) => field.channel === "y");
        const value = yField?.value;
        if (typeof value !== "number") {
          throw new TypeError("expected numeric fill inspect y");
        }
        fillYs.push(value);
      }
      fillYs.sort((a, b) => a - b);
      expect(fillYs[0]).toBeCloseTo(1 / 15, 8);
      expect(fillYs[4]).toBeCloseTo(5 / 15, 8);
    }
    expect(dodgedInspection.mode).toBe("x");
    if (dodgedInspection.mode === "x" || dodgedInspection.mode === "y") {
      expect(dodgedInspection.groupTotal).toBeNull();
      expect(dodgedInspection.groupMemberCount).toBe(5);
    }
    expect(parallelInspection.mode).toBe("x");
    if (parallelInspection.mode === "x" || parallelInspection.mode === "y") {
      expect(parallelInspection.groupTotal).toBeNull();
      expect(parallelInspection.groupMemberCount).toBe(5);
    }
    stacked.dispose();
    filled.dispose();
    dodged.dispose();
    parallel.dispose();
  });

  it("exact stacked inspection reports groupTotal without listing the axis group", () => {
    const data = Array.from({ length: 5 }, (_, index) => ({
      id: `s${index}`,
      x: "A",
      y: index + 1,
      series: `s${index}`,
    }));
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y", fill: "series" }))
        .geomCol({ position: "stack" })
        .spec(),
      { width: 400, height: 300 },
    );
    const seed = model.candidates.candidate(0)!;
    const inspection = materializeInspection(
      {
        model,
        seed,
        mode: "exact",
        state: "transient",
        source: "pointer",
      },
      resolvedTarget(model, seed, "exact")!,
      "complete",
      (index) => (model.row(index) as { id: string } | null)?.id ?? null,
    );
    expect(inspection.mode).toBe("exact");
    expect(inspection.members).toHaveLength(1);
    expect(inspection.groupTotal).toBe(15);
    model.dispose();
  });

  it("exact stacked bars still total the category group when the stack is flipped", () => {
    const data = Array.from({ length: 5 }, (_, index) => ({
      id: `s${index}`,
      x: "A",
      y: index + 1,
      series: `s${index}`,
    }));
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y", fill: "series" }))
        .geomCol({ position: "stack" })
        .coordFlip()
        .spec(),
      { width: 400, height: 300 },
    );
    const seed = model.candidates.candidate(0)!;
    const inspection = materializeInspection(
      {
        model,
        seed,
        mode: "exact",
        state: "transient",
        source: "pointer",
      },
      resolvedTarget(model, seed, "exact")!,
      "complete",
      (index) => (model.row(index) as { id: string } | null)?.id ?? null,
    );
    expect(inspection.mode).toBe("exact");
    expect(inspection.members).toHaveLength(1);
    expect(inspection.groupTotal).toBe(15);
    model.dispose();
  });

  it("exact stacked total stays on the hovered category when heights collide", () => {
    const data = [
      { id: "a", x: "A", y: 10, series: "s1" },
      { id: "b", x: "B", y: 10, series: "s1" },
      { id: "c", x: "C", y: 10, series: "s1" },
    ];
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y", fill: "series" }))
        .geomCol({ position: "stack" })
        .spec(),
      { width: 400, height: 300 },
    );
    let seed = model.candidates.candidate(0)!;
    for (let id = 0; id < model.candidates.size; id++) {
      const candidate = model.candidates.candidate(id);
      if (candidate?.xValue === "B") {
        seed = candidate;
        break;
      }
    }

    const inspection = materializeInspection(
      {
        model,
        seed,
        mode: "exact",
        state: "transient",
        source: "pointer",
      },
      resolvedTarget(model, seed, "exact")!,
      "complete",
      (index) => (model.row(index) as { id: string } | null)?.id ?? null,
    );
    expect(inspection.groupTotal).toBe(10);
    model.dispose();
  });
});

describe("groupTotal / groupMemberCount multi-layer honesty (#1389)", () => {
  function axisInspection(
    model: ReturnType<typeof runPipeline>,
    seed: NonNullable<ReturnType<typeof model.candidates.candidate>>,
  ) {
    const target = resolvedTarget(model, seed, "x")!;
    return materializeInspection(
      {
        model,
        seed,
        mode: "x",
        state: "transient",
        source: "pointer",
      },
      target,
      "transient",
      (index) => (model.row(index) as { id: string } | null)?.id ?? null,
    );
  }

  function candidateOnLayer(
    model: ReturnType<typeof runPipeline>,
    layerIndex: number,
  ): NonNullable<ReturnType<typeof model.candidates.candidate>> {
    for (let id = 0; id < model.candidates.size; id++) {
      const candidate = model.candidates.candidate(id);
      if (candidate !== null && candidate.layerIndex === layerIndex) return candidate;
    }
    throw new Error(`no candidate on layer ${layerIndex}`);
  }

  it("does not invent a Total for identity-position multi-series line+point", () => {
    const data = [
      { id: "a1", x: 1, y: 3, series: "a" },
      { id: "b1", x: 1, y: 7, series: "b" },
      { id: "a2", x: 2, y: 4, series: "a" },
      { id: "b2", x: 2, y: 8, series: "b" },
    ];
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y", color: "series" }))
        .geomLine()
        .geomPoint()
        .spec(),
      { width: 400, height: 300 },
    );
    // Parallel series: no stack/fill layer → Total is null; member count
    // still collapses line+point of the same series to one contribution.
    for (const layerIndex of [0, 1]) {
      const seed = candidateOnLayer(model, layerIndex);
      // Prefer an x=1 seed when the first layer candidate is elsewhere.
      let focus = seed;
      for (let id = 0; id < model.candidates.size; id++) {
        const c = model.candidates.candidate(id)!;
        if (c.layerIndex === layerIndex && c.xValue === 1) {
          focus = c;
          break;
        }
      }
      const inspection = axisInspection(model, focus);
      expect(inspection.mode).toBe("x");
      if (inspection.mode === "x" || inspection.mode === "y") {
        expect(inspection.groupTotal).toBeNull();
        expect(inspection.groupMemberCount).toBe(2);
      }
    }
    model.dispose();
  });

  it("includes every distinct multi-layer series when focus is a thin overlay", () => {
    // 12-series stacked columns + one-series trend line. Focus the line:
    // Total and overflow must reflect the full display group (13), not only
    // the overlay layer (1). Stack sum 1..12 = 78; trend y = 50 → 128.
    const stackData = Array.from({ length: 12 }, (_, index) => ({
      id: `s${index}`,
      x: "A",
      y: index + 1,
      series: `s${index}`,
    }));
    const trendData = [{ id: "trend", x: "A", y: 50, series: "trend" }];
    const model = runPipeline(
      gg(stackData, aes({ x: "x", y: "y", fill: "series" }))
        .geomCol({ position: "stack" })
        .geomLine({ data: trendData, aes: { x: "x", y: "y", color: "series" } })
        .spec(),
      { width: 400, height: 300 },
    );
    const trendSeed = candidateOnLayer(model, 1);
    const inspection = axisInspection(model, trendSeed);
    expect(inspection.mode).toBe("x");
    if (inspection.mode === "x" || inspection.mode === "y") {
      expect(inspection.groupTotal).toBe(128);
      expect(inspection.groupMemberCount).toBe(13);
    }
    // Transient cap still applies to listed members; overflow signal uses full count.
    expect(inspection.members.length).toBeLessThanOrEqual(TRANSIENT_MEMBER_LIMIT);
    model.dispose();
  });

  it("includes the overlay series when focus is on the stacked layer", () => {
    const stackData = Array.from({ length: 12 }, (_, index) => ({
      id: `s${index}`,
      x: "A",
      y: index + 1,
      series: `s${index}`,
    }));
    const trendData = [{ id: "trend", x: "A", y: 50, series: "trend" }];
    const model = runPipeline(
      gg(stackData, aes({ x: "x", y: "y", fill: "series" }))
        .geomCol({ position: "stack" })
        .geomLine({ data: trendData, aes: { x: "x", y: "y", color: "series" } })
        .spec(),
      { width: 400, height: 300 },
    );
    const stackSeed = candidateOnLayer(model, 0);
    const inspection = axisInspection(model, stackSeed);
    expect(inspection.mode).toBe("x");
    if (inspection.mode === "x" || inspection.mode === "y") {
      expect(inspection.groupTotal).toBe(128);
      expect(inspection.groupMemberCount).toBe(13);
    }
    model.dispose();
  });

  it("counts both columns when two layers map different y fields on the same rows", () => {
    // sales col + target line share rowIndex but read different y fields.
    // Total must be sales+target (25 at Jan), not only the first layer (10).
    // Equal values (Mar: 12+12) must still count twice — identity is the
    // mapped field, not the numeric coincidence.
    const data = [
      { id: "jan", x: "Jan", sales: 10, target: 15 },
      { id: "feb", x: "Feb", sales: 20, target: 18 },
      { id: "mar", x: "Mar", sales: 12, target: 12 },
    ];
    const model = runPipeline(
      gg(data, aes({ x: "x" }))
        .geomCol({ aes: { y: "sales" } })
        .geomLine({ aes: { y: "target" } })
        .spec(),
      { width: 400, height: 300 },
    );
    const jan = model.candidates.candidate(0)!;
    expect(jan.xValue).toBe("Jan");
    const janInspection = axisInspection(model, jan);
    expect(janInspection.mode).toBe("x");
    if (janInspection.mode === "x" || janInspection.mode === "y") {
      expect(janInspection.groupTotal).toBe(25);
      expect(janInspection.groupMemberCount).toBe(2);
    }

    let marSeed = model.candidates.candidate(0)!;
    for (let id = 0; id < model.candidates.size; id++) {
      const c = model.candidates.candidate(id)!;
      if (c.xValue === "Mar") {
        marSeed = c;
        break;
      }
    }
    const marInspection = axisInspection(model, marSeed);
    expect(marInspection.mode).toBe("x");
    if (marInspection.mode === "x" || marInspection.mode === "y") {
      expect(marInspection.groupTotal).toBe(24);
      expect(marInspection.groupMemberCount).toBe(2);
    }
    model.dispose();
  });
});
