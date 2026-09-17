import type { ReactNode } from "react";
import type { InteractiveLegendEntry, InteractionSource } from "@ggts-sh/core/interaction";

import { ensureReactPlotChrome } from "./plot-chrome.js";

function targetLeft(target: InteractiveLegendEntry): number {
  return target.legend.x + (target.legend.direction === "horizontal" ? (target.entry.x ?? 0) : 0);
}

function targetWidth(
  target: InteractiveLegendEntry,
  index: number,
  entries: readonly InteractiveLegendEntry[],
): number {
  if (target.legend.direction !== "horizontal") return Math.max(24, target.legend.width);
  const start = target.entry.x ?? 0;
  const next = entries[index + 1];
  const end =
    next?.legend === target.legend && next.entry.y === target.entry.y
      ? (next.entry.x ?? target.legend.width)
      : target.legend.width;
  return Math.max(24, end - start);
}

function targetAriaLabel(target: InteractiveLegendEntry): string {
  const scale = target.identity.scale;
  const aesthetics = target.legend.aesthetics ?? [scale];
  return `${target.legend.title || scale}: ${target.entry.fullLabel ?? target.entry.label} (${aesthetics.join(" + ")} legend)`;
}

function sameIdentity(
  left: InteractiveLegendEntry["identity"] | null,
  right: InteractiveLegendEntry["identity"],
): boolean {
  return left !== null && left.scale === right.scale && left.entryIndex === right.entryIndex;
}

export function ReactLegendChrome(props: {
  entries: readonly InteractiveLegendEntry[];
  previewIdentity: InteractiveLegendEntry["identity"] | null;
  pressedIdentity: InteractiveLegendEntry["identity"] | null;
  focusEntry: (entry: InteractiveLegendEntry, source: InteractionSource, commit: boolean) => void;
  clearPreview: (source: InteractionSource) => void;
  clearFocus: (source: InteractionSource) => void;
}): ReactNode {
  ensureReactPlotChrome();
  const { entries } = props;
  if (entries.length === 0) return null;
  const pressed = entries.find((entry) => sameIdentity(props.pressedIdentity, entry.identity));
  const clearLayout =
    pressed === undefined
      ? null
      : {
          left: pressed.legend.x,
          top: pressed.legend.y + pressed.legend.height + 4,
        };
  return (
    <div className="gg-legend-chrome">
      <div className="gg-legend-targets" role="group" aria-label="Interactive legends">
        {entries.map((target, index) => (
          <button
            key={`${target.identity.scale}:${String(target.identity.entryIndex)}`}
            type="button"
            className={`gg-legend-target${sameIdentity(props.previewIdentity, target.identity) ? " gg-legend-target-active" : ""}`}
            aria-label={targetAriaLabel(target)}
            aria-pressed={sameIdentity(props.pressedIdentity, target.identity)}
            style={{
              left: targetLeft(target),
              top: target.legend.y + target.entry.y,
              width: targetWidth(target, index, entries),
              height: Math.max(24, target.entry.height ?? 24),
            }}
            onPointerEnter={(event) => {
              if (event.pointerType !== "touch") props.focusEntry(target, "pointer", false);
            }}
            onPointerLeave={() => {
              props.clearPreview("pointer");
            }}
            onFocus={() => {
              props.focusEntry(target, "keyboard", false);
            }}
            onBlur={() => {
              props.clearPreview("keyboard");
            }}
            onClick={(event) => {
              props.focusEntry(target, event.detail === 0 ? "keyboard" : "pointer", true);
            }}
          >
            <span className="gg-legend-target-label">{target.entry.label}</span>
          </button>
        ))}
      </div>
      {clearLayout !== null && (
        <button
          type="button"
          className="gg-legend-clear"
          aria-label="Clear legend focus"
          style={{ left: clearLayout.left, top: clearLayout.top }}
          onClick={() => {
            props.clearFocus("pointer");
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}
