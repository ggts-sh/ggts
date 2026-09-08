import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";

import type { RenderModel } from "@ggts-sh/core";

import type {
  IntervalSelection,
  LegendFocusEvent,
  PlotInspectionChange,
  PointSelection,
} from "../../src/lib/interaction/interaction.js";
import {
  BRUSH_SECOND_CORNER_ANNOUNCEMENT,
  countLabel,
  datumLabel,
  inspectionLiveText,
  labelFromFields,
  legendFocusAnnouncement,
  markLabel,
  resolveInteractionLiveText,
  selectionAnnouncement,
  uniqueMappedFields,
  zoomAnnouncement,
} from "../../src/lib/assembly/labels.js";

function model(opts: {
  layerFields?: { field: string }[][];
  rows?: Record<number, Record<string, unknown> | null>;
}): RenderModel {
  return fromAny<RenderModel>({
    layerFields: opts.layerFields ?? [[{ field: "x" }, { field: "y" }]],
    row: (index: number) => opts.rows?.[index] ?? null,
  });
}

describe("uniqueMappedFields / labelFromFields", () => {
  it("dedupes field names in first-seen order across layers", () => {
    const m = model({
      layerFields: [
        [{ field: "x" }, { field: "y" }],
        [{ field: "y" }, { field: "color" }],
      ],
    });
    expect(uniqueMappedFields(m)).toEqual(["x", "y", "color"]);
  });

  it("formats a closed-over field list without re-walking layerFields", () => {
    expect(labelFromFields(["x", "color"], { x: 1, color: "red" }, "fallback")).toBe(
      "x 1, color red",
    );
    expect(labelFromFields([], { x: 1 }, "data point 1")).toBe("data point 1");
  });
});

describe("markLabel", () => {
  it("falls back when model or row is missing", () => {
    expect(markLabel(null, 2)).toBe("data point 3");
    expect(markLabel(model({ rows: {} }), 4)).toBe("data point 5");
  });

  it("joins unique fields and de-duplicates across layers", () => {
    const m = model({
      layerFields: [
        [{ field: "x" }, { field: "y" }],
        [{ field: "y" }, { field: "color" }],
      ],
      rows: { 0: { x: 1, y: 2, color: "red" } },
    });
    expect(markLabel(m, 0)).toBe("x 1, y 2, color red");
  });

  it("falls back when fields produce an empty label", () => {
    const m = model({
      layerFields: [[]],
      rows: { 0: { x: 1 } },
    });
    expect(markLabel(m, 0)).toBe("data point 1");
  });
});

describe("datumLabel", () => {
  it("returns the no-active-datum fallback", () => {
    expect(datumLabel(model({}), null)).toBe("No active datum");
  });

  it("returns Active datum when there are no mapped fields", () => {
    expect(datumLabel(model({ layerFields: [[]] }), { x: 1 })).toBe("Active datum");
  });

  it("stringifies missing values as empty", () => {
    const m = model({
      layerFields: [[{ field: "x" }, { field: "y" }]],
    });
    expect(datumLabel(m, { x: 3 })).toBe("x 3, y ");
  });
});

