import "../setup-register-all.js";
/**
 * Default-tooltip display collapse for identical field payloads (#385).
 * Pure helper — does not mutate the public inspection snapshot.
 */
import { describe, expect, it } from "vitest";

import type { CellValue } from "@ggts-sh/core";

import {
  fieldsForDefaultTooltip,
  formatTooltipCell,
  tooltipDisplayPayloadToken,
  tooltipFieldLabel,
} from "../../src/lib/inspection/display-members.js";
import { field } from "./display-members-fixtures.js";

describe("formatTooltipCell", () => {
  it("matches default tooltip formatting for null, Date, and rounded numbers", () => {
    expect(formatTooltipCell(null)).toBe("–");
    expect(formatTooltipCell(new Date("1985-01-01T00:00:00.000Z"))).toBe(
      "1985-01-01T00:00:00.000Z",
    );
    expect(formatTooltipCell(1.23456)).toBe("1.235");
    expect(formatTooltipCell("1985")).toBe("1985");
  });

  it("does not throw on invalid Date (live-text tokens)", () => {
    expect(formatTooltipCell(new Date(Number.NaN))).toBe("–");
  });

  it("routes position channels through axis formatters when provided (#1113)", () => {
    // Stat-derived candidates store temporal positions as epoch ms. Default
    // cell formatting would print the raw number; axis formatters already know
    // the scale (same path as the axis header). Callers pass formatters only
    // for members with no source row so identity points keep precision.
    const epoch = Date.UTC(2000, 4, 1);
    const axisFormatters = {
      x: (value: CellValue) =>
        value === null ? "–" : new Date(Number(value)).toISOString().slice(0, 10),
      y: (value: CellValue) => (value === null ? "–" : `y:${String(value)}`),
    };
    expect(formatTooltipCell(epoch)).toBe(String(epoch));
    expect(formatTooltipCell(epoch, { channel: "x", axisFormatters })).toBe("2000-05-01");
    expect(formatTooltipCell(12.3456, { channel: "y", axisFormatters })).toBe("y:12.3456");
    // Non-position channels keep the plain cell path even with formatters present.
    expect(formatTooltipCell(epoch, { channel: "color", axisFormatters })).toBe(String(epoch));
    // Without formatters (identity path), numbers keep full cell precision.
    expect(formatTooltipCell(23.7, { channel: "x" })).toBe("23.7");
  });
});

describe("tooltipFieldLabel (#752)", () => {
  it("humanizes camelCase and snake_case column names for default tooltip dt text", () => {
    expect(tooltipFieldLabel("crimePersons")).toBe("crime persons");
    expect(tooltipFieldLabel("literacy")).toBe("literacy");
    expect(tooltipFieldLabel("flipper_length")).toBe("flipper length");
    expect(tooltipFieldLabel("Region")).toBe("Region");
  });

  it("prefers the matching lab title when the channel has an explicit lab", () => {
    const labs = {
      x: "Literate conscripts (%)",
      y: "Population per crime against persons",
      color: "Region",
    };
    expect(tooltipFieldLabel("literacy", { channel: "x", labs })).toBe("Literate conscripts (%)");
    expect(tooltipFieldLabel("crimePersons", { channel: "y", labs })).toBe(
      "Population per crime against persons",
    );
    expect(tooltipFieldLabel("region", { channel: "color", labs })).toBe("Region");
  });

  it("falls back to humanized field names when the channel has no lab", () => {
    const labs = { x: "Literate conscripts (%)" };
    expect(tooltipFieldLabel("crimePersons", { channel: "y", labs })).toBe("crime persons");
    expect(tooltipFieldLabel("crimePersons", { channel: "y" })).toBe("crime persons");
    expect(tooltipFieldLabel("crimePersons", { channel: "y", labs: null })).toBe("crime persons");
  });

  it("ignores empty lab strings so hidden axis titles do not blank the tooltip", () => {
    expect(tooltipFieldLabel("literacy", { channel: "x", labs: { x: "" } })).toBe("literacy");
    expect(tooltipFieldLabel("crimePersons", { channel: "y", labs: { y: "   " } })).toBe(
      "crime persons",
    );
  });

  it("does not invent labels for channels outside Labs (e.g. group)", () => {
    const labs = { x: "Year", color: "Series" };
    expect(tooltipFieldLabel("series_id", { channel: "group", labs })).toBe("series id");
  });
});

