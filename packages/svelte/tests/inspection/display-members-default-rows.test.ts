import "../setup-register-all.js";
import { describe, expect, it } from "vitest";

import { defaultTooltipRows } from "../../src/lib/inspection/display-members.js";

import { field } from "./display-members-fixtures.js";

describe("defaultTooltipRows (series-centric axis groups)", () => {
  const labs = {
    x: "Year",
    y: "Shillings",
    color: "Series",
  };

  it("collapses multi-series x-group members to series name → measure value", () => {
    // Themes wheat/wages style: aes(x=year, y=riders, color=mode).
    // Without this, each member renders "Shillings: 41" + "Series: Wheat price"
    // and three series become six noisy key-value lines.
    const wheat = [
      field("x", "month", 1565),
      field("y", "riders", 41),
      field("color", "mode", "Wheat price"),
    ];
    const rows = defaultTooltipRows(wheat, "x", { labs });
    expect(rows).toEqual([
      {
        key: "color:mode:riders",
        label: "Wheat price",
        value: 41,
        valueChannel: "y",
        valueField: "riders",
      },
    ]);
  });

  it("uses fill as series identity for stacked area groups", () => {
    const disease = [
      field("x", "year", 1855),
      field("y", "twh", 1022.8),
      field("fill", "source", "Disease"),
    ];
    const rows = defaultTooltipRows(disease, "x", {
      labs: {
        x: "Year",
        y: "Deaths per 1,000 per year",
        fill: "Cause",
      },
    });
    expect(rows).toEqual([
      {
        key: "fill:source:twh",
        label: "Disease",
        value: 1022.8,
        valueChannel: "y",
        valueField: "twh",
      },
    ]);
  });

  it("keeps traditional field labels for exact / xy point inspection", () => {
    const penguin = [
      field("x", "flipper", 180),
      field("y", "mass", 3700),
      field("color", "species", "Adelie"),
    ];
    const rows = defaultTooltipRows(penguin, "xy", {
      labs: {
        x: "Flipper length (mm)",
        y: "Body mass (g)",
        color: "Species",
      },
    });
    expect(rows.map((r) => r.label)).toEqual(["Flipper length (mm)", "Body mass (g)", "Species"]);
    expect(rows.map((r) => r.value)).toEqual([180, 3700, "Adelie"]);
  });

  it("falls back to traditional rows when series identity is blank", () => {
    // Stat aggregates can advertise fill/weight fields with null values
    // (no source row + CandidateFacts has no fillValue). Do not invent a
    // "– → measure" row; keep readable field labels so y at least shows.
    // Weight is a stat input — omit even when blank (y is the reading).
    const blankSeries = [
      field("x", "x", "1876"),
      field("y", "count", 175),
      field("fill", "level", null),
      field("weight", "deaths", null),
    ];
    const rows = defaultTooltipRows(blankSeries, "x", {
      labs: { x: "Year", y: "Deaths per million", fill: "County" },
    });
    expect(rows.map((r) => r.label)).toEqual(["Deaths per million", "County"]);
    expect(rows.map((r) => r.value)).toEqual([175, null]);
  });

  it("does not re-print weight next to the measure for exact weighted bars", () => {
    // Gallery beer dodged bars: aes(x=year, fill=package, weight=barrelsMillions).
    // Exact mode used to dump Year / Millions of barrels / Package / barrels millions.
    const beer = [
      field("x", "year", 2014),
      field("y", "count", 158.54),
      field("fill", "package", "Bottles and cans"),
      field("weight", "barrelsMillions", 158.54),
    ];
    const rows = defaultTooltipRows(beer, "exact", {
      labs: {
        x: "Year",
        y: "Millions of barrels",
        fill: "Package",
      },
    });
    expect(rows.map((r) => r.label)).toEqual(["Year", "Millions of barrels", "Package"]);
    expect(rows.map((r) => r.value)).toEqual([2014, 158.54, "Bottles and cans"]);
  });

  it("series-centric axis groups also drop the weight echo", () => {
    const beer = [
      field("x", "year", 2016),
      field("y", "count", 17),
      field("fill", "package", "Kegs and barrels"),
      field("weight", "barrelsMillions", 17),
    ];
    const rows = defaultTooltipRows(beer, "x", {
      labs: {
        x: "Year",
        y: "Millions of barrels",
        fill: "Package",
      },
    });
    expect(rows).toEqual([
      {
        key: "fill:package:count",
        label: "Kegs and barrels",
        value: 17,
        valueChannel: "y",
        valueField: "count",
      },
    ]);
  });

  it("falls back when there is no series aesthetic (single-series line)", () => {
    const single = [field("x", "year", 1855), field("y", "value", 95.7)];
    const rows = defaultTooltipRows(single, "x", {
      labs: { x: "Year", y: "£ millions" },
    });
    expect(rows).toEqual([
      {
        key: "y",
        label: "£ millions",
        value: 95.7,
        valueChannel: "y",
        valueField: "value",
      },
    ]);
  });

  it("keeps the measure label when fill only echoes the grouping axis column", () => {
    // Violin/bar palette: aes(x=run, y=velocity, fill=run). Axis header is the
    // run; body must stay "velocity: …", not "runValue: velocity".
    const violin = [field("x", "run", 3), field("y", "velocity", 850), field("fill", "run", 3)];
    const rows = defaultTooltipRows(violin, "x", {
      labs: { x: "Run", y: "Velocity" },
    });
    expect(rows).toEqual([
      {
        key: "y",
        label: "Velocity",
        value: 850,
        valueChannel: "y",
        valueField: "velocity",
      },
    ]);
  });

  it("keeps traditional rows when color/fill is continuous (number or date)", () => {
    // aes(x=date, y=price, color=volume) must not collapse to "12345: 41".
    const continuous = [
      field("x", "date", "2020-01-01"),
      field("y", "price", 41),
      field("color", "volume", 12345),
    ];
    const rows = defaultTooltipRows(continuous, "x", {
      labs: { x: "Date", y: "Price", color: "Volume" },
    });
    expect(rows.map((r) => r.label)).toEqual(["Price", "Volume"]);
    expect(rows.map((r) => r.value)).toEqual([41, 12345]);
  });

  it("does not treat identity-scaled paint strings as series identity (#1844)", () => {
    const constantPaint = [
      field("x", "label", "Alpha"),
      field("y", "count", 30),
      { ...field("fill", "color", "#0072B2"), constant: true, identityPaint: true },
    ];
    expect(defaultTooltipRows(constantPaint, "x")).toEqual([
      {
        key: "y",
        label: "count",
        value: 30,
        valueChannel: "y",
        valueField: "count",
      },
    ]);

    const varyingIdentityPaint = [
      field("x", "label", "Alpha"),
      field("y", "count", 30),
      { ...field("fill", "color", "#0072B2"), identityPaint: true },
    ];
    expect(defaultTooltipRows(varyingIdentityPaint, "x").map((r) => r.label)).toEqual([
      "count",
      "color",
    ]);
  });
});
