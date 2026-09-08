/**
 * Fast, network-free tests for the held-out eval harness:
 *  (a) corpus integrity — every case parses, ids are unique, golds are
 *      canonical (normalize() fixed points), validate against their profile,
 *      and render headlessly with their inline data;
 *  (b) the full dry-run pipeline end-to-end over ALL cases with the
 *      deterministic MockResponder (including the repair round and refusals);
 *  (c) score.ts unit tests hitting each rubric component and the 0.8
 *      threshold boundary.
 */
import { describe, expect, test } from "bun:test";

import type { PortableSpec, SpecInput } from "@ggts-sh/spec";
import { KNOWN_GEOMS, normalize, validate } from "@ggts-sh/spec";

import { collectCoverage } from "./coverage.ts";
import { MockResponder } from "./model.ts";
import {
  bindingSimilarity,
  extrasSimilarity,
  gate,
  geomSimilarity,
  mulberry32,
  parseReply,
  PASS_STRUCTURAL,
  renderCheck,
  stripFences,
  structuralScore,
  synthesizeRows,
} from "./score.ts";
import { loadCases, runEvals } from "./run.ts";
import type { EvalCase } from "./types.ts";

const cases = loadCases();
const byKind = (kind: EvalCase["kind"]) => cases.filter((c) => c.kind === kind);

// ---------------------------------------------------------------------------
// (a) corpus integrity
// ---------------------------------------------------------------------------

