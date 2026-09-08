/**
 * Gate G1 — the reversed temporal y-axis. The one surface the whole design
 * rests on, so it is asserted against a real render (earlier dates must sit
 * ABOVE later ones), not against the spec that requested it.
 */
import { runPipeline } from "@ggts-sh/core";
import { describe, expect, it } from "bun:test";

import { foldSakura } from "../quickstart.ts";
import { makeRows } from "./test-helpers.ts";

const rows = makeRows();

describe("gate G1 — the reversed temporal y-axis", () => {
  // After the merged theme/median/y-tick step (count 1), y has Apr day breaks.
  const reversed = foldSakura(1, rows);

  it("formats bloom days as dates, not numbers", () => {
    const ticks = yTicks(reversed.spec);
    expect(ticks.map((tick) => tick.label)).toEqual(["Apr 5", "Apr 15", "Apr 25"]);
  });

  it("puts earlier bloom above later bloom", () => {
    const ticks = yTicks(reversed.spec);
    // SVG y grows downward: earlier date => smaller y => higher on screen.
    expect(ticks[0]!.label).toBe("Apr 5");
    expect(ticks[2]!.label).toBe("Apr 25");
    expect(ticks[0]!.pos).toBeLessThan(ticks[2]!.pos);
    for (let i = 1; i < ticks.length; i += 1) {
      expect(ticks[i]!.pos).toBeGreaterThan(ticks[i - 1]!.pos);
    }
  });

  it("is the reversal doing the work, not the calendar", () => {
    const spec = structuredClone(reversed.spec) as { scales: { y: { reverse?: boolean } } };
    delete spec.scales.y.reverse;
    const ticks = yTicks(spec);
    expect(ticks[0]!.label).toBe("Apr 5");
    expect(ticks[2]!.label).toBe("Apr 25");
    expect(ticks[0]!.pos).toBeGreaterThan(ticks[2]!.pos);
  });
});

/** Tick labels of one axis, top-to-bottom in screen order. */
function yTicks(spec: unknown): { label: string; pos: number }[] {
  const model = runPipeline(spec as never, { width: 900, height: 480 });
  // SceneTick[] | null — a panel renders no y-axis when placement says so. G1
  // (earlier dates sit above later ones) is asserted against these ticks, so a
  // missing axis has to say that, not die inside .map on null.
  const axisY = model.scene.panels[0]?.axisY;
  if (axisY === undefined || axisY === null) {
    throw new Error("expected the first panel to render a y-axis");
  }
  return axisY.map((tick) => ({
    label: tick.label,
    pos: tick.pos,
  }));
}
