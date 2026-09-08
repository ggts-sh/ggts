/**
 * Gate G8 — annotations that do not fight the chart. Measured against the
 * rendered scene, not the spec: label pockets, leader sides, and baseline
 * weight are all layout claims.
 */
import { describe, expect, it } from "bun:test";
import { renderToSVGString, runPipeline } from "@ggts-sh/core";
import {
  SAKURA_BASELINE,
  SAKURA_FINISHED_SVELTE,
  SAKURA_RECORDS,
  SAKURA_STEPS,
  foldSakura,
} from "../quickstart.ts";
import { makeRows } from "./test-helpers.ts";

const rows = makeRows();

describe("gate G8 — annotations that do not fight the chart", () => {
  const finishedSpec = () => foldSakura(SAKURA_STEPS.length, rows).spec;

  it("labels the baseline where the least data sits", () => {
    // The reference tags the rule with the single word "median", below it.
    // Measured placement search over the rendered scene: below the rule at
    // the left edge is the one pocket whose box touches no trend vertex and
    // exactly one faint bloom (the 891 observation) at any wide width — every
    // other candidate sits on more data. Pin that measurement so the tag
    // cannot drift back onto the scatter (it overprinted ~20 blooms when
    // placed at the right edge).
    for (const width of [768, 900]) {
      const model = runPipeline(finishedSpec(), { width, height: 330 });
      const glyphs = model.scene.batches.find(
        (batch) => batch.kind === "glyphs" && batch.texts.includes("median"),
      );
      expect(glyphs, `baseline tag missing at ${width}`).toBeDefined();
      if (glyphs === undefined || glyphs.kind !== "glyphs") continue;
      const i = glyphs.texts.indexOf("median");
      const gx = glyphs.positions[i * 2]!;
      const gy = glyphs.positions[i * 2 + 1]!;
      const bw = glyphs.boxWidths![i]!;
      const bh = glyphs.boxHeights![i]!;
      // anchor start; the SVG renderer draws text with dy 0.32em, so the ink
      // spans roughly [gy − 0.75·bh, gy + 0.25·bh].
      const box = { x0: gx - 1, x1: gx + bw + 1, y0: gy - bh * 0.75 - 1, y1: gy + bh * 0.25 + 1 };
      const { points, trend } = countHitsInBox(model.scene.batches, box);
      expect(trend, `baseline tag crosses the trend at ${width}px`).toBe(0);
      expect(points, `baseline tag overprints ${points} blooms at ${width}px`).toBeLessThanOrEqual(
        1,
      );
    }
  });

  it("keeps no-answer decoration out of inspection", () => {
    // A yintercept rule synthesizes an empty row; when it wins the
    // nearest-candidate race the tooltip renders nothing — the same #1068
    // capture the bands and names already opt out of.
    const spec = finishedSpec() as {
      layers: { geom: string; inspect?: boolean }[];
    };
    const rules = spec.layers.filter((layer) => layer.geom === "rule");
    expect(rules.length).toBe(3);
    for (const rule of rules) expect(rule.inspect, "rule layer stays inspectable").toBe(false);
    // …and the copyable file mirrors the opt-out on every GeomRule.
    const ruleTags = SAKURA_FINISHED_SVELTE.match(/<GeomRule[\s\S]*?\/>/g) ?? [];
    expect(ruleTags.length).toBe(3);
    for (const tag of ruleTags) expect(tag).toContain("inspect={false}");
  });

  it("names the bands where the reader is looking, with no legend", () => {
    const spec = finishedSpec() as {
      guides?: { fill?: { type: string } };
      labs?: { fill?: string };
    };
    expect(spec.guides?.fill?.type).toBe("none");
    expect(spec.labs?.fill).toBeUndefined();

    const names = (
      finishedSpec() as { layers: { geom: string; data?: { values?: unknown[] } }[] }
    ).layers
      .filter((layer) => layer.geom === "text")
      .flatMap((layer) => (layer.data?.values ?? []) as { epoch?: string }[])
      .map((row) => row.epoch)
      .filter(Boolean);
    expect(names).toEqual(["Medieval warm period", "Little Ice Age", "Industrial era"]);
  });

  it("sits epoch names above the band rects, which still cover every observation", () => {
    // Labels live in a domain strip above the pale fills — not painted on the
    // fill. Band top stays earlier than the earliest bloom so every point is
    // still inside a climate band; domain expands above the band for names.
    type EpochRow = { top: string; bottom: string; epoch: string };
    type NameRow = { nameDate: string; epoch: string };
    const folded = finishedSpec() as {
      layers: { geom: string; data?: { values?: unknown[] } }[];
      scales?: { y?: { domain?: string[] } };
    };
    const epochs = folded.layers.find((layer) => layer.geom === "rect")?.data?.values as
      | EpochRow[]
      | undefined;
    const nameRows = folded.layers
      .filter((layer) => layer.geom === "text")
      .flatMap((layer) => (layer.data?.values ?? []) as NameRow[])
      .filter((row) => typeof row.nameDate === "string");
    expect(epochs?.length).toBe(3);
    expect(nameRows.length).toBe(3);

    const bandTop = epochs![0]!.top;
    const nameDate = nameRows[0]!.nameDate;
    // On a reverse month-day axis, earlier (smaller MM-DD) is higher. Names
    // must be earlier than the band top so they sit above the rect.
    expect(nameDate < bandTop, `${nameDate} should be earlier than band top ${bandTop}`).toBe(true);
    for (const band of epochs!) {
      expect(band.top).toBe(bandTop);
    }

    // Earliest observation in the series is 25 March — band top must stay at
    // or earlier than that so the rect still encompasses every point.
    const earliestBloom = rows
      .map((row) => {
        const bloomDate = row["bloomDate"];
        return typeof bloomDate === "string" ? bloomDate.slice(-5) : "";
      })
      .filter((md) => md !== "")
      .toSorted()[0]!;
    expect(bandTop <= earliestBloom).toBe(true);

    // domain is [later bottom, earlier top] in the fold; top must clear names.
    const domain = folded.scales?.y?.domain;
    expect(domain).toBeDefined();
    const domainTop = domain![1]!;
    expect(domainTop <= nameDate, `domain top ${domainTop} must clear name ${nameDate}`).toBe(true);

    // Rendered: epoch name screen-y is above (strictly smaller than) band rect top.
    const svg = renderToSVGString(finishedSpec(), { width: 900, height: 480 });
    const labelY = Number(
      svg.match(/<text[^>]*\by="([\d.]+)"[^>]*>Medieval warm period<\/text>/)?.[1],
    );
    expect(Number.isFinite(labelY), "epoch name text has a y").toBe(true);
    const bandTops = ["#f5edc4", "#dce8f2", "#f3dcda"].map((fill) => {
      const tag = svg.match(new RegExp(`<rect[^>]*fill="${fill}"[^>]*>`))?.[0] ?? "";
      return Number(tag.match(/\by="([\d.]+)"/)?.[1]);
    });
    expect(bandTops.every((top) => Number.isFinite(top))).toBe(true);
    for (const top of bandTops) {
      expect(labelY, `label y ${String(labelY)} vs band top ${String(top)}`).toBeLessThan(top);
    }
  });

  it("states the record as well as the claim, with a middle dot", () => {
    for (const record of SAKURA_RECORDS) {
      expect(record.label, record.label).toContain(" · ");
      expect(record.label, record.label).not.toContain("—");
      // A callout asserting significance without the value makes the reader
      // hunt for the number the annotation exists to deliver.
      expect(record.label, record.label).toMatch(/\b(March|April|May) \d{1,2}\b/);
    }
  });

  it("keeps every leader on the far side of its own label", () => {
    // There is no text repel (#727 gap B), so these positions are hand-computed
    // against a layout nobody can see — the exact condition that let leaders
    // cross their text before. Anchoring at the end only works while every
    // label stays left of the point it names; this is what pins that.
    for (const record of SAKURA_RECORDS) {
      expect(record.labelYear, record.label).toBeLessThan(record.year);
    }
    const callouts = (
      finishedSpec() as { layers: { geom: string; params?: Record<string, unknown> }[] }
    ).layers
      .filter((layer) => layer.geom === "text")
      .map((layer) => layer.params?.["anchor"]);
    expect(callouts).toContain("end");
  });

  it("draws a baseline strong enough to read without caption chrome", () => {
    const spec = finishedSpec() as {
      layers: { geom: string; params?: Record<string, unknown> }[];
      labs?: { caption?: string; title?: string; subtitle?: string };
    };
    const rule = spec.layers.find(
      (layer) => layer.geom === "rule" && layer.params?.["yintercept"] === SAKURA_BASELINE,
    );
    expect(rule).toBeDefined();
    expect(rule?.params?.["linewidth"]).toBeGreaterThanOrEqual(1);
    // Caption/title/subtitle would squash the data panel; citation lives on
    // a host footnote instead of layer text.
    expect(spec.labs?.caption).toBeUndefined();
    expect(spec.labs?.title).toBeUndefined();
    expect(spec.labs?.subtitle).toBeUndefined();
  });
});

/** Count point and path vertices that fall inside a text-glyph bounding box. */
function countHitsInBox(
  batches: ReturnType<typeof runPipeline>["scene"]["batches"],
  box: { x0: number; x1: number; y0: number; y1: number },
): { points: number; trend: number } {
  let points = 0;
  let trend = 0;
  for (const batch of batches) {
    if (batch.kind !== "points" && batch.kind !== "paths") continue;
    for (let p = 0; p < batch.positions.length / 2; p += 1) {
      const px = batch.positions[p * 2]!;
      const py = batch.positions[p * 2 + 1]!;
      if (px < box.x0 || px > box.x1 || py < box.y0 || py > box.y1) continue;
      if (batch.kind === "points") points += 1;
      else trend += 1;
    }
  }
  return { points, trend };
}
