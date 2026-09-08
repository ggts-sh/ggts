import "../setup-register-all.js";
import { describe, expect, it } from "vitest";

import { runPipeline } from "@ggts-sh/core";

import {
  collapseIdenticalDisplayMembers,
  selectHoverDisplayMembers,
} from "../../src/lib/inspection/display-members.js";
import { TRANSIENT_MEMBER_LIMIT, resolveInspection } from "../../src/lib/inspection/resolver.js";

import { field, member } from "./display-members-fixtures.js";

describe("selectHoverDisplayMembers (#1274)", () => {
  it("preserves order when the list fits the hover limit", () => {
    const members = Array.from({ length: 4 }, (_, i) =>
      member({
        layerIndex: 0,
        key: `s${i}`,
        fields: [field("y", "y", i + 1)],
      }),
    );
    const focus = members[0];
    if (focus === undefined) throw new Error("expected members[0]");
    const selected = selectHoverDisplayMembers(members, focus, {
      mode: "x",
      limit: TRANSIENT_MEMBER_LIMIT,
    });
    expect(selected).toEqual(members);
  });

  it("keeps focus and the largest |y| slots when over the limit", () => {
    const members = Array.from({ length: 12 }, (_, i) =>
      member({
        layerIndex: 0,
        key: `s${i}`,
        fields: [field("y", "y", i + 1)],
      }),
    );
    const focus = members[0];
    if (focus === undefined) throw new Error("expected members[0]");
    const selected = selectHoverDisplayMembers(members, focus, {
      mode: "x",
      limit: TRANSIENT_MEMBER_LIMIT,
    });
    expect(selected).toHaveLength(TRANSIENT_MEMBER_LIMIT);
    expect(selected[0]).toBe(focus);
    // Prefer .sort over .toSorted: this package's TS lib target does not
    // declare Array#toSorted (oxlint type-aware treats it as error).
    const nonFocusY = selected.slice(1).map((m) => Number(m.fields[0]?.value));
    nonFocusY.sort((a, b) => b - a);
    expect(nonFocusY).toEqual([12, 11, 10, 9, 8, 7, 6]);
  });
});

describe("line + point pipeline fixture (#385)", () => {
  it("keeps multi-layer public members but collapses identical default display payloads", () => {
    const rows = [
      { period: "1980", value: 10 },
      { period: "1985", value: 511 },
      { period: "1990", value: 520 },
    ];
    const model = runPipeline(
      {
        data: { values: rows },
        layers: [
          {
            geom: "line",
            aes: {
              x: { field: "period" },
              y: { field: "value" },
              group: { value: "__all__" },
            },
          },
          { geom: "point", aes: { x: { field: "period" }, y: { field: "value" } } },
        ],
      },
      { width: 400, height: 300 },
    );

    let seed = model.candidates.candidate(0)!;
    for (let id = 0; id < model.candidates.size; id++) {
      const candidate = model.candidates.candidate(id);
      if (candidate === null || candidate.rowIndex === null) continue;
      const row = model.row(candidate.rowIndex);
      if (row !== null && row["period"] === "1985") {
        seed = candidate;
        break;
      }
    }

    const inspection = resolveInspection({
      model,
      seed,
      mode: "x",
      state: "transient",
      source: "pointer",
      keyOf: (_row, index) => index,
    });

    // Public snapshot still enumerates both painted marks (oninspect / custom content).
    expect(inspection.members.length).toBeGreaterThanOrEqual(2);
    expect(new Set(inspection.members.map((m) => m.layerIndex)).size).toBeGreaterThanOrEqual(2);

    // Default tooltip / live-text presentation collapses identical field blocks.
    const display = collapseIdenticalDisplayMembers(inspection.members, inspection.focus);
    expect(display).toHaveLength(1);
    const shown = display[0];
    expect(shown.fields.map((f) => f.field)).toEqual(["period", "value"]);
    expect(shown.fields.map((f) => f.value)).toEqual(["1985", 511]);

    model.dispose();
  });
});
