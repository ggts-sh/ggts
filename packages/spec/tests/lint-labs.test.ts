/** Labs-scoped spec-lint behavior: missing-chart-title (issue #1959). */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "../src/builder.ts";
import { LINT_CATALOG, lintSpec, type SpecAdvisory } from "../src/lint.ts";
import { validate } from "../src/validate.ts";

const CODE = "missing-chart-title";

const codesOf = (advisories: SpecAdvisory[]) => advisories.map((a) => a.code);

const titleAdvisories = (
  spec: unknown,
  ...rest: Parameters<typeof lintSpec> extends [unknown, ...infer R] ? R : never
) => lintSpec(spec, ...rest).filter((a) => a.code === CODE);

const issue1959Repro = () => ({
  width: 960,
  height: 480,
  layers: [{ geom: "line", aes: { x: { field: "year" }, y: { field: "n" } } }],
  scales: { x: { type: "linear" }, y: { type: "linear" } },
  labs: { subtitle: "Normas restrictivas publicadas por año", x: "Año", y: "Normas" },
  data: { columns: { year: [2019, 2020, 2021, 2022], n: [12, 9, 14, 7] } },
});

describe("missing-chart-title", () => {
  it("registers catalog metadata with needs: spec and expected rationale", () => {
    const entry = LINT_CATALOG[CODE];
    expect(entry.needs).toBe("spec");
    expect(entry.summary).toBe("A chart with a subtitle or layer data has no labs.title.");
    expect(entry.rationale).toBe(
      "A title states the chart's message. A subtitle without a title leaves the chart unnamed, and a heading outside the spec is host chrome that is not part of the chart.",
    );
  });

  it("fires on the issue #1959 repro via lintSpec and validate({ lint: true })", () => {
    const repro = issue1959Repro();
    const advisories = lintSpec(repro);
    expect(codesOf(advisories)).toEqual([CODE]);
    const hit = advisories[0]!;
    expect(hit.path).toBe("/labs");
    expect(hit.message).toContain("labs.subtitle");
    expect(hit.message).toContain("labs.title");
    expect(hit.suggestion?.example).toEqual({ labs: { title: "..." } });
    expect(hit.suggestion?.description).toContain("subtitle");

    const result = validate(repro, { lint: true });
    expect(result.ok).toBe(true);
    expect(codesOf(result.advisories ?? [])).toEqual([CODE]);
  });

  it("fires on subtitle without title even when no layer has data", () => {
    const advisories = lintSpec({
      labs: { subtitle: "Subordinate line" },
      layers: [{ geom: "point" }],
    });
    expect(codesOf(advisories)).toEqual([CODE]);
    expect(advisories[0]!.path).toBe("/labs");
    expect(advisories[0]!.message).toContain("labs.subtitle");
  });

  it("fires on layer data without title and uses data-without-title messaging", () => {
    const advisories = lintSpec({
      data: { values: [{ x: 1, y: 2 }] },
      aes: { x: { field: "x" }, y: { field: "y" } },
      labs: { x: "X", y: "Y" },
      layers: [{ geom: "point" }],
    });
    expect(codesOf(advisories)).toEqual([CODE]);
    expect(advisories[0]!.path).toBe("/labs");
    expect(advisories[0]!.message).toContain("layer data");
    expect(advisories[0]!.suggestion?.example).toEqual({ labs: { title: "..." } });
  });

  it("stays silent when labs.title is a non-blank string (with or without subtitle/data)", () => {
    expect(
      lintSpec({
        ...issue1959Repro(),
        labs: {
          title: "Restrictive rules fell after 2021",
          subtitle: "Normas restrictivas publicadas por año",
          x: "Año",
          y: "Normas",
        },
      }),
    ).toEqual([]);

    expect(
      lintSpec({
        data: { values: [{ x: 1, y: 2 }] },
        aes: { x: { field: "x" }, y: { field: "y" } },
        labs: { title: "Title only", x: "X", y: "Y" },
        layers: [{ geom: "point" }],
      }),
    ).toEqual([]);

    expect(
      lintSpec({
        labs: { title: "Standalone", subtitle: "Sub" },
        layers: [{ geom: "point" }],
      }),
    ).toEqual([]);
  });

  it("fires when labs.title is absent, undefined, empty, whitespace-only, or non-string", () => {
    const baseData = {
      data: { columns: { x: [1, 2], y: [3, 4] } },
      aes: { x: { field: "x" }, y: { field: "y" } },
      layers: [{ geom: "point" }],
    };
    for (const labs of [
      undefined,
      null,
      "bad-labs",
      { x: "x", y: "y" },
      { title: undefined, x: "x", y: "y" },
      { title: "", x: "x", y: "y" },
      { title: "   \t\n ", x: "x", y: "y" },
      { title: 123, x: "x", y: "y" },
    ]) {
      const spec = labs === undefined ? baseData : { ...baseData, labs };
      expect(codesOf(titleAdvisories(spec))).toEqual([CODE]);
    }
  });

  it("stays silent when labs.subtitle is empty, whitespace-only, or non-string without data", () => {
    for (const subtitle of ["", "   \t\n ", 123, null]) {
      expect(
        lintSpec({
          labs: { subtitle },
          layers: [{ geom: "point" }],
        }),
      ).toEqual([]);
    }
  });

  it("stays silent when spec has no title, no subtitle, and no layer data", () => {
    expect(lintSpec({ layers: [{ geom: "point" }] })).toEqual([]);
    expect(
      lintSpec({
        aes: { x: { field: "x" }, y: { field: "y" } },
        labs: { x: "x", y: "y" },
        layers: [{ geom: "point" }],
      }),
    ).toEqual([]);
  });

  it("stays silent for data-less partial specs even when a DataProfile is supplied", () => {
    const advisories = lintSpec(
      {
        aes: { x: { field: "x" }, y: { field: "y" } },
        labs: { x: "x", y: "y" },
        layers: [{ geom: "point" }],
      },
      {
        profile: {
          fields: [
            { name: "x", type: "quantitative" },
            { name: "y", type: "quantitative" },
          ],
        },
      },
    );
    expect(advisories).toEqual([]);
  });

  it("handles fluent builder partial specs (silent) vs data-bearing builder specs (fires)", () => {
    const partial = gg().geomPoint().toPortable();
    expect(titleAdvisories(partial)).toEqual([]);

    const withData = gg(
      [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
      aes({ x: "x", y: "y" }),
    )
      .labs({ x: "x", y: "y" })
      .geomPoint()
      .spec();
    expect(codesOf(lintSpec(withData))).toEqual([CODE]);

    const titled = gg(
      [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
      aes({ x: "x", y: "y" }),
    )
      .labs({ title: "Points", x: "x", y: "y" })
      .geomPoint()
      .spec();
    expect(lintSpec(titled)).toEqual([]);
  });

  it("fires on layer-level data when plot-level spec.data is absent", () => {
    const advisories = lintSpec({
      labs: { x: "x", y: "y" },
      layers: [
        {
          geom: "point",
          data: { values: [{ x: 1, y: 2 }] },
          aes: { x: { field: "x" }, y: { field: "y" } },
        },
      ],
    });
    expect(codesOf(advisories)).toEqual([CODE]);
  });

  it("stays silent on empty or invalid data containers without subtitle", () => {
    const emptyRefs = [{ values: [] }, { columns: {} }, { columns: { x: [] } }, {}, null, "bad"];
    for (const data of emptyRefs) {
      expect(
        lintSpec({
          data,
          aes: { x: { field: "x" }, y: { field: "y" } },
          labs: { x: "x", y: "y" },
          layers: [{ geom: "point" }],
        }),
      ).toEqual([]);
    }

    // Layer overriding non-empty plot data with empty data leaves zero layers with data.
    expect(
      lintSpec({
        data: { values: [{ x: 1, y: 2 }] },
        aes: { x: { field: "x" }, y: { field: "y" } },
        labs: { x: "x", y: "y" },
        layers: [{ geom: "point", data: { values: [] } }],
      }),
    ).toEqual([]);
  });

  it("handles named DataRef with and without spec.datasets", () => {
    // Runtime / CLI --data named dataset without spec.datasets: fires.
    expect(
      codesOf(
        lintSpec({
          data: { name: "cars" },
          aes: { x: { field: "x" }, y: { field: "y" } },
          labs: { x: "x", y: "y" },
          layers: [{ geom: "point" }],
        }),
      ),
    ).toEqual([CODE]);

    // Named dataset in spec.datasets with rows: fires.
    expect(
      codesOf(
        lintSpec({
          data: { name: "cars" },
          datasets: { cars: { values: [{ x: 1, y: 2 }] } },
          aes: { x: { field: "x" }, y: { field: "y" } },
          labs: { x: "x", y: "y" },
          layers: [{ geom: "point" }],
        }),
      ),
    ).toEqual([CODE]);

    // Named dataset in spec.datasets with empty rows: silent.
    expect(
      lintSpec({
        data: { name: "cars" },
        datasets: { cars: { values: [] } },
        aes: { x: { field: "x" }, y: { field: "y" } },
        labs: { x: "x", y: "y" },
        layers: [{ geom: "point" }],
      }),
    ).toEqual([]);

    // Non-recursive named dataset reference in datasets stays safe and silent.
    expect(
      lintSpec({
        data: { name: "cars" },
        datasets: { cars: { name: "other" } },
        aes: { x: { field: "x" }, y: { field: "y" } },
        labs: { x: "x", y: "y" },
        layers: [{ geom: "point" }],
      }),
    ).toEqual([]);
  });

  it("treats layers: [] as having no layer data while still catching subtitle without title", () => {
    expect(
      lintSpec({
        data: { values: [{ x: 1, y: 2 }] },
        labs: { x: "x", y: "y" },
        layers: [],
      }),
    ).toEqual([]);

    expect(
      codesOf(
        lintSpec({
          labs: { subtitle: "Sub without layers" },
          layers: [],
        }),
      ),
    ).toEqual([CODE]);
  });

  it("stays silent on non-object specs", () => {
    expect(lintSpec("not-a-spec")).toEqual([]);
    expect(lintSpec(null)).toEqual([]);
  });

  it("runs regardless of whether sharedEvidence/sharedLayerEvidence are omitted or null", () => {
    const repro = issue1959Repro();
    expect(codesOf(lintSpec(repro))).toEqual([CODE]);
    expect(codesOf(lintSpec(repro, {}, null, null))).toEqual([CODE]);
  });
});
