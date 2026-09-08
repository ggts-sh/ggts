import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";

import { trainBand, type AxisEditModel, type CellValue } from "@ggts-sh/core";

import {
  boundsEditorInputForScale,
  semanticAxisFromBounds,
} from "../../src/lib/interval/precise-bounds.js";
import {
  consumeIntervalKeys,
  recomputePanelIntervalProjection,
} from "../../src/lib/interval/consumption.js";

function continuousEdit(
  type: "linear" | "time",
  transform: "identity" | "log10" | "sqrt",
  domain: readonly [number, number] = [1, 100],
): AxisEditModel {
  return { kind: "continuous", type, transform, domain, reversed: false };
}

function bandEdit(rawDomain: readonly CellValue[]): AxisEditModel {
  return fromPartial<AxisEditModel>({
    kind: "band",
    rawDomain,
    reversed: false,
  });
}

describe("precise plot bounds adapters", () => {
  it.each([
    { type: "linear", transform: "identity" },
    { type: "linear", transform: "log10" },
    { type: "linear", transform: "sqrt" },
    { type: "time", transform: "identity" },
  ] as const)(
    "builds ascending $type/$transform inputs while preserving reversed presentation",
    ({ type, transform }) => {
      const input = boundsEditorInputForScale({
        axis: "x",
        action: "select",
        scale: continuousEdit(type, transform),
        bounds: [90, 10],
        reversed: true,
      });
      expect(input).toMatchObject({
        axis: "x",
        action: "select",
        scale: type,
        ...(type === "linear" && { transform }),
        bounds: [10, 90],
        reversed: true,
      });
    },
  );

  it("forwards temporalKind on time scales so monthDay drafts can omit the year", () => {
    const input = boundsEditorInputForScale({
      axis: "y",
      action: "zoom",
      scale: continuousEdit("time", "identity", [Date.UTC(2000, 3, 1), Date.UTC(2000, 4, 10)]),
      temporalKind: "monthDay",
    });
    expect(input).toMatchObject({
      scale: "time",
      temporalKind: "monthDay",
      bounds: [Date.UTC(2000, 3, 1), Date.UTC(2000, 4, 10)],
    });
  });

  it("builds inclusive categorical inputs from band domains", () => {
    const input = boundsEditorInputForScale({
      axis: "y",
      action: "select",
      scale: fromPartial<AxisEditModel>({
        kind: "band",
        rawDomain: ["north", "south"],
        reversed: false,
      }),
    });
    expect(input).toMatchObject({
      scale: "band",
      bounds: ["north", "south"],
      categories: [
        { value: "north", label: "north" },
        { value: "south", label: "south" },
      ],
    });
  });

  it("returns null for band bounds missing from the current scale", () => {
    const scale = bandEdit(trainBand([["north", "south"]]).rawDomain as readonly CellValue[]);
    // A stored endpoint whose category disappeared (data update, linked plot
    // with a different catalog) must not silently map to the first option.
    expect(
      boundsEditorInputForScale({
        axis: "x",
        action: "select",
        scale,
        bounds: ["east", "south"],
      }),
    ).toBeNull();
    expect(
      boundsEditorInputForScale({
        axis: "x",
        action: "select",
        scale,
        bounds: ["north", "@n:1"],
      }),
    ).toBeNull();
  });

  it("round-trips typed band categories through precise and cross-panel selection", () => {
    const date = new Date("2025-01-02T00:00:00.000Z");
    const scale = bandEdit(
      trainBand([[1, "1", true, false, null, date]]).rawDomain as readonly CellValue[],
    );
    const input = boundsEditorInputForScale({
      axis: "x",
      action: "select",
      scale,
    });

    expect(input).toMatchObject({
      scale: "band",
      bounds: [1, date],
      // Colliding presentation labels carry a typed qualifier so the two
      // <select> options stay distinguishable (same rule as the legend).
      categories: [
        { value: 1, label: "1 (number)" },
        { value: "1", label: "1 (text)" },
        { value: true, label: "true" },
        { value: false, label: "false" },
        { value: null, label: "(null)" },
        { value: date, label: date.toISOString() },
      ],
    });
    expect(
      boundsEditorInputForScale({
        axis: "x",
        action: "select",
        scale,
        bounds: ["@n:1", "1"],
      }),
    ).toMatchObject({ bounds: [1, "1"] });
    expect(
      boundsEditorInputForScale({
        axis: "x",
        action: "select",
        scale,
        bounds: ["@null", `@d:${String(date.getTime())}`],
      }),
    ).toMatchObject({ bounds: [null, date] });
    if (input?.scale !== "band") throw new Error("expected band bounds");

    const numericAxis = semanticAxisFromBounds("band", "identity", [
      input.categories[0].value,
      input.categories[0].value,
    ]);
    const candidates = [
      { panelId: "north", xValue: 1, keys: ["number"] },
      { panelId: "north", xValue: "1", keys: ["string"] },
      { panelId: "south", xValue: 1, keys: ["south-number"] },
      { panelId: "south", xValue: "1", keys: ["south-string"] },
    ];

    expect(
      recomputePanelIntervalProjection({
        panelId: "north",
        domains: { x: numericAxis },
        candidates,
      }).keys,
    ).toEqual(["number"]);
    expect(
      consumeIntervalKeys({
        records: [
          {
            panelId: "north",
            preset: "cross-panel",
            domains: { x: numericAxis },
            keys: ["number"],
          },
        ],
        panels: [{ id: "north" }, { id: "south" }],
        candidates,
      }),
    ).toEqual(["number", "south-number"]);
  });

  it("converts applied values into controller semantic axis domains", () => {
    expect(semanticAxisFromBounds("linear", "log10", [100, 1])).toEqual({
      kind: "linear",
      transform: "log10",
      domain: [1, 100],
    });
    expect(semanticAxisFromBounds("linear", "sqrt", [100, 1])).toEqual({
      kind: "linear",
      transform: "sqrt",
      domain: [1, 100],
    });
    expect(semanticAxisFromBounds("band", "identity", ["south", "north"])).toEqual({
      kind: "band",
      values: ["south", "north"],
    });
    expect(semanticAxisFromBounds("band", "identity", [1, "1"])).toEqual({
      kind: "band",
      values: ["@n:1", "1"],
    });
  });
});
