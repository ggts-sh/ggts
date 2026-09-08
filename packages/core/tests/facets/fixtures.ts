/**
 * Shared fixtures for facets / render integration characterization.
 */
import { aes, gg } from "@ggts-sh/spec";

export const size = { width: 640, height: 400 };

export const wrapRows = [
  { x: 1, y: 10, g: "b", cls: "u" },
  { x: 2, y: 20, g: "b", cls: "v" },
  { x: 1, y: 30, g: "a", cls: "u" },
  { x: 2, y: 40, g: "a", cls: "v" },
  { x: 1, y: 500, g: "c", cls: "u" },
  { x: 2, y: 900, g: "c", cls: "v" },
];

export function wrapSpec(scales?: "fixed" | "free" | "free_x" | "free_y") {
  return gg(wrapRows, aes({ x: "x", y: "y", color: "cls" }))
    .geomPoint()
    .facet({ wrap: "g", ...(scales !== undefined && { scales }) })
    .spec();
}
