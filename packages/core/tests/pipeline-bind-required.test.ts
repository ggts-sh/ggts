/**
 * Required-channel checks for bindLayer by geom (#1042 remainder).
 *
 * Before this change `assertRequiredChannels` was an if-chain with no else, so
 * a geom named in none of the arms required nothing and rendered empty instead
 * of erroring. The nine post-alias geoms that fall through today do so for
 * real reasons (params, sample/map_id/geometry, scale training only); those
 * decisions are pinned here. The switch itself ends in `never`, so a new geom
 * is a compile error until someone picks an arm.
 */
import { describe, expect, it } from "bun:test";
import { ALIAS_GEOMS, KNOWN_GEOMS, type NormalizedGeomName } from "@ggts-sh/spec";

import { assertRequiredChannels } from "../src/pipeline/bind-layer-required.ts";
import { PipelineError } from "../src/pipeline/types.ts";

const normalizedGeoms = KNOWN_GEOMS.filter(
  (geom): geom is NormalizedGeomName => !(ALIAS_GEOMS as readonly string[]).includes(geom),
);

/** Geoms that intentionally require no x/y (or edge) channels here. */
const NO_XY_REQUIRED: readonly NormalizedGeomName[] = [
  // Analytic curve: domain from params.xlim / peer layers; y from fun.
  "function",
  // Annotation: slope/intercept params, not mapped channels.
  "abline",
  // Region join: map_id + fortified map (checked in bind-layer-extras / frame).
  "map",
  // GeoJSON geometry column (checked in frame-stats-sf).
  "sf",
  "sf_text",
  "sf_label",
  // Scale training only; no marks.
  "blank",
  // sample channel (checked in bind-layer-extras); theoretical/sample computed.
  "qq",
  "qq_line",
];

/**
 * Catalog-walk set: NO_XY_REQUIRED plus rule (annotation form needs no mapped
 * channel; vertical/horizontal still require an axis — covered separately).
 */
const UNCONSTRAINED_ON_NULL_FIELDS: ReadonlySet<string> = new Set([...NO_XY_REQUIRED, "rule"]);

function base(geom: NormalizedGeomName, overrides: Record<string, unknown> = {}) {
  return {
    geom,
    stat: "identity" as const,
    index: 0,
    ruleForm: null,
    xField: null,
    yField: null,
    yStatColumn: null,
    yminField: null,
    ymaxField: null,
    xminField: null,
    xmaxField: null,
    xendField: null,
    yendField: null,
    angleField: null,
    radiusField: null,
    ...overrides,
  };
}

function expectMissingChannel(run: () => void, channel: string): void {
  try {
    run();
    expect.unreachable(`expected missing-channel for ${channel}`);
  } catch (e) {
    expect(e).toBeInstanceOf(PipelineError);
    expect((e as PipelineError).code).toBe("missing-channel");
    expect((e as PipelineError).path).toContain(channel);
  }
}

