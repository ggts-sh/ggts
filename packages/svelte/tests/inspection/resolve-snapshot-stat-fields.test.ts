import { describe, expect, it } from "vitest";

import { registerAll, runPipeline } from "@ggts-sh/core";
import { aes, gg } from "@ggts-sh/spec";

// Temporal spec-driven suite (#1420): no components to self-register, and
// the lane setup skips Temporal deliberately — install the full grammar here.
registerAll();

// Barrel path characterization: production + tests historically import via resolver.js
import { formatTooltipCell } from "../../src/lib/inspection/display-members.js";
import { resolveInspection } from "../../src/lib/inspection/resolver.js";

describe("inspection snapshot resolve", () => {
  it("formats stat-layer temporal position fields with axis formatters (#1113)", () => {
    // Binned median over a date axis has no source row — candidate.xValue is
    // epoch ms. The axis header already formats it; default field rows must too.
    const data = [
      { date: "2000-05-01", y: 10 },
      { date: "2000-05-15", y: 20 },
      { date: "2000-06-01", y: 30 },
      { date: "2000-06-15", y: 40 },
    ];
    const model = runPipeline(
      gg(data, aes({ x: "date", y: "y" }))
        .geomLine({ stat: "summary_bin", fun: "median", bins: 4 })
        .spec(),
      { width: 400, height: 300 },
    );
    const seed = model.candidates.candidate(0)!;
    expect(seed.rowIndex).toBeNull();
    expect(typeof seed.xValue).toBe("number");
    expect(seed.xValue).toBeGreaterThan(1e11); // epoch ms, not a calendar year

    const inspection = resolveInspection({
      model,
      seed,
      mode: "exact",
      state: "transient",
      source: "pointer",
      keyOf: () => null,
    });
    expect(inspection.focus.row).toBeNull();
    const xField = inspection.focus.fields.find((field) => field.channel === "x");
    expect(xField).toBeDefined();
    expect(xField!.value).toBe(seed.xValue);

    // Plain cell path still dumps the epoch — the bug before the formatter route.
    expect(formatTooltipCell(xField!.value)).toBe(String(seed.xValue));
    // With axis formatters (Tooltip / live-text path), match the axis header.
    const formatted = formatTooltipCell(xField!.value, {
      channel: "x",
      axisFormatters: model.axisFormatters,
    });
    expect(formatted).toBe(model.axisFormatters.x(seed.xValue));
    expect(formatted).not.toBe(String(seed.xValue));
    expect(formatted).toMatch(/2000/);
    model.dispose();
  });

  it("recovers fill and weight from lineage for single-row stat bars (#1526)", () => {
    // geom_bar + weight: candidates are aggregates (rowIndex null) but lineage
    // still points at the source row that holds fill identity and weight.
    const model = runPipeline(
      {
        data: {
          values: [
            { track: "1876", level: "Berks", deaths: 175 },
            { track: "1876", level: "Herts", deaths: 174 },
          ],
        },
        layers: [
          {
            geom: "bar",
            position: "dodge",
            aes: {
              x: { field: "track" },
              fill: { field: "level" },
              weight: { field: "deaths" },
            },
          },
        ],
      },
      { width: 400, height: 300 },
    );
    const seed = model.candidates.candidate(0)!;
    expect(seed.rowIndex).toBeNull();
    expect(seed.yValue).toBe(175);
    const inspection = resolveInspection({
      model,
      seed,
      mode: "exact",
      state: "transient",
      source: "pointer",
      keyOf: () => null,
    });
    const byChannel = Object.fromEntries(
      inspection.focus.fields.map((field) => [field.channel, field.value]),
    );
    expect(byChannel.fill).toBe("Berks");
    expect(byChannel.weight).toBe(175);
    expect(byChannel.y).toBe(175);
    model.dispose();
  });

  it("recovers group-constant fill from multi-row bar lineage (#1526)", () => {
    const model = runPipeline(
      {
        data: {
          values: [
            { track: "1876", level: "Berks" },
            { track: "1876", level: "Berks" },
            { track: "1876", level: "Herts" },
          ],
        },
        layers: [
          {
            geom: "bar",
            position: "dodge",
            aes: {
              x: { field: "track" },
              fill: { field: "level" },
            },
          },
        ],
      },
      { width: 400, height: 300 },
    );
    // Berks bar aggregates two rows; fill is still the series identity.
    const berks = Array.from({ length: model.candidates.size }, (_, id) =>
      model.candidates.candidate(id)!,
    ).find((c) => c.yValue === 2)!;
    expect(berks.rowIndex).toBeNull();
    expect(model.lineage.count(berks.lineage)).toBe(2);
    const inspection = resolveInspection({
      model,
      seed: berks,
      mode: "exact",
      state: "transient",
      source: "pointer",
      keyOf: () => null,
    });
    const fill = inspection.focus.fields.find((f) => f.channel === "fill");
    expect(fill?.value).toBe("Berks");
    model.dispose();
  });

  it("does not invent a weight when multi-row lineage weights differ (#1526)", () => {
    // Prefer y (the aggregate) over a single arbitrary source weight.
    const model = runPipeline(
      {
        data: {
          values: [
            { track: "1876", level: "Berks", deaths: 100 },
            { track: "1876", level: "Berks", deaths: 75 },
          ],
        },
        layers: [
          {
            geom: "bar",
            aes: {
              x: { field: "track" },
              fill: { field: "level" },
              weight: { field: "deaths" },
            },
          },
        ],
      },
      { width: 400, height: 300 },
    );
    const seed = model.candidates.candidate(0)!;
    expect(seed.rowIndex).toBeNull();
    expect(model.lineage.count(seed.lineage)).toBe(2);
    expect(seed.yValue).toBe(175);
    const inspection = resolveInspection({
      model,
      seed,
      mode: "exact",
      state: "transient",
      source: "pointer",
      keyOf: () => null,
    });
    const byChannel = Object.fromEntries(
      inspection.focus.fields.map((field) => [field.channel, field.value]),
    );
    expect(byChannel.fill).toBe("Berks");
    expect(byChannel.weight).toBeNull();
    expect(byChannel.y).toBe(175);
    model.dispose();
  });

  it("does not invent fill when multi-row lineage fill values disagree (#1526)", () => {
    // Continuous fill never participates in grouping, so a histogram bin's
    // lineage can span rows with different fill values. Tooltip must not
    // pick the first row's fill as if it described the whole bin.
    const model = runPipeline(
      {
        data: {
          values: [
            { x: 1.1, heat: 10 },
            { x: 1.2, heat: 90 },
            { x: 5.0, heat: 40 },
          ],
        },
        layers: [
          {
            geom: "histogram",
            params: { bins: 2 },
            aes: {
              x: { field: "x" },
              fill: { field: "heat" },
            },
          },
        ],
      },
      { width: 400, height: 300 },
    );
    const multi = Array.from({ length: model.candidates.size }, (_, id) =>
      model.candidates.candidate(id)!,
    ).find((c) => model.lineage.count(c.lineage) > 1);
    expect(multi).toBeDefined();
    expect(multi!.rowIndex).toBeNull();
    const inspection = resolveInspection({
      model,
      seed: multi!,
      mode: "exact",
      state: "transient",
      source: "pointer",
      keyOf: () => null,
    });
    const fill = inspection.focus.fields.find((f) => f.channel === "fill");
    expect(fill?.value).toBeNull();
    model.dispose();
  });

  it("reads non-position candidate channels when the seed has no source row", () => {
    // Stat bins have null rowIndex; tooltip fields must still surface size /
    // linewidth / alpha / shape / linetype from the candidate bag, and map
    // unknown channels to null.
    const data = [
      { date: "2000-05-01", y: 10, s: 1 },
      { date: "2000-05-15", y: 20, s: 2 },
      { date: "2000-06-01", y: 30, s: 3 },
      { date: "2000-06-15", y: 40, s: 4 },
    ];
    const model = runPipeline(
      gg(data, aes({ x: "date", y: "y", size: "s" }))
        .geomPoint({ stat: "summary_bin", fun: "median", bins: 4 })
        .spec(),
      { width: 400, height: 300 },
    );
    const seed = model.candidates.candidate(0)!;
    expect(seed.rowIndex).toBeNull();
    // Publish every non-position channel the candidateValue switch handles.
    const seedWithChannels = {
      ...seed,
      sizeValue: 4,
      linewidthValue: 1.5,
      alphaValue: 0.4,
      shapeValue: "circle",
      linetypeValue: "dashed",
    };
    // Force layerFields to include each channel (plus an unknown one for null).
    Object.defineProperty(model, "layerFields", {
      value: [
        [
          { channel: "size", field: "s" },
          { channel: "linewidth", field: "lw" },
          { channel: "alpha", field: "a" },
          { channel: "shape", field: "sh" },
          { channel: "linetype", field: "lt" },
          { channel: "fill", field: "f" },
        ],
      ],
    });
    const inspection = resolveInspection({
      model,
      seed: seedWithChannels,
      mode: "exact",
      state: "transient",
      source: "pointer",
      keyOf: () => null,
    });
    expect(inspection.focus.row).toBeNull();
    const byChannel = Object.fromEntries(
      inspection.focus.fields.map((field) => [field.channel, field.value]),
    );
    expect(byChannel).toMatchObject({
      size: 4,
      linewidth: 1.5,
      alpha: 0.4,
      shape: "circle",
      linetype: "dashed",
      fill: null,
    });
    model.dispose();
  });

  it("resolves bindot after_stat x/y when candidates keep a source rowIndex", () => {
    // geom_dotplot is hybrid: real source rows for color/lineage, after_stat
    // x (bin center) + stackpos for positions. Tooltip fields must not look
    // up generated names on the source table (would print "–" for every dot).
    const model = runPipeline(
      gg({ density: [1, 2, 2, 2] }, aes({ x: "density" }))
        .geomDotplot({ binwidth: 1, boundary: 0.5, stackdir: "up" })
        .spec(),
      { width: 480, height: 320 },
    );
    expect(model.candidates.size).toBe(4);

    const byKey = new Map<string, number>();
    for (let id = 0; id < model.candidates.size; id++) {
      const seed = model.candidates.candidate(id)!;
      expect(seed.rowIndex).not.toBeNull();
      expect(seed.xValue).not.toBeNull();
      expect(seed.yValue).not.toBeNull();

      const inspection = resolveInspection({
        model,
        seed,
        mode: "exact",
        state: "transient",
        source: "pointer",
        keyOf: () => null,
      });
      // Source row is present, but focus.fields still carry after_stat values.
      expect(inspection.focus.row).not.toBeNull();
      const byChannel = Object.fromEntries(
        inspection.focus.fields.map((field) => [field.channel, field.value]),
      );
      expect(byChannel.x).toBe(seed.xValue);
      expect(byChannel.y).toBe(seed.yValue);
      expect(byChannel.x).not.toBeNull();
      expect(byChannel.y).not.toBeNull();
      byKey.set(`${String(byChannel.x)}:${String(byChannel.y)}`, id);
    }
    // Different dots must not all collapse to one tooltip payload.
    expect(byKey.size).toBeGreaterThan(1);
    model.dispose();
  });
});
