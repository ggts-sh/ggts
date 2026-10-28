/**
 * Error-catalog coverage (M3 audit): every code in ERROR_CATALOG must be
 * reproducible by validate(), with its message/fix snapshot-tested here in
 * one place. Adding a catalog code without a trigger — or a trigger whose
 * code silently changes — fails this test.
 */
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "bun:test";

import { ERROR_CATALOG, ERROR_CODES } from "../src/errors.ts";
import type { SpecErrorCode } from "../src/errors.ts";
import type { ValidateOptions } from "../src/validate-data.ts";
import { validate } from "../src/validate.ts";

interface Trigger {
  spec: unknown;
  options?: ValidateOptions;
}

const point = { geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } };
const xy = { values: [{ x: 1, y: 2 }] };

/** One minimal trigger per catalog code. */
const TRIGGERS: Record<SpecErrorCode, Trigger> = {
  "invalid-spec-root": { spec: 42 },
  "missing-layers": { spec: {} },
  "empty-layers": { spec: { layers: [] } },
  "invalid-layer": { spec: { layers: [42] } },
  "missing-geom": { spec: { layers: [{}] } },
  "unknown-geom": { spec: { layers: [{ geom: "pont" }] } },
  "invalid-channel-value": { spec: { layers: [{ geom: "point", aes: { x: "displ" } }] } },
  "unexpected-property": { spec: { layers: [point], labz: {} } },
  "missing-property": { spec: { layers: [point], coord: {} } },
  "invalid-enum-value": { spec: { layers: [point], coord: { type: "polar" } } },
  "value-out-of-range": { spec: { layers: [point], width: -5 } },
  "invalid-data": { spec: { layers: [point], data: { rows: [] } } },
  "invalid-type": { spec: { layers: [point], width: "wide" } },
  "scale-scheme-type": {
    spec: { layers: [point], scales: { color: { type: "sequential", scheme: "ipsum" } } },
  },
  "scale-scheme-oob": {
    spec: {
      layers: [point],
      scales: { color: { type: "sequential", scheme: "romaO", domain: [0, 360], oob: "censor" } },
    },
  },
  "scale-cyclic-domain": {
    spec: { layers: [point], scales: { color: { type: "sequential", scheme: "romaO" } } },
  },
  "scale-range-color": {
    spec: { layers: [point], scales: { color: { range: ["tomato"] } } },
  },
  "scale-type-transform-conflict": {
    spec: {
      layers: [point],
      scales: { color: { type: "sequential", temporalKind: "date", transform: "sqrt" } },
    },
  },
  "color-manual-domain-range": {
    spec: {
      layers: [point],
      scales: { color: { type: "manual", domain: ["a", "b"], range: ["#f00"] } },
    },
  },
  "scale-binned-breaks": {
    spec: {
      layers: [point],
      scales: { size: { type: "binned", breaks: [10, 5, 0] } },
    },
  },
  "scale-binned-domain": {
    spec: {
      layers: [point],
      scales: { size: { type: "binned", domain: [0, 50], breaks: [0, 5, 10] } },
    },
  },
  "guide-aesthetic-incompatible": {
    spec: { layers: [point], scales: { x: { guide: { type: "legend" } } } },
  },
  "coord-fixed-free-scales": {
    spec: {
      layers: [point],
      coord: { type: "fixed" },
      facet: { wrap: { field: "group" }, scales: "free_x" },
    },
  },
  "missing-required-channel": { spec: { layers: [{ geom: "point" }] }, options: {} },
  "rule-form-ambiguous": {
    spec: {
      layers: [{ geom: "rule", aes: { x: { field: "x" } }, params: { yintercept: 0 } }],
    },
    options: {},
  },
  "rule-form-missing": { spec: { layers: [{ geom: "rule" }] }, options: {} },
  "rule-both-axes": {
    spec: { layers: [{ geom: "rule", aes: { x: { field: "x" }, y: { field: "y" } } }] },
    options: {},
  },
  "computed-y-mapped": {
    spec: { layers: [{ geom: "bar", aes: { x: { field: "x" }, y: { field: "y" } } }] },
    options: {},
  },
  "bin-center-and-boundary": {
    spec: {
      layers: [
        { geom: "histogram", aes: { x: { field: "x" } }, params: { center: 0, boundary: 0 } },
      ],
    },
    options: {},
  },
  "manual-fun-required": {
    spec: {
      layers: [
        {
          geom: "point",
          stat: "manual",
          aes: { x: { field: "x" }, y: { field: "y" } },
        },
      ],
    },
    options: {},
  },
  "summary-rolling-window-required": {
    spec: {
      layers: [
        {
          geom: "line",
          stat: "summary_rolling",
          aes: { x: { field: "x" }, y: { field: "y" } },
        },
      ],
    },
    options: {},
  },
  "summary-fun-unsupported": {
    spec: {
      layers: [
        {
          geom: "line",
          stat: "summary_rolling",
          aes: { x: { field: "x" }, y: { field: "y" } },
          params: { window: 30, fun: "first" },
        },
      ],
    },
    options: {},
  },
  "facet-form-ambiguous": {
    spec: {
      layers: [point],
      facet: { wrap: { field: "g" }, rows: { field: "h" } },
    },
    options: {},
  },
  "facet-form-missing": { spec: { layers: [point], facet: {} }, options: {} },
  "facet-ncol-without-wrap": {
    spec: { layers: [point], facet: { rows: { field: "g" }, ncol: 2 } },
    options: {},
  },
  "facet-space-without-grid": {
    spec: { layers: [point], facet: { wrap: { field: "g" }, space: "free_x" } },
  },
  "scale-labels-breaks-length": {
    spec: { layers: [point], scales: { x: { breaks: [4, 14], labels: ["Group A"] } } },
  },
  "unsupported-geom-aesthetic": {
    spec: {
      layers: [
        {
          geom: "line",
          aes: { x: { field: "x" }, y: { field: "y" }, size: { field: "x" } },
        },
      ],
    },
    options: {},
  },
  "ribbon-orientation-ambiguous": {
    spec: {
      layers: [
        {
          geom: "ribbon",
          aes: {
            x: { field: "x" },
            y: { field: "y" },
            ymin: { field: "ymin" },
            ymax: { field: "ymax" },
            xmin: { field: "xmin" },
            xmax: { field: "xmax" },
          },
        },
      ],
    },
    options: {},
  },
  "paint-stops-unordered": {
    spec: {
      layers: [
        {
          geom: "ribbon",
          aes: {
            x: { field: "x" },
            ymin: { field: "lo" },
            ymax: { field: "hi" },
          },
          params: {
            fillPaint: {
              type: "linear",
              x1: 0,
              y1: 0,
              x2: 1,
              y2: 0,
              stops: [
                { offset: 0.9, color: "#000000" },
                { offset: 0.1, color: "#ffffff" },
              ],
              fallback: "#000000",
            },
          },
        },
      ],
    },
    options: {},
  },
  "paint-scale-conflict": {
    spec: {
      layers: [
        {
          geom: "ribbon",
          aes: {
            x: { field: "x" },
            ymin: { field: "lo" },
            ymax: { field: "hi" },
            fill: { field: "g" },
          },
          params: {
            fillPaint: {
              type: "linear",
              x1: 0,
              y1: 0,
              x2: 1,
              y2: 0,
              stops: [
                { offset: 0, color: "#000000" },
                { offset: 1, color: "#ffffff" },
              ],
              fallback: "#000000",
            },
          },
        },
      ],
    },
    options: {},
  },
  "unknown-field": {
    spec: { data: xy, layers: [{ geom: "point", aes: { x: { field: "xx" }, y: { field: "y" } } }] },
    options: {},
  },
  "all-null-column": {
    spec: {
      data: { values: [{ x: null, y: 1 }] },
      layers: [point],
    },
    options: {},
  },
  "scale-type-mismatch": {
    spec: { data: xy, layers: [point], scales: { x: { type: "time" } } },
    options: {},
  },
  "channel-type-mismatch": {
    spec: {
      data: { values: [{ k: "a", y: 1 }] },
      layers: [{ geom: "smooth", aes: { x: { field: "k" }, y: { field: "y" } } }],
    },
    options: {},
  },
  "unknown-stat-column": {
    spec: {
      data: xy,
      layers: [{ geom: "point", aes: { x: { field: "x" }, y: { stat: "count" } } }],
    },
    options: {},
  },
  "invalid-data-profile": {
    spec: { layers: [point] },
    // Intentionally malformed profile type (not a valid DataProfile field type).
    options: { profile: fromAny({ fields: [{ name: "x", type: "numeric" }] }) },
  },
  "validation-limit": {
    spec: { data: { values: [{ x: 1 }, { x: 2 }] }, layers: [point] },
    options: { limits: { maxRows: 1 } },
  },
};

describe("ERROR_CATALOG coverage", () => {
  it("has a trigger for every code and no extras", () => {
    expect(Object.keys(TRIGGERS).toSorted()).toEqual([...ERROR_CODES].toSorted());
  });

  for (const code of ERROR_CODES) {
    it(`[${code}] is reproducible; message + fix snapshot`, () => {
      const { spec, options } = TRIGGERS[code];
      const result = options === undefined ? validate(spec) : validate(spec, options);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      const hit = result.errors.find((e) => e.code === code);
      expect(hit?.code).toBe(code);
      expect({ catalog: ERROR_CATALOG[code], instance: hit }).toMatchSnapshot();
    });
  }
});