describe("inspectionLiveText", () => {
  function inspection(
    partial: Partial<PlotInspectionChange<Record<string, unknown>, PropertyKey>> &
      Pick<
        PlotInspectionChange<Record<string, unknown>, PropertyKey>,
        "mode" | "focus" | "members" | "state"
      >,
  ): PlotInspectionChange<Record<string, unknown>, PropertyKey> {
    return fromPartial<PlotInspectionChange<Record<string, unknown>, PropertyKey>>({
      type: "inspect",
      phase: "change",
      source: "keyboard",
      panelId: null,
      ...partial,
    });
  }

  it("uses singular/plural and optional pinned suffix for exact mode", () => {
    const m = model({
      layerFields: [[{ field: "x" }, { field: "y" }]],
    });
    const fields = [
      { channel: "x", field: "x", value: 1 },
      { channel: "y", field: "y", value: 2 },
    ];
    const focus = {
      key: "a",
      row: { x: 1, y: 2 },
      sourceKeys: ["a"] as const,
      lineageCount: 1,
      layerIndex: 0,
      panelId: null,
      fields,
      anchor: { x: 0, y: 0 },
    };
    const one = inspection({
      mode: "exact",
      state: "transient",
      focus,
      // Focus is always a member of the public snapshot (resolver contract).
      members: [focus],
    });
    expect(inspectionLiveText(m, fromAny(one))).toBe("x 1, y 2; 1 datum");

    // Duplicate display payloads (line+point style) collapse for live text (#385).
    const pinnedDup = {
      ...one,
      state: "pinned" as const,
      members: [focus, { ...focus, layerIndex: 1 }],
    };
    expect(inspectionLiveText(m, fromAny(pinnedDup))).toBe("x 1, y 2; 1 datum, pinned");

    const second = {
      ...focus,
      key: "b",
      fields: [
        { channel: "x", field: "x", value: 1 },
        { channel: "y", field: "y", value: 9 },
      ],
    };
    const pinnedDistinct = {
      ...one,
      state: "pinned" as const,
      members: [focus, second],
    };
    expect(inspectionLiveText(m, fromAny(pinnedDistinct))).toBe("x 1, y 2; 2 data, pinned");
  });

  it("excludes the axis channel from focused fields for x/y modes", () => {
    const m = model({
      layerFields: [[{ field: "x" }, { field: "y" }, { field: "color" }]],
    });
    const value = inspection({
      mode: "x",
      state: "transient",
      axisValue: 3,
      axisLabel: "3.0",
      focus: {
        key: "a",
        row: { x: 3, y: 9, color: "blue" },
        sourceKeys: ["a"],
        lineageCount: 1,
        layerIndex: 0,
        panelId: null,
        fields: [
          { channel: "x", field: "x", value: 3 },
          { channel: "y", field: "y", value: 9 },
          { channel: "colour", field: "color", value: "blue" },
        ],
        anchor: { x: 0, y: 0 },
      },
      members: [
        // Same object as focus so display collapse does not invent a second payload.
        {
          key: "a",
          row: { x: 3, y: 9, color: "blue" },
          sourceKeys: ["a"],
          lineageCount: 1,
          layerIndex: 0,
          panelId: null,
          fields: [
            { channel: "x", field: "x", value: 3 },
            { channel: "y", field: "y", value: 9 },
            { channel: "colour", field: "color", value: "blue" },
          ],
          anchor: { x: 0, y: 0 },
        },
      ],
    });
    expect(inspectionLiveText(m, fromAny(value))).toBe("x 3.0; 1 datum; focused y 9, color blue");
  });
});

describe("resolveInteractionLiveText", () => {
  const m = model({
    layerFields: [[{ field: "x" }, { field: "y" }]],
  });
  const focus = {
    key: "a",
    row: { x: 1, y: 2 },
    sourceKeys: ["a"],
    lineageCount: 1,
    layerIndex: 0,
    panelId: null,
    fields: [
      { channel: "x", field: "x", value: 1 },
      { channel: "y", field: "y", value: 2 },
    ],
    anchor: { x: 0, y: 0 },
  };
  const members = [
    {
      key: "a",
      row: { x: 1, y: 2 },
      sourceKeys: ["a"],
      lineageCount: 1,
      layerIndex: 0,
      panelId: null,
      fields: focus.fields,
      anchor: { x: 0, y: 0 },
    },
  ];
  const keyboardInspection = fromPartial<
    PlotInspectionChange<Record<string, unknown>, PropertyKey>
  >({
    type: "inspect",
    phase: "change",
    source: "keyboard",
    panelId: null,
    mode: "exact",
    state: "transient",
    focus,
    members,
  });

  it("prefers non-empty sticky announcement over inspection text", () => {
    expect(
      resolveInteractionLiveText({
        announcement: "Zoom complete.",
        model: m,
        inspection: fromAny(keyboardInspection),
      }),
    ).toBe("Zoom complete.");
  });

  it("falls through empty announcement (host microtask clear-then-fill)", () => {
    expect(
      resolveInteractionLiveText({
        announcement: "",
        model: m,
        inspection: fromAny(keyboardInspection),
      }),
    ).toBe(inspectionLiveText(m, fromAny(keyboardInspection)));
  });

  it("uses inspection live text for keyboard and touch sources only", () => {
    const expected = inspectionLiveText(m, fromAny(keyboardInspection));
    expect(
      resolveInteractionLiveText({
        announcement: "",
        model: m,
        inspection: fromAny(keyboardInspection),
      }),
    ).toBe(expected);
    expect(
      resolveInteractionLiveText({
        announcement: "",
        model: m,
        inspection: fromAny({ ...keyboardInspection, source: "touch" }),
      }),
    ).toBe(expected);
    expect(
      resolveInteractionLiveText({
        announcement: "",
        model: m,
        inspection: fromAny({ ...keyboardInspection, source: "pointer" }),
      }),
    ).toBe("");
  });

  it("returns empty when inspection is null and announcement is empty", () => {
    expect(
      resolveInteractionLiveText({
        announcement: "",
        model: m,
        inspection: null,
      }),
    ).toBe("");
  });
});