describe("fieldsForDefaultTooltip (#754)", () => {
  const fields = [
    field("x", "literacy", 67),
    field("y", "crimePersons", 35203),
    field("color", "region", "North"),
  ];

  it("omits the shared axis channel when inspection mode is x or y", () => {
    expect(fieldsForDefaultTooltip(fields, "x").map((f) => f.field)).toEqual([
      "crimePersons",
      "region",
    ]);
    expect(fieldsForDefaultTooltip(fields, "y").map((f) => f.field)).toEqual([
      "literacy",
      "region",
    ]);
  });

  it("keeps every field for exact and xy point inspection", () => {
    expect(fieldsForDefaultTooltip(fields, "exact")).toEqual(fields);
    expect(fieldsForDefaultTooltip(fields, "xy")).toEqual(fields);
  });

  it("collapses later channels that re-list the same column (aes x=cat, fill=cat)", () => {
    // Palette-style bars: fill maps the category column for paint only.
    // A11y live-text already dedupes by field name; default tooltips must too
    // so users never see a third row repeating Squadron under "language".
    const barFields = [
      field("x", "language", "Hulks"),
      field("y", "respondents", 10271),
      field("fill", "language", "Hulks"),
    ];
    const exact = fieldsForDefaultTooltip(barFields, "exact");
    expect(exact.map((f) => f.channel)).toEqual(["x", "y"]);
    expect(exact.map((f) => f.field)).toEqual(["language", "respondents"]);

    // Axis-group: header already prints the category; fill echo of the same
    // column must drop so only the measure remains (Devin review on #1527).
    expect(fieldsForDefaultTooltip(barFields, "x").map((f) => f.field)).toEqual(["respondents"]);

    // Distinct columns stay even when values happen to match.
    const distinct = [field("x", "name", "Adelie"), field("color", "species", "Adelie")];
    expect(fieldsForDefaultTooltip(distinct, "exact").map((f) => f.field)).toEqual([
      "name",
      "species",
    ]);
  });

  it("omits weight when y already carries the aggregated reading (#1526)", () => {
    // geom_bar + weight: layerFields advertise weight for custom content, but
    // the default tooltip must not re-print barrelsMillions next to y.
    const weightedBar = [
      field("x", "year", 2014),
      field("y", "count", 158.54),
      field("fill", "package", "Bottles and cans"),
      field("weight", "barrelsMillions", 158.54),
    ];
    expect(fieldsForDefaultTooltip(weightedBar, "exact").map((f) => f.channel)).toEqual([
      "x",
      "y",
      "fill",
    ]);
    expect(fieldsForDefaultTooltip(weightedBar, "x").map((f) => f.channel)).toEqual(["y", "fill"]);
  });
});

describe("tooltipDisplayPayloadToken", () => {
  it("ignores channel and uses display field name + formatted value", () => {
    const a = [field("x", "period", "1985"), field("y", "value", 511)];
    const b = [field("x", "period", "1985"), field("y", "value", 511)];
    // Different channels same display fields would still match if names/values match
    expect(tooltipDisplayPayloadToken(a)).toBe(tooltipDisplayPayloadToken(b));
  });

  it("distinguishes different values and different field names", () => {
    const base = [field("x", "period", "1985"), field("y", "value", 511)];
    const otherY = [field("x", "period", "1985"), field("y", "value", 520)];
    const otherName = [field("x", "period", "1985"), field("fill", "fillGroup", "X")];
    expect(tooltipDisplayPayloadToken(base)).not.toBe(tooltipDisplayPayloadToken(otherY));
    expect(tooltipDisplayPayloadToken(base)).not.toBe(tooltipDisplayPayloadToken(otherName));
  });
});
