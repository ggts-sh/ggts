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
  inspectGuideAxes,
  panelBoundsFrom,
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
  if (inspection === null)
    return { hover: null, lines: [], vertical: false, horizontal: false, panel: null };
  const focus = inspection.focus;
  const panel = model.viewport.panelAtOrOnly(focus.anchor);
  const batch = seed === null ? undefined : model.scene.batches[seed.batchIndex];
  const closedPath = batch?.kind === "paths" && batch.closed === true;
  const chrome = hoverChromeForKind(seed?.kind, closedPath);
  const dimensions = seed === null ? null : candidateExtent(model, seed);
  const hover = { ...focus.anchor, chrome, ...dimensions };
  if (panel === null) return { hover, lines: [], vertical: false, horizontal: false, panel: null };
  const obstacles = crosshairGlyphObstacles(model.scene.batches, model.scene.panels, panel.id);
  const gap =
    chrome === "ring"
      ? HOVER_CROSSHAIR_GAP_RADIUS
      : chrome === "box"
        ? crosshairGapForBox(dimensions?.width ?? 12, dimensions?.height ?? 12)
        : 0;
  const { vertical, horizontal } = inspectGuideAxes(inspection.mode, flipped);
  const bounds = panelBoundsFrom(panel.bounds);
  const lines = [
    ...(vertical
      ? gappedCrosshairSegmentsWithObstacles("vertical", focus.anchor, bounds, gap, obstacles)
      : []),
    ...(horizontal
      ? gappedCrosshairSegmentsWithObstacles("horizontal", focus.anchor, bounds, gap, obstacles)
      : []),
  ];
  return { hover, lines, vertical, horizontal, panel };
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
  const { hover, lines, vertical, horizontal, panel } = hoverGuides(
    model,
    inspection,
    seed,
    flipped,
  );
  const axisLabel = inspection !== null && "axisLabel" in inspection ? inspection.axisLabel : null;
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
          stroke="var(--gg-crosshair, var(--gg-theme-crosshair, currentColor))"
          strokeWidth={1}
          strokeOpacity={0.55}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {axisLabel !== null && vertical && panel !== null && (
        <text
          className={`gg-crosshair-axis-label gg-crosshair-axis-label-${inspection!.mode}`}
          x={inspection!.focus.anchor.x}
          y={panel.bounds.y1 - 4}
          textAnchor="middle"
          fill="var(--gg-interactionInk, var(--gg-theme-interactionInk, currentColor))"
          fontFamily="var(--gg-font-family, sans-serif)"
          fontSize={11}
          paintOrder="stroke"
          stroke="var(--gg-tooltipPaper, var(--gg-theme-tooltipPaper, white))"
          strokeWidth={3}
          strokeLinejoin="round"
        >
          {axisLabel}
        </text>
      )}
      {axisLabel !== null && horizontal && panel !== null && (
        <text
          className={`gg-crosshair-axis-label gg-crosshair-axis-label-${inspection!.mode}`}
          x={panel.bounds.x0 + 4}
          y={inspection!.focus.anchor.y - 4}
          fill="var(--gg-interactionInk, var(--gg-theme-interactionInk, currentColor))"
          fontFamily="var(--gg-font-family, sans-serif)"
          fontSize={11}
          paintOrder="stroke"
          stroke="var(--gg-tooltipPaper, var(--gg-theme-tooltipPaper, white))"
          strokeWidth={3}
          strokeLinejoin="round"
        >
          {axisLabel}
        </text>
      )}
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