describe("countLabel", () => {
  it("uses singular datum and plural data", () => {
    expect(countLabel(0)).toBe("0 data");
    expect(countLabel(1)).toBe("1 datum");
    expect(countLabel(2)).toBe("2 data");
  });
});

describe("selectionAnnouncement", () => {
  const pointEnd = (keys: PropertyKey[]): PointSelection =>
    Object.freeze({
      type: "select",
      phase: "end",
      mode: "point",
      keys: Object.freeze([...keys]),
      source: "pointer",
    });

  const interval = (phase: IntervalSelection["phase"], lineageCount: number): IntervalSelection =>
    Object.freeze({
      type: "select",
      phase,
      mode: "xy",
      panelId: null,
      domain: Object.freeze({}),
      pixels: Object.freeze({ x0: 0, y0: 0, x1: 1, y1: 1 }),
      keys: Object.freeze([]),
      lineageCount,
      source: "pointer",
    });

  it("announces end with point key count or interval lineage count", () => {
    expect(selectionAnnouncement(pointEnd(["a"]))).toBe("Selection complete, 1 datum.");
    expect(selectionAnnouncement(pointEnd(["a", "b"]))).toBe("Selection complete, 2 data.");
    expect(selectionAnnouncement(interval("end", 3))).toBe("Selection complete, 3 data.");
  });

  it("announces clear and skips start/change", () => {
    expect(selectionAnnouncement(interval("clear", 0))).toBe("Selection cleared.");
    expect(selectionAnnouncement(interval("start", 0))).toBeNull();
    expect(selectionAnnouncement(interval("change", 1))).toBeNull();
  });
});

describe("legendFocusAnnouncement", () => {
  it("announces committed/previewed change and clear", () => {
    const committed: LegendFocusEvent = {
      type: "legend-focus",
      phase: "change",
      state: "committed",
      source: "pointer",
      scale: "fill",
      value: "web",
      label: "Web",
      keys: ["a"],
    };
    const preview: LegendFocusEvent = {
      ...committed,
      state: "transient",
      keys: ["a", "b"],
    };
    expect(legendFocusAnnouncement(committed)).toBe("Web focused, 1 datum.");
    expect(legendFocusAnnouncement(preview)).toBe("Web previewed, 2 data.");
    expect(
      legendFocusAnnouncement({
        type: "legend-focus",
        phase: "clear",
        source: "keyboard",
      }),
    ).toBe("Legend focus cleared.");
  });
});

describe("zoomAnnouncement", () => {
  it("distinguishes reset from complete via domains nullability", () => {
    expect(zoomAnnouncement(null)).toBe("Zoom reset.");
    expect(zoomAnnouncement({ x: [0, 1] })).toBe("Zoom complete.");
  });
});

describe("BRUSH_SECOND_CORNER_ANNOUNCEMENT", () => {
  it("matches the host brush-instruction copy", () => {
    expect(BRUSH_SECOND_CORNER_ANNOUNCEMENT).toBe("Choose opposite corner.");
  });
});
