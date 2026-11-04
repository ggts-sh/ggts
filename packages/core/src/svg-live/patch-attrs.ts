/**
 * Shared attribute-diffing utilities for the positional SVG mark patchers
 * (#1471). Each patcher computes the exact attribute map the corresponding
 * emitter in ../render-svg-marks.ts would serialize — same names, same px()
 * formatting, same conditional-omission rules — then writes only the
 * differences onto the mounted DOM node. A same-value write still dirties the
 * node in Chromium's style engine, so unchanged channels must be skipped.
 */
import type { ThemeTokens } from "../theme.js";
import { px } from "../render-svg-format.js";

export interface BatchPatchContext {
  theme: ThemeTokens;
  paintMode: "full" | "fallback";
  /** Document id scope of the mounted svg ({@link svgIdScope}, #1902). */
  idScope: string;
}

/** Attribute value map: name → serialized value; ABSENT value is "". */
export type AttrMap = Record<string, string>;

/** Write the diff between two emitter-exact attribute maps onto a node. */
export function writeAttrs(el: Element, next: AttrMap, prev: AttrMap): void {
  for (const name of Object.keys(next)) {
    const n = next[name]!;
    if (n === (prev[name] ?? "")) continue;
    if (n === "") el.removeAttribute(name);
    else el.setAttribute(name, n);
  }
  for (const name of Object.keys(prev)) {
    if (!(name in next) && prev[name] !== "") el.removeAttribute(name);
  }
}

/** Write the opacity attr following alphaAttr's omission rule (absent at 1). */
export function writeAlpha(el: Element, alpha: number): void {
  if (alpha === 1) el.removeAttribute("opacity");
  else el.setAttribute("opacity", px(alpha));
}

/** Write-if-changed with removal support: "" means the attr must be absent. */
export function writeOrRemove(el: Element, name: string, vN: string, vP: string): void {
  if (vN === vP) return;
  if (vN === "") el.removeAttribute(name);
  else el.setAttribute(name, vN);
}