describe("assertRequiredChannels (#1042)", () => {
  it("requires x and y for point when y is not stat-computed", () => {
    expectMissingChannel(() => {
      assertRequiredChannels(base("point", { yField: "y" }));
    }, "x");
    expectMissingChannel(() => {
      assertRequiredChannels(base("point", { xField: "x" }));
    }, "y");
    expect(() => {
      assertRequiredChannels(base("point", { xField: "x", yField: "y" }));
    }).not.toThrow();
  });

  it("skips y when yStatColumn is set (e.g. ecdf)", () => {
    expect(() => {
      assertRequiredChannels(base("point", { xField: "x", yStatColumn: "ecdf" }));
    }).not.toThrow();
  });

  it("requires only x for bar", () => {
    expectMissingChannel(() => {
      assertRequiredChannels(base("bar"));
    }, "x");
    expect(() => {
      assertRequiredChannels(base("bar", { xField: "g" }));
    }).not.toThrow();
  });

  it("requires x and y for contour", () => {
    expectMissingChannel(() => {
      assertRequiredChannels(base("contour", { yField: "y" }));
    }, "x");
    expectMissingChannel(() => {
      assertRequiredChannels(base("contour", { xField: "x" }));
    }, "y");
  });

  it("requires ymin/ymax for errorbar identity form", () => {
    expectMissingChannel(() => {
      assertRequiredChannels(base("errorbar", { xField: "x", ymaxField: "hi" }));
    }, "ymin");
  });

  it("requires y (not ymin/ymax) for errorbar under summary stats", () => {
    expectMissingChannel(() => {
      assertRequiredChannels(base("errorbar", { stat: "summary", xField: "x" }));
    }, "y");
    expect(() => {
      assertRequiredChannels(base("errorbar", { stat: "summary", xField: "x", yField: "y" }));
    }).not.toThrow();
  });

  it("requires edge channels for rect", () => {
    expectMissingChannel(() => {
      assertRequiredChannels(
        base("rect", {
          xmaxField: "x1",
          yminField: "y0",
          ymaxField: "y1",
        }),
      );
    }, "xmin");
  });

  it("requires ribbon channels by orientation", () => {
    expectMissingChannel(() => {
      assertRequiredChannels(
        base("ribbon", {
          ribbonOrientation: "x",
          yminField: "lo",
          ymaxField: "hi",
        }),
      );
    }, "x");
    expectMissingChannel(() => {
      assertRequiredChannels(
        base("ribbon", {
          ribbonOrientation: "y",
          xminField: "lo",
          xmaxField: "hi",
        }),
      );
    }, "y");
  });

  it("requires the active axis for data-driven rule forms", () => {
    expectMissingChannel(() => {
      assertRequiredChannels(base("rule", { ruleForm: "vertical" }));
    }, "x");
    expectMissingChannel(() => {
      assertRequiredChannels(base("rule", { ruleForm: "horizontal" }));
    }, "y");
    expect(() => {
      assertRequiredChannels(base("rule", { ruleForm: "annotation" }));
    }).not.toThrow();
  });

  it("requires x/y/xend/yend for segment and curve", () => {
    for (const geom of ["segment", "curve"] as const) {
      expectMissingChannel(() => {
        assertRequiredChannels(
          base(geom, {
            yField: "y",
            xendField: "x2",
            yendField: "y2",
          }),
        );
      }, "x");
    }
  });

  it("requires angle and radius for spoke when params omit them", () => {
    expectMissingChannel(() => {
      assertRequiredChannels(
        base("spoke", {
          xField: "x",
          yField: "y",
          radiusField: "r",
        }),
      );
    }, "angle");
    expect(() => {
      assertRequiredChannels(
        base("spoke", {
          xField: "x",
          yField: "y",
          layerParams: { angle: 0, radius: 1 },
        }),
      );
    }).not.toThrow();
  });

  it("requires rug channels from sides", () => {
    expectMissingChannel(() => {
      assertRequiredChannels(base("rug", { rugSides: "b" }));
    }, "x");
    expectMissingChannel(() => {
      assertRequiredChannels(base("rug", { rugSides: "l" }));
    }, "y");
    expect(() => {
      assertRequiredChannels(base("rug", { rugSides: "b", xField: "x" }));
    }).not.toThrow();
  });

  it("pins the nine geoms that intentionally require no x/y channels", () => {
    for (const geom of NO_XY_REQUIRED) {
      expect(() => {
        assertRequiredChannels(base(geom));
      }).not.toThrow();
    }
  });

  it("every normalized geom either requires a channel or is listed as unconstrained", () => {
    for (const geom of normalizedGeoms) {
      try {
        assertRequiredChannels(
          base(geom, {
            // Give rule a form that does not force a channel so the fall-through
            // check still sees annotation-style rule as unconstrained.
            ruleForm: geom === "rule" ? "annotation" : null,
            // Rug with sides that need x so throw/no-throw still classifies it.
            rugSides: geom === "rug" ? "b" : undefined,
          }),
        );
        // No throw: must be intentionally unconstrained (or rule annotation).
        if (geom === "rug") {
          // rug with side b needs x — should have thrown.
          expect.unreachable("rug with sides b should require x");
        }
        expect(UNCONSTRAINED_ON_NULL_FIELDS.has(geom)).toBe(true);
      } catch (e) {
        expect(e).toBeInstanceOf(PipelineError);
        expect((e as PipelineError).code).toBe("missing-channel");
        expect(UNCONSTRAINED_ON_NULL_FIELDS.has(geom)).toBe(false);
      }
    }
  });
});
