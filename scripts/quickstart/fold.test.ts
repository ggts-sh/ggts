/**
 * The lesson's one invariant: the chart on the page, the fragment printed
 * beside it, and the finished file at the end all come from `foldSakura`, and
 * every accumulated spec really renders.
 */
import { renderToSVGString, runPipeline } from "@ggts-sh/core";
import { validate } from "@ggts-sh/spec";
import { describe, expect, it } from "bun:test";

import {
  QUICKSTART_PAGE_SVELTE,
  QUICKSTART_PORTABLE_SPEC_FRAGMENT,
  SAKURA_BASELINE,
  SAKURA_TREND_WINDOW,
  SAKURA_Y_BREAKS,
  SAKURA_Y_LAB,
  SAKURA_STEPS,
  SAKURA_FINISHED_SVELTE,
  foldSakura,
  finishedPortableSpecNamed,
} from "../quickstart.ts";
import { makeRows } from "./test-helpers.ts";

const rows = makeRows();
const finished = foldSakura(SAKURA_STEPS.length, rows);

describe("the sakura lesson folds to renderable specs", () => {
  it("starts from a plain scatter of every observation", () => {
    const start = foldSakura(0, rows);
    expect(start.spec.layers).toEqual([{ geom: "point" }]);
    // Year ticks use labels: "d" from the first render so 1000 CE is not "1,000".
    // Domain is fixed on the first render so ticks stay stable as steps add chrome.
    // bloomDate is a full ISO calendar date per year; without month-day y the
    // auto scale draws year-vs-year (a diagonal) instead of bloom timing.
    expect(start.spec.scales).toEqual({
      x: { type: "linear", labels: "d", domain: [800, 2030] },
      y: { type: "time", temporalKind: "monthDay", reverse: true },
    });
    expect(start.spec.labs).toEqual({ x: "Year", y: SAKURA_Y_LAB });
    expect(start.spec.theme).toBeUndefined();
    expect(start.key).toBeUndefined();
    expect(start.source).toBe(QUICKSTART_PAGE_SVELTE);
    expect(start.source).toContain('<ScaleXContinuous labels="d" domain={[800, 2030]} />');
    expect(start.source).toContain("<ScaleYMonthDay reverse />");
    expect(start.source).toContain(`<Labs x="Year" y="${SAKURA_Y_LAB}" />`);
    const model = runPipeline(start.spec, { width: 900, height: 480 });
    expect(model.scene.batches[0]!.kind).toBe("points");
    const yearLabels = model.scene.axes.x?.ticks
      .filter((tick) => tick.showLabel === true)
      .map((tick) => tick.label);
    expect(yearLabels).toContain("1000");
    expect(yearLabels).not.toContain("1,000");
    // Y must read as bloom season, not as CE years (the pre-fix diagonal).
    const bloomLabels = model.scene.axes.y?.ticks
      .filter((tick) => tick.showLabel === true)
      .map((tick) => tick.label);
    expect(bloomLabels?.some((label) => /1000|1200|1400|1600|1800|2000/.test(label))).toBe(false);
  });

  it("validates and renders at every step", () => {
    for (let count = 0; count <= SAKURA_STEPS.length; count += 1) {
      const step = foldSakura(count, rows);
      const result = validate(step.spec);
      expect(result.ok, `step ${count}: ${JSON.stringify(result)}`).toBe(true);
      const svg = renderToSVGString(step.spec, { width: 900, height: 480 });
      expect(svg).toContain("<svg");
    }
  });

  it("grows the layer set at every step", () => {
    const layerCounts = Array.from({ length: SAKURA_STEPS.length + 1 }, (_, count) => {
      const spec = foldSakura(count, rows).spec as { layers: unknown[] };
      return spec.layers.length;
    });
    // base → theme+trend+chartlines+y-ticks → epochs → annotate → finish
    expect(layerCounts).toEqual([1, 4, 6, 13, 13]);
    for (let i = 1; i < layerCounts.length; i += 1) {
      expect(layerCounts[i]!).toBeGreaterThanOrEqual(layerCounts[i - 1]!);
    }
  });

  it("keeps the basic plot free of production polish props", () => {
    // ariaLabel is production polish — not what a new reader should copy first.
    expect(QUICKSTART_PAGE_SVELTE).not.toContain("ariaLabel");
    expect(QUICKSTART_PAGE_SVELTE).not.toContain("<svelte:head>");
  });

  it("drops record callouts when annotations are disabled", () => {
    // Narrow hosts drop callouts so hand-placed text does not
    // collide with the data. Bands, trend, baseline, and points stay.
    const full = foldSakura(SAKURA_STEPS.length, rows);
    const narrow = foldSakura(SAKURA_STEPS.length, rows, { annotations: false });
    expect((full.spec.layers as unknown[]).length).toBe(13);
    expect((narrow.spec.layers as unknown[]).length).toBe(10);
    const kinds = (narrow.spec.layers as { geom: string }[]).map((layer) => layer.geom);
    expect(kinds).not.toContain("segment");
    // The epoch names stay: they are spread one per band rather than clustered
    // around three points, and they are the only thing naming the bands now
    // that the legend is gone. Measured down to a 560px container without
    // collision, which is the width this option kicks in at.
    const labels = (narrow.spec.layers as { geom: string; data?: { values?: unknown[] } }[]).filter(
      (layer) => layer.geom === "text",
    );
    expect(labels).toHaveLength(1);
    expect(labels[0]!.data?.values).toHaveLength(3);
    expect(kinds).toContain("point");
    expect(kinds).toContain("line");
    expect(kinds).toContain("rect");
    expect(kinds).toContain("rule");
  });

  it("keeps the finished chart identical to the finished source", () => {
    expect(finished.source).toBe(SAKURA_FINISHED_SVELTE);
    expect(finished.key).toBe("year");
    expect(finished.inspect).toEqual({ mode: "exact", pin: true });
    // Every step's contribution is really in the file the reader ends up with.
    // A key a later step sets again (labs gains a title in the last step) is
    // superseded on purpose, so the surviving text is the LAST writer's.
    const lastAttr = new Map<string, string>();
    const lastChild = new Map<string, string>();
    for (const step of SAKURA_STEPS) {
      for (const [key, text] of Object.entries(step.source.attrs ?? {})) lastAttr.set(key, text);
      // Grammar children ride with the attrs they replaced (#659 slice 8).
      // They are plot layers (scale/theme/labs/guides/…), but not mark layers,
      // so they must stay out of the PortableSpec `layers[]` / mark count below.
      for (const [key, text] of Object.entries(step.source.grammar ?? {})) lastAttr.set(key, text);
      for (const [key, text] of Object.entries(step.source.children ?? {}))
        lastChild.set(key, text);
    }
    for (const [key, text] of [...lastAttr, ...lastChild]) {
      expect(SAKURA_FINISHED_SVELTE, `finished file lost ${key}`).toContain(text);
    }
    // And nothing is silently dropped: every layer named in the final order is
    // drawn in the file.
    expect(lastChild.size).toBe((finished.spec.layers as unknown[]).length);
    // Callout leaders are still part of the finished wide chart — source must
    // not claim layers the fold dropped (or omit layers the fold still draws).
    const geoms = (finished.spec.layers as { geom: string }[]).map((layer) => layer.geom);
    expect(geoms).toContain("segment");
    expect(SAKURA_FINISHED_SVELTE).toContain("<GeomSegment");
    expect(geoms).toEqual([
      "rect",
      "text",
      "rule",
      "rule",
      "point",
      "rule",
      "text",
      "line",
      "point",
      "point",
      "point",
      "segment",
      "text",
    ]);
  });

  it("rings the three record years like the reference chart", () => {
    // Tufte circles the records: open rings on the all-time earliest (1409,
    // red) and latest (1323, blue), a filled red dot on the modern record
    // (2023). Rings ride on the same rows as the callouts, so a record can
    // never drift from its circle.
    const layers = finished.spec.layers as {
      geom: string;
      data?: { values?: Record<string, unknown>[] };
      aes?: Record<string, unknown>;
      params?: Record<string, unknown>;
    }[];
    const ringLatest = layers.find(
      (layer) =>
        layer.geom === "point" &&
        layer.params?.["shape"] === "circle-open" &&
        JSON.stringify(layer.aes?.["color"]) === '{"value":"#2c5282"}',
    );
    const ringEarliest = layers.find(
      (layer) =>
        layer.geom === "point" &&
        layer.params?.["shape"] === "circle-open" &&
        JSON.stringify(layer.aes?.["color"]) === '{"value":"#c53030"}',
    );
    const recordRecent = layers.find(
      (layer) =>
        layer.geom === "point" &&
        layer.params?.["shape"] === undefined &&
        JSON.stringify(layer.aes?.["color"]) === '{"value":"#c53030"}',
    );
    expect(ringLatest?.data?.values).toEqual([{ year: 1323, bloomDate: "05-04" }]);
    expect(ringLatest?.params?.["size"]).toBe(3.5);
    expect(ringEarliest?.data?.values).toEqual([{ year: 1409, bloomDate: "03-27" }]);
    expect(ringEarliest?.params?.["size"]).toBe(3.5);
    // Copyable file must declare the same two-column rows — not records.filter,
    // which would put callout fields into ring tooltips the live chart never shows.
    expect(SAKURA_FINISHED_SVELTE).toContain(
      'const ringLatest = [{ year: 1323, bloomDate: "05-04" }]',
    );
    expect(SAKURA_FINISHED_SVELTE).not.toContain("records.filter");
    expect(recordRecent?.data?.values).toEqual([{ year: 2023, bloomDate: "03-25" }]);
    expect(recordRecent?.params?.["size"]).toBe(3);
    // The trend is the reference's 30-year running median, not a binned stand-in.
    const trend = layers.find((layer) => layer.geom === "line");
    expect(trend?.params?.["window"]).toBe(SAKURA_TREND_WINDOW);
    expect(trend?.params?.["fun"]).toBe("median");
  });

  it("publishes agent JSON that is the finished fold with named plot data only", () => {
    // No hand-authored stub: the JSON copy block must match foldSakura except
    // plot data is { name: "kyotoSakura" } (never a partial inline sample of
    // the 838-row series). Annotation tables (epochs, records) stay as values.
    const named = finishedPortableSpecNamed();
    expect(named.data).toEqual({ name: "kyotoSakura" });
    expect(named).not.toHaveProperty("datasets");
    // No bogus inline sample of the series — named ref only at plot level.
    expect(JSON.stringify(named.data)).not.toMatch(/812|"bloomDate"/);
    const parsed = JSON.parse(QUICKSTART_PORTABLE_SPEC_FRAGMENT) as typeof named;
    expect(parsed).toEqual(named);

    const { data: _plotData, ...finishedWithoutData } = finished.spec;
    const { data: namedData, ...namedWithoutData } = named;
    expect(namedData).toEqual({ name: "kyotoSakura" });
    expect(namedWithoutData).toEqual(finishedWithoutData);
    // Agent JSON must carry every finished layer geom — not a point+line fiction.
    const geoms = (named.layers as { geom: string }[]).map((layer) => layer.geom);
    expect(geoms).toEqual([
      "rect",
      "text",
      "rule",
      "rule",
      "point",
      "rule",
      "text",
      "line",
      "point",
      "point",
      "point",
      "segment",
      "text",
    ]);
    expect(named.theme).toBe("tufte");
    expect(named.scales?.y).toMatchObject({
      temporalKind: "monthDay",
      reverse: true,
      dateLabels: "%b %e",
    });
  });

  it("draws the finished file's chartlines as thick as the chart beside it", () => {
    // Review on #1469 caught the copyable file drifting to 0.5 while the
    // fragment and rendered spec used 0.75 — pin the third surface too.
    for (const y of [SAKURA_Y_BREAKS[0], SAKURA_Y_BREAKS[2]]) {
      expect(
        SAKURA_FINISHED_SVELTE,
        `finished file chartline at ${y} drifts from the chart`,
      ).toContain(`yintercept="${y}"\n    linewidth={0.75}`);
    }
  });

  it("prints fragments that carry the values the chart is rendered with", () => {
    // Each pair is (what the reader reads, what the renderer is handed). They
    // are written independently on purpose: the test is the thing that stops
    // the two from drifting.
    const pairs: [number, string, string][] = [
      [0, 'stat="summary_rolling"', '"stat":"summary_rolling"'],
      [0, 'fun="median"', '"fun":"median"'],
      [0, `window={${SAKURA_TREND_WINDOW}}`, `"window":${SAKURA_TREND_WINDOW}`],
      [0, 'curve="linear"', '"curve":"linear"'],
      [0, "alpha={0.55}", '"alpha":0.55'],
      [0, `yintercept="${SAKURA_Y_BREAKS[0]}"`, `"yintercept":"${SAKURA_Y_BREAKS[0]}"`],
      [0, '"dotted"', '"value":"dotted"'],
      [0, "<ThemeTufte />", '"theme":"tufte"'],
      [0, "ScaleYMonthDay", '"dateLabels":"%b %e"'],
      [0, SAKURA_Y_BREAKS[0], `"breaks":${JSON.stringify([...SAKURA_Y_BREAKS])}`],
      [1, "x: null", '"x":null'],
      [1, 'fill: "epoch"', '"fill":{"field":"epoch"}'],
      [1, "GuideNone", '"fill":{"type":"none"}'],
      [1, 'label: "epoch"', '"label":{"field":"epoch"}'],
      [1, "ScaleFillManual", '"type":"manual"'],
      [2, SAKURA_BASELINE, `"yintercept":"${SAKURA_BASELINE}"`],
      [2, "data={baselineLabel}", '"label":"median"'],
      [2, '"#b3452f"', '"value":"#b3452f"'],
      [3, 'key="year"', ""],
    ];
    for (const [index, inFragment, inSpec] of pairs) {
      const step = SAKURA_STEPS[index]!;
      expect(step.fragment, `${step.id}: fragment omits ${inFragment}`).toContain(inFragment);
      if (inSpec === "") continue;
      const delta = JSON.stringify(step.spec);
      expect(delta, `${step.id}: spec omits ${inSpec}`).toContain(inSpec);
    }
    // key/inspect are runtime props, not spec fields — assert them there.
    expect(finished.key).toBe("year");
  });

  it("authors step fragments in ggplot2 thinking order", () => {
    // Guide/llms surfaces print step.fragment verbatim — foldSakura only
    // reorders the finished file. Theme/scale-before-mark fragments are a
    // silent docs regression (caught on #1555 leftovers).
    const tagRe = /<(Theme\w+|Inspect|Geom\w+|Scale\w+|Coord\w+|Facet\w+|Guide\w+|Labs)\b/g;
    for (const step of SAKURA_STEPS) {
      const tags = [...step.fragment.matchAll(tagRe)].map((m) => m[1]!);
      if (tags.length < 2) continue;
      for (let i = 1; i < tags.length; i += 1) {
        expect(
          thinkingOrderRank(tags[i]!) >= thinkingOrderRank(tags[i - 1]!),
          `${step.id}: fragment out of thinking order: ${tags.join(" → ")}`,
        ).toBe(true);
      }
    }
  });

  it("uses only attributes the geom components actually accept", () => {
    // The finished file is copied into a consumer's own type-checked app, so
    // a spec-level field spelled as a component prop (`render`) type-errors
    // there and nowhere else. Keep the two vocabularies apart.
    const componentProps = new Set([
      "data",
      "aes",
      "alpha",
      "size",
      "anchor",
      "dx",
      "dy",
      "linewidth",
      "stat",
      "fun",
      "window",
      "shape",
      "curve",
      "yintercept",
      "position",
      "positionParams",
      // #1068 / #1065: decorative epoch bands opt out of inspection.
      "inspect",
    ]);
    const children = SAKURA_STEPS.flatMap((step) =>
      Object.values(step.source.children ?? {}),
    ).concat("  <GeomPoint />");
    for (const child of children) {
      for (const match of child.matchAll(/^\s{4}([a-zA-Z]+)=/gm)) {
        const attribute = match[1];
        if (attribute === undefined) throw new Error(`unparsed prop line: ${match[0]}`);
        expect(componentProps.has(attribute), `<Geom…> has no ${attribute} prop`).toBe(true);
      }
      expect(child, "spec-level render hint spelled as a prop").not.toContain("render=");
    }
  });
});

/** ggplot2 thinking-order rank for a GGPlot child tag name (lower = earlier). */
function thinkingOrderRank(tag: string): number {
  if (tag.startsWith("Geom")) return 0;
  if (/^(Scale|Coord|Facet)/.test(tag)) return 1;
  if (/^(Theme|Guide|Labs)/.test(tag)) return 2;
  if (tag === "Inspect") return 3;
  return 1;
}
