/**
 * Labs-scoped spec-lint behavior (`missing-axis-title`, issue #1960).
 */
import { describe, expect, it } from "bun:test";

import { LINT_CATALOG, lintSpec, type SpecAdvisory } from "../src/lint.ts";
import { validate } from "../src/validate.ts";

const axisAdvisories = (advisories: SpecAdvisory[]) =>
  advisories.filter((a) => a.code === "missing-axis-title");

describe("missing-axis-title (#1960)", () => {
  it("emits missing-axis-title for absent labs.x and whitespace labs.y on the issue repro", () => {
    const repro = {
      width: 960,
      height: 480,
      layers: [
        {
          geom: "col",
          aes: { x: { field: "nace_section" }, y: { field: "n" } },
        },
      ],
      scales: { x: { type: "band" }, y: { type: "linear" } },
      labs: { title: "Citas por sector", y: " " },
      data: { columns: { nace_section: ["A", "B", "C"], n: [4, 7, 2] } },
    };

    const hits = axisAdvisories(lintSpec(repro));
    expect(hits.map((a) => a.path)).toEqual(["/labs/x", "/labs/y"]);

    const [xHit, yHit] = hits;
    expect(xHit!.message).toContain("nace_section");
    expect(xHit!.message).toContain("Nace section");
    expect(xHit!.suggestion?.example).toEqual({ labs: { x: "Nace section" } });
    expect(xHit!.suggestion?.description).toMatch(/measure|unit/i);

    expect(yHit!.message).toContain('"n"');
    expect(yHit!.message).toMatch(/renders nothing|blank/i);
    expect(yHit!.suggestion?.example).toEqual({ labs: { y: "n" } });
    expect(yHit!.suggestion?.description).toMatch(/measure|unit/i);

    expect(LINT_CATALOG["missing-axis-title"].summary.length).toBeGreaterThan(0);
    expect(LINT_CATALOG["missing-axis-title"].needs).toBe("spec");
    expect(LINT_CATALOG["missing-axis-title"].rationale).toBe(
      "Every positional channel that carries meaning needs an axis title. An absent title falls back to the humanized column name, and a blank title renders nothing; neither tells the reader what the axis measures.",
    );
  });

  it("works from spec alone without inline data or DataProfile (needs: spec)", () => {
    const hits = axisAdvisories(
      lintSpec({
        labs: { title: "Quarterly revenue" },
        layers: [{ geom: "line", aes: { x: { field: "fiscal_quarter" }, y: { field: "rev" } } }],
      }),
    );
    expect(hits.map((a) => a.path)).toEqual(["/labs/x", "/labs/y"]);
    expect(hits[0]!.suggestion?.example).toEqual({ labs: { x: "Fiscal quarter" } });
    expect(hits[1]!.suggestion?.example).toEqual({ labs: { y: "rev" } });
  });

  it("stays silent when non-blank labs.x and labs.y are authored", () => {
    const advisories = lintSpec({
      labs: { title: "Sector citations", x: "NACE sector", y: "Citations (count)" },
      layers: [{ geom: "col", aes: { x: { field: "nace_section" }, y: { field: "n" } } }],
      scales: { x: { type: "band" }, y: { type: "linear" } },
      data: { columns: { nace_section: ["A", "B", "C"], n: [4, 7, 2] } },
    });
    expect(advisories).toEqual([]);
  });

  it("fires for empty string, whitespace-only, and null labs entries", () => {
    const emptyHit = axisAdvisories(
      lintSpec({
        labs: { title: "T", x: "", y: "Count" },
        layers: [{ geom: "point", aes: { x: { field: "gdp_per_capita" }, y: { field: "n" } } }],
      }),
    );
    expect(emptyHit.map((a) => a.path)).toEqual(["/labs/x"]);
    expect(emptyHit[0]!.message).toContain("blank");

    const tabHit = axisAdvisories(
      lintSpec({
        labs: { title: "T", x: "GDP", y: " \t " },
        layers: [{ geom: "point", aes: { x: { field: "gdp" }, y: { field: "life_exp" } } }],
      }),
    );
    expect(tabHit.map((a) => a.path)).toEqual(["/labs/y"]);
    expect(tabHit[0]!.message).toContain("blank");

    const nullHit = axisAdvisories(
      lintSpec({
        labs: { title: "T", x: null, y: "Life expectancy" },
        layers: [{ geom: "point", aes: { x: { field: "gdp_per_capita" }, y: { field: "le" } } }],
      }),
    );
    expect(nullHit.map((a) => a.path)).toEqual(["/labs/x"]);
    expect(nullHit[0]!.message).toContain("Gdp per capita");
  });

  it("ignores stat-only channels, unmapped bar y, and constant value channels", () => {
    const statY = axisAdvisories(
      lintSpec({
        labs: { title: "T", x: "Category" },
        layers: [{ geom: "bar", aes: { x: { field: "cat" }, y: { stat: "count" } } }],
      }),
    );
    expect(statY).toEqual([]);

    const unmappedBarY = axisAdvisories(
      lintSpec({
        labs: { title: "T", x: "Category" },
        layers: [{ geom: "bar", aes: { x: { field: "cat" } } }],
      }),
    );
    expect(unmappedBarY).toEqual([]);

    const constantY = axisAdvisories(
      lintSpec({
        labs: { title: "T", x: "Time" },
        layers: [{ geom: "point", aes: { x: { field: "t" }, y: { value: 1 } } }],
      }),
    );
    expect(constantY).toEqual([]);

    const statX = axisAdvisories(
      lintSpec({
        labs: { title: "T", y: "Value" },
        layers: [{ geom: "point", aes: { x: { stat: "bin" }, y: { field: "v" } } }],
      }),
    );
    expect(statX).toEqual([]);
  });

  it("handles plot aes inheritance, layer null unsetting, and bare-string sugar", () => {
    const inherited = axisAdvisories(
      lintSpec({
        labs: { title: "T" },
        aes: { x: "bloom_year", y: "petal_width" },
        layers: [{ geom: "point" }],
      }),
    );
    expect(inherited.map((a) => a.path)).toEqual(["/labs/x", "/labs/y"]);
    expect(inherited[0]!.suggestion?.example).toEqual({ labs: { x: "Bloom year" } });
    expect(inherited[1]!.suggestion?.example).toEqual({ labs: { y: "Petal width" } });

    const unsetY = axisAdvisories(
      lintSpec({
        labs: { title: "T", x: "Year" },
        aes: { x: { field: "year" }, y: { field: "unused_y" } },
        layers: [{ geom: "bar", aes: { y: null } }],
      }),
    );
    expect(unsetY).toEqual([]);
  });

  it("respects annotation-form rule/hline/vline/abline and data-driven hline/vline", () => {
    const annotationsOnly = axisAdvisories(
      lintSpec({
        labs: { title: "T" },
        aes: { x: { field: "x_field" }, y: { field: "y_field" } },
        layers: [
          { geom: "hline", params: { yintercept: 0 } },
          { geom: "vline", params: { xintercept: 10 } },
          { geom: "rule", params: { yintercept: 5 } },
          { geom: "abline", params: { slope: 1, intercept: 0 } },
        ],
      }),
    );
    expect(annotationsOnly).toEqual([]);

    const dataHline = axisAdvisories(
      lintSpec({
        labs: { title: "T" },
        aes: { x: { field: "ignored_x" }, y: { field: "threshold_y" } },
        layers: [{ geom: "hline" }],
      }),
    );
    expect(dataHline.map((a) => a.path)).toEqual(["/labs/y"]);
    expect(dataHline[0]!.message).toContain("threshold_y");

    const dataVline = axisAdvisories(
      lintSpec({
        labs: { title: "T" },
        aes: { x: { field: "cutoff_x" }, y: { field: "ignored_y" } },
        layers: [{ geom: "vline" }],
      }),
    );
    expect(dataVline.map((a) => a.path)).toEqual(["/labs/x"]);
    expect(dataVline[0]!.message).toContain("cutoff_x");

    const annotationThenPoint = axisAdvisories(
      lintSpec({
        labs: { title: "T" },
        aes: { x: { field: "x_field" }, y: { field: "y_field" } },
        layers: [{ geom: "hline", params: { yintercept: 0 } }, { geom: "point" }],
      }),
    );
    expect(annotationThenPoint.map((a) => a.path)).toEqual(["/labs/x", "/labs/y"]);
  });

  it("emits at most once per axis using the first mapped layer field", () => {
    const hits = axisAdvisories(
      lintSpec({
        labs: { title: "T" },
        layers: [
          { geom: "point", aes: { x: { field: "first_x" }, y: { field: "first_y" } } },
          { geom: "line", aes: { x: { field: "second_x" }, y: { field: "second_y" } } },
        ],
      }),
    );
    expect(hits.map((a) => a.path)).toEqual(["/labs/x", "/labs/y"]);
    expect(hits[0]!.message).toContain("first_x");
    expect(hits[0]!.message).not.toContain("second_x");
    expect(hits[1]!.message).toContain("first_y");
    expect(hits[1]!.message).not.toContain("second_y");
  });

  it("wires into validate({ lint: true }) alongside valid and invalid specs", () => {
    const okResult = validate(
      {
        data: { columns: { x_val: [1, 2, 3], y_val: [4, 5, 6] } },
        labs: { title: "Scatter" },
        layers: [{ geom: "point", aes: { x: { field: "x_val" }, y: { field: "y_val" } } }],
      },
      { lint: true },
    );
    expect(okResult.ok).toBe(true);
    expect(axisAdvisories(okResult.advisories ?? []).map((a) => a.path)).toEqual([
      "/labs/x",
      "/labs/y",
    ]);
  });

  it("tolerates malformed and non-record inputs without throwing", () => {
    expect(lintSpec(null)).toEqual([]);
    expect(lintSpec(42)).toEqual([]);
    expect(lintSpec({ layers: "bad" })).toEqual([]);
    expect(
      axisAdvisories(
        lintSpec({
          labs: { title: "T", x: 123, y: ["bad"] },
          layers: [
            null,
            { geom: "point", aes: { x: 123, y: [] } },
            { geom: "point", aes: { x: { field: "valid_x" }, y: { field: "valid_y" } } },
          ],
        }),
      ),
    ).toEqual([]);
    expect(
      axisAdvisories(
        lintSpec({
          labs: [],
          layers: [{ geom: "point", aes: { x: { field: "" }, y: { field: "ok_y" } } }],
        }),
      ).map((a) => a.path),
    ).toEqual(["/labs/y"]);
  });
});
