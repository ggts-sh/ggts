/**
 * Position transform — minor-breaks.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import { size } from "./fixtures.ts";

describe("numeric minor breaks", () => {
  it("renders in-domain minor gridlines and suppresses values coincident with majors", () => {
    const model = runPipeline(
      gg(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .scales({ x: { breaks: [0, 10], minorBreaks: [2, 5, 10] } })
        .spec(),
      size,
    );
    expect(model.scene.panels[0]?.grid.minorX).toHaveLength(2);
    const major = new Set(model.scene.panels[0]?.grid.x ?? []);
    expect((model.scene.panels[0]?.grid.minorX ?? []).every((value) => !major.has(value))).toBe(
      true,
    );

    const flipped = runPipeline(
      gg(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .scales({ x: { breaks: [0, 10], minorBreaks: [2, 5, 10] } })
        .coordFlip()
        .spec(),
      size,
    );
    expect(flipped.scene.panels[0]?.grid.minorY).toHaveLength(2);
  });
});
