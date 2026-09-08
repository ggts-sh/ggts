/**
 * Shared fixtures for component-level interaction integration suites.
 * Per-suite helpers (drag, pointerMoveAt) stay local to their files.
 */
import type { RenderModel } from "@ggts-sh/core";

export const rows = [
  { x: 1, y: 10, cls: "a" },
  { x: 2, y: 20, cls: "b" },
  { x: 3, y: 15, cls: "a" },
  { x: 4, y: 25, cls: "b" },
];

export const size = { width: 480, height: 320 };

export function requireModel(model: RenderModel | null): RenderModel {
  if (model === null) throw new Error("expected render model");
  return model;
}

/** Plot-space pointer drag on a capture surface (size-normalized like r0 helpers). */
export function drag(capture: Element, x0: number, y0: number, x1: number, y1: number): void {
  const rect = capture.getBoundingClientRect();
  const opts = (x: number, y: number) => ({
    clientX: rect.left + (x / size.width) * rect.width,
    clientY: rect.top + (y / size.height) * rect.height,
    bubbles: true,
    button: 0,
    pointerId: 1,
  });
  capture.dispatchEvent(new PointerEvent("pointerdown", opts(x0, y0)));
  capture.dispatchEvent(new PointerEvent("pointermove", opts((x0 + x1) / 2, (y0 + y1) / 2)));
  capture.dispatchEvent(new PointerEvent("pointerup", opts(x1, y1)));
}