describe("case corpus", () => {
  test("has 44+ cases with the required adversarial mix", () => {
    expect(cases.length).toBeGreaterThanOrEqual(44);
    expect(byKind("adversarial-unsupported").length).toBeGreaterThanOrEqual(2);
    expect(byKind("adversarial-missing-field").length).toBeGreaterThanOrEqual(3);
    expect(byKind("adversarial-ambiguous").length).toBeGreaterThanOrEqual(3);
  });

  test("ids are unique and every case is well-formed", () => {
    const ids = new Set<string>();
    for (const c of cases) {
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);
      expect(c.prompt.length).toBeGreaterThan(0);
      expect(c.notes.length).toBeGreaterThan(0);
      expect(Array.isArray(c.dataProfile.fields)).toBe(true);
      expect(c.dataProfile.fields.length).toBeGreaterThan(0);
      if (c.expectRefusal) {
        expect(c.gold).toBeNull();
      } else {
        expect(c.gold).not.toBeNull();
      }
      if (c.data !== null) {
        for (const rows of Object.values(c.data)) {
          expect(rows.length).toBeGreaterThan(0);
          expect(rows.length).toBeLessThanOrEqual(40);
        }
      }
    }
  });

  test("every geom is covered at least twice across the corpus", () => {
    // Canonical golds store sugar geoms expanded: bar+bin → histogram,
    // line+bin → freqpoly (#796); point+position jitter → jitter;
    // rule annotation intercepts → hline/vline (#818).
    const counts = new Map<string, number>();
    for (const c of cases) {
      if (c.gold === null) continue;
      for (const layer of c.gold.layers as Array<{
        geom: string;
        stat?: string;
        position?: string;
        params?: { xintercept?: unknown; yintercept?: unknown };
      }>) {
        const params = layer.params ?? {};
        const name =
          layer.geom === "bar" && layer.stat === "bin"
            ? "histogram"
            : layer.geom === "line" && layer.stat === "bin"
              ? "freqpoly"
              : layer.geom === "point" && layer.position === "jitter"
                ? "jitter"
                : layer.geom === "rule" && params.yintercept !== undefined
                  ? "hline"
                  : layer.geom === "rule" && params.xintercept !== undefined
                    ? "vline"
                    : layer.geom;
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    for (const geom of KNOWN_GEOMS) {
      expect(counts.get(geom) ?? 0).toBeGreaterThanOrEqual(2);
    }
  });

  test("stat/position/facet/coord/scale coverage", () => {
    const { stats, positions, facts } = collectCoverage(cases);
    for (const stat of ["count", "bin", "smooth", "boxplot", "density", "summary"]) {
      expect(stats.has(stat)).toBe(true);
    }
    for (const position of ["stack", "fill", "dodge", "jitter", "nudge"]) {
      expect(positions.has(position)).toBe(true);
    }
    for (const fact of [
      "smooth:lm",
      "smooth:loess",
      "facet:wrap",
      "facet:grid",
      "facet:free",
      "coord:flip",
      "scale:pos:log10",
      "scale:pos:time",
      "scale:colorish:sequential",
    ]) {
      expect(facts.has(fact)).toBe(true);
    }
  });

  test(
    "golds are canonical, valid against their profile, and render",
    () => {
      for (const c of cases) {
        if (c.gold === null) continue;
        const result = validate(c.gold, { profile: c.dataProfile });
        if (!result.ok) {
          throw new Error(`${c.id}: gold invalid: ${JSON.stringify(result.errors)}`);
        }
        // Canonical = a normalize() fixed point.
        expect(normalize(c.gold as unknown as SpecInput)).toEqual(c.gold);
        const render = renderCheck(c.gold, c);
        if (!render.ok) throw new Error(`${c.id}: gold render failed: ${render.error}`);
      }
    },
    { timeout: 60_000 },
  );
});

// ---------------------------------------------------------------------------
// (b) end-to-end dry-run with the MockResponder
// ---------------------------------------------------------------------------

describe("dry-run pipeline", () => {
  // Corpus keeps growing (hex, qq, range geoms, …); give the mock pass room.
  test(
    "runs all cases, exercises repair, and scores refusals",
    async () => {
      const board = await runEvals({
        dryRun: true,
        responder: new MockResponder(),
        writeOutputs: false,
        quiet: true,
      });
      expect(board.meta.caseCount).toBe(cases.length);
      expect(board.meta.dryRun).toBe(true);

      // The mock purposely handles the chart corpus: assert a pass-rate floor.
      const chartScores = board.cases.filter((c) => c.kind === "chart");
      const chartPassRate = chartScores.filter((c) => c.pass).length / chartScores.length;
      expect(chartPassRate).toBeGreaterThanOrEqual(0.85);

      // The repair round is exercised: at least one case is invalid on the
      // first attempt and valid after the repair call.
      const repairedToValid = board.cases.filter(
        (c) => !c.validity && c.repaired && c.validityAfterRepair,
      );
      expect(repairedToValid.length).toBeGreaterThanOrEqual(1);
      expect(repairedToValid.some((c) => c.pass)).toBe(true);

      // Refusal cases score correctly.
      for (const score of board.cases.filter((c) => c.expectRefusal)) {
        expect(score.refused).toBe(true);
        expect(score.pass).toBe(true);
        expect(score.structural).toBeNull();
      }
      expect(board.totals.refusalAccuracy).toBe(1);

      for (const value of Object.values(board.totals)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    },
    { timeout: 60_000 },
  );

  test("repair can be disabled", async () => {
    const board = await runEvals({
      dryRun: true,
      responder: new MockResponder(),
      writeOutputs: false,
      quiet: true,
      repair: false,
      cases: ["12-power-stepped-line"],
    });
    const score = board.cases[0]!;
    expect(score.validity).toBe(false);
    expect(score.repaired).toBe(false);
    expect(score.validityAfterRepair).toBe(false);
    expect(score.pass).toBe(false);
  });
});

describe("MockResponder map refusal", () => {
  const profileLine =
    'DataProfile (JSON):{"fields":[{"name":"revenue","type":"quantitative"},{"name":"state","type":"nominal"},{"name":"region","type":"nominal"},{"name":"y","type":"quantitative"},{"name":"station","type":"nominal"}]}';

  test("refuses geographic map phrasing that is not an aesthetic mapping", async () => {
    const mock = new MockResponder();
    const reply = await mock.complete("", `map revenue to state on a US map.\n${profileLine}`);
    const parsed = JSON.parse(reply) as { unsupported?: string };
    expect(typeof parsed.unsupported).toBe("string");
  });

  test("still allows aesthetic map-to-channel phrases", async () => {
    const mock = new MockResponder();
    const reply = await mock.complete(
      "",
      `Scatter of y by station and map region to color.\n${profileLine}`,
    );
    const parsed = JSON.parse(reply) as {
      layers?: unknown[];
      unsupported?: string;
    };
    expect(parsed.unsupported).toBeUndefined();
    expect(Array.isArray(parsed.layers)).toBe(true);
  });

  test("allows continuous/discrete scale modifiers before color/fill/style channels", async () => {
    const mock = new MockResponder();
    for (const prompt of [
      "map z to continuous fill",
      "map region to discrete color",
      "map magnitude to continuous point size",
    ]) {
      const reply = await mock.complete("", `${prompt}.\n${profileLine}`);
      const parsed = JSON.parse(reply) as { unsupported?: string };
      expect(parsed.unsupported, `should allow aesthetic mapping: ${prompt}`).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// (c) score.ts unit tests
// ---------------------------------------------------------------------------

const PROFILE = {
  fields: [
    { name: "a", type: "quantitative" as const },
    { name: "b", type: "quantitative" as const },
    { name: "g", type: "nominal" as const },
  ],
};

function spec(input: SpecInput): PortableSpec {
  return normalize(input);
}

describe("reply parsing", () => {
  test("strips markdown fences", () => {
    expect(stripFences('```json\n{"x":1}\n```')).toBe('{"x":1}');
    expect(stripFences('{"x":1}')).toBe('{"x":1}');
  });

  test("classifies refusals, specs, and garbage", () => {
    expect(parseReply('{"unsupported":"no maps","closestAlternative":null}').kind).toBe("refusal");
    expect(parseReply('{"layers":[{"geom":"point"}]}').kind).toBe("spec");
    expect(parseReply("sorry, I cannot").kind).toBe("unparseable");
  });
});

describe("hard gate", () => {
  test("normalizes then validates against the profile", () => {
    const ok = gate(
      {
        data: { name: "main" },
        layers: [{ geom: "point", aes: { x: { field: "a" }, y: { field: "b" } } }],
      },
      PROFILE,
    );
    expect(ok.ok).toBe(true);
    expect(ok.spec).not.toBeNull();

    const badField = gate(
      {
        layers: [{ geom: "point", aes: { x: { field: "nope" }, y: { field: "b" } } }],
      },
      PROFILE,
    );
    expect(badField.ok).toBe(false);
    expect(badField.errors.some((e) => e.code === "unknown-field")).toBe(true);

    const badGeom = gate({ layers: [{ geom: "sparkline" }] }, PROFILE);
    expect(badGeom.ok).toBe(false);
    expect(badGeom.errors.some((e) => e.code === "unknown-geom")).toBe(true);
  });
});

describe("structural rubric", () => {
  const gold = spec({
    aes: { x: "a", y: "b" },
    layers: [{ geom: "point" }, { geom: "smooth" }],
  });

  test("geom component: multiset similarity", () => {
    expect(
      geomSimilarity(
        gold,
        spec({
          aes: { x: "a", y: "b" },
          layers: [{ geom: "point" }, { geom: "smooth" }],
        }),
      ),
    ).toBe(1);
    expect(
      geomSimilarity(gold, spec({ aes: { x: "a", y: "b" }, layers: [{ geom: "point" }] })),
    ).toBe(0.5);
    expect(
      geomSimilarity(
        gold,
        spec({
          aes: { x: "a", y: "b" },
          layers: [{ geom: "line" }, { geom: "line" }],
        }),
      ),
    ).toBe(0);
    // Duplicates count as a multiset, not a set.
    expect(
      geomSimilarity(
        spec({
          aes: { x: "a", y: "b" },
          layers: [{ geom: "point" }, { geom: "point" }],
        }),
        spec({ aes: { x: "a", y: "b" }, layers: [{ geom: "point" }] }),
      ),
    ).toBe(0.5);
  });

  test("binding component: (channel, field) agreement over aligned layers", () => {
    const exact = spec({
      aes: { x: "a", y: "b" },
      layers: [{ geom: "point" }, { geom: "smooth" }],
    });
    expect(bindingSimilarity(gold, exact)).toBe(1);

    // Swapped axes: 0 of the union match.
    const swapped = spec({
      aes: { x: "b", y: "a" },
      layers: [{ geom: "point" }, { geom: "smooth" }],
    });
    expect(bindingSimilarity(gold, swapped)).toBe(0);

    // One extra channel on the candidate enlarges the union.
    const extra = spec({
      aes: { x: "a", y: "b" },
      layers: [{ geom: "point", aes: { color: "g" } }, { geom: "smooth" }],
    });
    expect(bindingSimilarity(gold, extra)).toBeCloseTo(4 / 5, 10);
  });

  test("extras component: fraction of gold's non-default facts", () => {
    const goldExtras = spec({
      aes: { x: "g", y: "a" },
      layers: [{ geom: "col", position: "dodge" }],
      coord: { type: "flip" },
      scales: { y: { type: "log" } },
      facet: { wrap: "g" },
    });
    // 4 facts: facet.wrap=g, coord=flip, scales.y.type=log, position:col=dodge.
    expect(extrasSimilarity(goldExtras, goldExtras)).toBe(1);
    const half = spec({
      aes: { x: "g", y: "a" },
      layers: [{ geom: "col", position: "dodge" }],
      coord: { type: "flip" },
    });
    expect(extrasSimilarity(goldExtras, half)).toBe(0.5);
    // A gold with no non-default facts always scores 1.
    const plain = spec({
      aes: { x: "a", y: "b" },
      layers: [{ geom: "point" }],
    });
    expect(extrasSimilarity(plain, goldExtras)).toBe(1);
  });

  test("0.8 threshold boundary", () => {
    // Gold with extras facts; candidate matches geoms + bindings exactly but
    // reproduces NO facts: total = 0.4 + 0.4 + 0 = 0.8 — exactly at PASS.
    const goldWithFacts = spec({
      aes: { x: "a", y: "b" },
      layers: [{ geom: "point" }],
      scales: { y: { type: "log" } },
    });
    const noFacts = spec({
      aes: { x: "a", y: "b" },
      layers: [{ geom: "point" }],
    });
    const atBoundary = structuralScore(goldWithFacts, noFacts);
    expect(atBoundary.total).toBe(0.8);
    expect(atBoundary.total >= PASS_STRUCTURAL).toBe(true);

    // Drop one of two bindings as well: 0.4 + 0.2 + 0 = 0.6 — below PASS.
    const missingY = spec({ aes: { x: "a" }, layers: [{ geom: "point" }] });
    const below = structuralScore(goldWithFacts, missingY);
    expect(below.total).toBeCloseTo(0.6, 10);
    expect(below.total >= PASS_STRUCTURAL).toBe(false);
  });
});

describe("render check + synth data", () => {
  test("mulberry32 and synthesizeRows are deterministic", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(synthesizeRows(PROFILE)).toEqual(synthesizeRows(PROFILE));
    expect(synthesizeRows(PROFILE)).toHaveLength(20);
  });

  test("renders a candidate against synthesized rows when a case has no data", () => {
    const candidate = spec({
      data: { name: "main" },
      aes: { x: "a", y: "b" },
      layers: [{ geom: "point" }],
    });
    const evalCase: EvalCase = {
      id: "synthetic",
      kind: "chart",
      prompt: "p",
      dataProfile: PROFILE,
      data: null,
      gold: candidate,
      expectRefusal: false,
      notes: "n",
    };
    expect(renderCheck(candidate, evalCase).ok).toBe(true);
  });

  test("reports structured render failures", () => {
    const candidate = spec({
      data: { name: "main" },
      aes: { x: "missing_column", y: "b" },
      layers: [{ geom: "point" }],
    });
    const evalCase: EvalCase = {
      id: "synthetic-fail",
      kind: "chart",
      prompt: "p",
      dataProfile: PROFILE,
      data: { main: [{ a: 1, b: 2, g: "x" }] },
      gold: null,
      expectRefusal: false,
      notes: "n",
    };
    const result = renderCheck(candidate, evalCase);
    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe("string");
  });
});
