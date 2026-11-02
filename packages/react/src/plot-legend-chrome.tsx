import type { ReactNode } from "react";
import type { RenderModel } from "@ggts-sh/core";
import {
  resolveClearControlLayout,
  type InteractiveLegendEntry,
  type InteractionSource,
} from "@ggts-sh/core/interaction";

import { ensureReactPlotChrome } from "./plot-chrome.js";

/** Left side titles reserve leading legend padding that keys skip; start at the key. */
function targetStart(target: InteractiveLegendEntry): number {
  const { titleHeight, titleX, entries } = target.legend;
  const leading = titleHeight === 0 && titleX === 4 && (entries[0]?.x ?? 0) > 0 ? 4 : 0;
  return leading + (target.entry.x ?? 0);
}

function targetLeft(target: InteractiveLegendEntry): number {
  return target.legend.x + targetStart(target);
}

/** Right-hand titles occupy the box beyond this x; hit targets stop before it. */
function contentRight(target: InteractiveLegendEntry): number {
  const { titleHeight, titleX, width } = target.legend;
  return titleHeight === 0 && titleX !== undefined && titleX > 4 ? Math.min(width, titleX) : width;
}

function targetWidth(
  target: InteractiveLegendEntry,
  index: number,
  entries: readonly InteractiveLegendEntry[],
): number {
  const start = targetStart(target);
  if (target.legend.direction !== "horizontal") {
    return Math.max(24, contentRight(target) - start);
  }
  const next = entries[index + 1];
  const end =
    next?.legend === target.legend && next.entry.y === target.entry.y
      ? targetStart(next)
      : contentRight(target);
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
  model: RenderModel;
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
  const clearLayout = resolveClearControlLayout({
    legendFocusEnabled: pressed !== undefined,
    pressedScale: pressed?.identity.scale ?? null,
    legends: props.model.scene.legends,
    sceneWidth: props.model.scene.width,
    sceneHeight: props.model.scene.height,
  });
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
