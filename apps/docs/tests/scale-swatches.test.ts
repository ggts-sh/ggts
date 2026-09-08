import { describe, expect, it } from "vitest";
import { SCALE_REFERENCE } from "@ggts-sh/spec";

import { scaleSwatchFor } from "../src/lib/catalog/scale-swatches";

describe("scaleSwatchFor", () => {
  it("returns null for non color/fill scales", () => {
    expect(scaleSwatchFor(SCALE_REFERENCE.x_continuous)).toBeNull();
    expect(scaleSwatchFor(SCALE_REFERENCE.y_log10)).toBeNull();
    expect(scaleSwatchFor(SCALE_REFERENCE.size_continuous)).toBeNull();
  });

  it("covers every color-fill scale with a non-empty swatch", () => {
    const colorFill = Object.values(SCALE_REFERENCE).filter(
      (entry) => entry.family === "color-fill",
    );
    expect(colorFill.length).toBeGreaterThan(20);
    for (const entry of colorFill) {
      const swatch = scaleSwatchFor(entry);
      expect(swatch, entry.slug).not.toBeNull();
      expect(swatch!.colors.length, entry.slug).toBeGreaterThan(0);
      for (const color of swatch!.colors) {
        expect(color, entry.slug).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
      expect(swatch!.caption.length, entry.slug).toBeGreaterThan(0);
    }
  });

  it("maps discrete defaults to observable10 and continuous to viridis", () => {
    const discrete = scaleSwatchFor(SCALE_REFERENCE.color_discrete)!;
    expect(discrete.kind).toBe("discrete");
    expect(discrete.colors[0]).toBe("#4269d0");
    expect(discrete.caption).toContain("observable10");

    const continuous = scaleSwatchFor(SCALE_REFERENCE.fill_continuous)!;
    expect(continuous.kind).toBe("ramp");
    expect(continuous.colors[0]).toBe("#440154");
    expect(continuous.caption).toContain("viridis");
  });

  it("shows ColorBrewer examples for brewer/distiller/fermenter", () => {
    const brewer = scaleSwatchFor(SCALE_REFERENCE.color_brewer)!;
    expect(brewer.kind).toBe("discrete");
    expect(brewer.caption).toContain("Set1");
    expect(brewer.colors[0]).toBe("#e41a1c");

    const distiller = scaleSwatchFor(SCALE_REFERENCE.fill_distiller)!;
    expect(distiller.kind).toBe("ramp");
    expect(distiller.caption).toContain("Blues");
    expect(distiller.colors.length).toBeGreaterThanOrEqual(7);
  });

  it("shows gradient default stop ramps", () => {
    const gradient = scaleSwatchFor(SCALE_REFERENCE.color_gradient)!;
    expect(gradient.kind).toBe("ramp");
    expect(gradient.colors[0]?.toLowerCase()).toBe("#132b43");
    expect(gradient.colors.at(-1)?.toLowerCase()).toBe("#56b1f7");
  });
});
