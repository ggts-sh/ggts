/**
 * #828 scale_*_viridis_{c,d,b} authoring helpers.
 */
import { describe, expect, it } from "bun:test";

import {
  scaleColorViridisB,
  scaleColorViridisC,
  scaleColorViridisD,
  scaleColourViridisC,
  scaleFillViridisC,
  scaleFillViridisD,
  scale_color_viridis_b,
  scale_color_viridis_c,
  scale_color_viridis_d,
  scale_colour_viridis_c,
  scale_fill_viridis_c,
  validate,
} from "../src/index.js";

const point = { geom: "point" as const };

describe("viridis named scale helpers (#828)", () => {
  it("exports binding-identical colour/snake aliases", () => {
    expect(scaleColourViridisC).toBe(scaleColorViridisC);
    expect(scale_color_viridis_c).toBe(scaleColorViridisC);
    expect(scale_colour_viridis_c).toBe(scaleColorViridisC);
    expect(scale_color_viridis_d).toBe(scaleColorViridisD);
    expect(scale_color_viridis_b).toBe(scaleColorViridisB);
    expect(scale_fill_viridis_c).toBe(scaleFillViridisC);
  });

  it("emits continuous / discrete / binned PortableSpec with default scheme viridis", () => {
    expect(scaleColorViridisC()).toEqual({
      color: { type: "sequential", scheme: "viridis" },
    });
    expect(scaleColorViridisD()).toEqual({
      color: { type: "ordinal", scheme: "viridis" },
    });
    expect(scaleColorViridisB()).toEqual({
      color: { type: "binned", scheme: "viridis" },
    });
    expect(scaleFillViridisC({ option: "plasma" })).toEqual({
      fill: { type: "sequential", scheme: "plasma" },
    });
  });

  it("rejects the removed magma option and portable scheme", () => {
    expect(() => scaleColorViridisC({ option: "magma" as "viridis" })).toThrow(
      /Unknown viridis option/,
    );
    for (const channel of ["color", "fill"]) {
      for (const type of ["sequential", "ordinal", "binned"]) {
        const spec = {
          data: { values: [{ x: 1, y: 2 }] },
          aes: { x: { field: "x" }, y: { field: "y" } },
          layers: [point],
          scales: { [channel]: { type, scheme: "magma" } },
        };
        expect(validate(spec).ok).toBe(false);
        spec.scales[channel]!.scheme = "inferno";
        expect(validate(spec).ok).toBe(true);
      }
    }
  });

  it("rejects unknown option names loudly", () => {
    expect(() => scaleColorViridisC({ option: "A" as "viridis" })).toThrow(
      /Unknown viridis option/,
    );
  });

  it("validates continuous, discrete, and binned viridis specs", () => {
    for (const scales of [
      scaleColorViridisC(),
      scaleColorViridisD(),
      scaleColorViridisB({ breaks: [0, 1, 2] }),
      scaleFillViridisD({ option: "inferno" }),
    ]) {
      const result = validate({
        data: { values: [{ x: 1, y: 2, c: "a", v: 1 }] },
        aes: {
          x: { field: "x" },
          y: { field: "y" },
          color: { field: scales.color === undefined ? "v" : "c" },
          ...(scales.fill !== undefined && { fill: { field: "c" } }),
        },
        layers: [point],
        scales,
      });
      expect(result.ok, JSON.stringify(result)).toBe(true);
    }
  });
});
