import type { CandidateFacts, CellValue, PlotRect, RenderModel } from "@ggts-sh/core";
import {
  anchorsFromCandidateKeys,
  applyEmphasisRingDensityGate,
  crosshairGapForBox,
  crosshairGlyphObstacles,
  glyphExtentsFromBatch,
  gappedCrosshairSegmentsWithObstacles,
  glyphHoverBox,
  hoverChromeForKind,
  HOVER_CROSSHAIR_GAP_RADIUS,
} from "@ggts-sh/core/interaction";
import type { PlotInspectionChange, PresentationAnchor } from "@ggts-sh/core/interaction";

function Anchor({
  anchor,
  className,
  radius,
}: {
  anchor: PresentationAnchor;
  className: string;
  radius: number;
}) {
  if (anchor.chrome === "none") return null;
  if (anchor.chrome === "ring")
    return (
      <circle
        className={className}
        cx={anchor.x}
        cy={anchor.y}
        r={radius}
        fill="none"
        stroke="Highlight"
        strokeWidth={2}
      />
    );
  const box = glyphHoverBox(anchor, {
    width: anchor.width,
    height: anchor.height,
    textAnchor: anchor.textAnchor,
  });
  return (
    <rect className={className} {...box} rx={2} fill="none" stroke="Highlight" strokeWidth={2} />
  );
}

function candidateExtent(model: RenderModel, candidate: CandidateFacts) {
  const batch = model.scene.batches[candidate.batchIndex];
  return batch?.kind === "glyphs" ? glyphExtentsFromBatch(batch, candidate.primitiveIndex) : null;
}

function hoverGuides(
  model: RenderModel,
  inspection: PlotInspectionChange<Record<string, CellValue>, PropertyKey> | null,
  seed: CandidateFacts | null,
  flipped: boolean,
) {
  if (inspection === null) return { hover: null, lines: [] };
  const focus = inspection.focus;
  const panel = model.viewport.panelAtOrOnly(focus.anchor);
  const chrome = hoverChromeForKind(seed?.kind);
  const dimensions = seed === null ? null : candidateExtent(model, seed);
  const hover = { ...focus.anchor, chrome, ...dimensions };
  if (panel === null) return { hover, lines: [] };
  const obstacles = crosshairGlyphObstacles(model.scene.batches, model.scene.panels, panel.id);
  const gap =
    chrome === "ring"
      ? HOVER_CROSSHAIR_GAP_RADIUS
      : chrome === "box"
        ? crosshairGapForBox(dimensions?.width ?? 12, dimensions?.height ?? 12)
        : 0;
  const mode = inspection.mode;
  const vertical = mode === "xy" || mode === (flipped ? "y" : "x");
  const horizontal = mode === "xy" || mode === (flipped ? "x" : "y");
  const bounds = {
    x: panel.bounds.x0,
    y: panel.bounds.y0,
    width: panel.bounds.x1 - panel.bounds.x0,
    height: panel.bounds.y1 - panel.bounds.y0,
  };
  const lines = [
    ...(vertical
      ? gappedCrosshairSegmentsWithObstacles("vertical", focus.anchor, bounds, gap, obstacles)
      : []),
    ...(horizontal
      ? gappedCrosshairSegmentsWithObstacles("horizontal", focus.anchor, bounds, gap, obstacles)
      : []),
  ];
  return { hover, lines };
}

export function PlotOverlay({
  model,
  inspection,
  seed,
  candidates,
  selected,
  emphasized,
  rectangles,
  flipped,
}: {
  model: RenderModel;
  inspection: PlotInspectionChange<Record<string, CellValue>, PropertyKey> | null;
  seed: CandidateFacts | null;
  candidates: readonly (CandidateFacts & { keys: readonly PropertyKey[] })[];
  selected: readonly PropertyKey[];
  emphasized: readonly PropertyKey[];
  rectangles: readonly PlotRect[];
  flipped: boolean;
}) {
  const presented = candidates.map((candidate) => ({
    ...candidate,
    ...candidateExtent(model, candidate),
  }));
  const anchors = anchorsFromCandidateKeys(presented, selected);
  const emphasis = applyEmphasisRingDensityGate(anchorsFromCandidateKeys(presented, emphasized));
  const { hover, lines } = hoverGuides(model, inspection, seed, flipped);
  if (
    inspection === null &&
    anchors.length === 0 &&
    emphasis.length === 0 &&
    rectangles.length === 0
  )
    return null;
  return (
    <svg
      className="gg-interaction-overlay"
      aria-hidden="true"
      width={model.scene.width}
      height={model.scene.height}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {lines.map((line, index) => (
        <line
          key={index}
          className="gg-crosshair"
          {...line}
          stroke="currentColor"
          strokeOpacity={0.5}
          strokeDasharray="3 3"
        />
      ))}
      {hover !== null && <Anchor anchor={hover} className="gg-hover-ring" radius={6} />}
      {anchors.map((anchor, index) => (
        <Anchor key={index} anchor={anchor} className="gg-selected-ring" radius={8} />
      ))}
      {emphasis.map((anchor, index) => (
        <Anchor key={index} anchor={anchor} className="gg-emphasis-ring" radius={7} />
      ))}
      {rectangles.map((rect, index) => (
        <rect
          key={index}
          className="gg-brush"
          x={rect.x0}
          y={rect.y0}
          width={rect.x1 - rect.x0}
          height={rect.y1 - rect.y0}
          fill="Highlight"
          fillOpacity={0.12}
          stroke="Highlight"
        />
      ))}
    </svg>
  );
}
