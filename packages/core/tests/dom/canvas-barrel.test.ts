import { describe, expect, it } from "bun:test";

import * as dom from "../../src/dom/index.ts";
import { drawClippedToPanel, sizeCanvasForDpr } from "../../src/dom/canvas-dom.ts";
import { recordingContext } from "./canvas-fixtures.ts";

/**
 * Locks the published `@ggts-sh/core/dom` barrel surface used by
 * packages/svelte stratum-paint (cssColorResolver / drawStratum / sizeCanvasForDpr)
 * plus the other documented barrel exports.
 */
describe("@ggts-sh/core/dom barrel surface", () => {
  it("exports the contracted value symbols", () => {
    expect(typeof dom.cssColorResolver).toBe("function");
    expect(typeof dom.sizeCanvasForDpr).toBe("function");
    expect(typeof dom.drawClippedToPanel).toBe("function");
    expect(typeof dom.drawBatch).toBe("function");
    expect(typeof dom.drawStratum).toBe("function");
    expect(typeof dom.StaticQuadtree).toBe("function");
  });
});

describe("canvas DOM helpers", () => {
  it("drawClippedToPanel clips when panel.clip is not false", () => {
    const { ctx, calls } = recordingContext();
    let drew = false;
    drawClippedToPanel(ctx, { x: 1, y: 2, width: 3, height: 4 }, () => {
      drew = true;
    });
    expect(drew).toBe(true);
    expect(calls.map((c) => c.name)).toEqual(["save", "beginPath", "rect", "clip", "restore"]);
    expect(calls.find((c) => c.name === "rect")?.args).toEqual([1, 2, 3, 4]);
  });

  it("drawClippedToPanel skips clip when panel.clip is false", () => {
    const { ctx, calls } = recordingContext();
    let drew = false;
    drawClippedToPanel(ctx, { x: 0, y: 0, width: 1, height: 1, clip: false }, () => {
      drew = true;
    });
    expect(drew).toBe(true);
    expect(calls).toEqual([]);
  });

  it("sizeCanvasForDpr sets backing store, CSS box, and absolute dpr transform", () => {
    const transforms: number[][] = [];
    const canvas = {
      width: 0,
      height: 0,
      style: { width: "", height: "" },
    };
    const ctx = {
      setTransform(...args: number[]) {
        transforms.push(args);
      },
    };
    sizeCanvasForDpr(
      canvas as unknown as HTMLCanvasElement,
      ctx as unknown as CanvasRenderingContext2D,
      100,
      50,
      2,
    );
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(100);
    expect(canvas.style.width).toBe("100px");
    expect(canvas.style.height).toBe("50px");
    expect(transforms).toEqual([[2, 0, 0, 2, 0, 0]]);
  });
});
