import type {
  InteractionTool,
  PreciseBoundsApplyEvent,
  ZoomDomains,
} from "@ggts-sh/core/interaction";

import { PlotControls } from "./plot-controls.js";
import { shouldShowToolRail } from "@ggts-sh/core/interaction";

interface ReactPlotControlsState {
  interactive: boolean;
  config: { availableTools: readonly InteractionTool[]; select: { type: string } | null };
  interactions: {
    activeTool: InteractionTool;
    chooseTool: (tool: InteractionTool) => void;
    selected: readonly unknown[];
    intervals: readonly unknown[];
    clearSelection: (source: "pointer") => void;
    clearIntervals: (source: "pointer") => void;
  };
  zoom: ZoomDomains | null;
  onZoom: (domains: ZoomDomains | null, source: "pointer") => void;
  boundsInputs: Parameters<typeof PlotControls>[0]["boundsInputs"];
  applyBounds: (panelId: string, event: PreciseBoundsApplyEvent) => void;
}

export function ReactPlotControls(
  state: ReactPlotControlsState,
): ReturnType<typeof PlotControls> | null {
  const { interactive, config, interactions, zoom, onZoom, boundsInputs, applyBounds } = state;
  if (
    !shouldShowToolRail({
      interactive,
      availableToolCount: config.availableTools.length,
      canPublishPointSelection: config.select?.type === "point",
      selectedKeyCount: interactions.selected.length,
      hasIntervalSelection: interactions.intervals.length > 0,
      hasZoomDomains: zoom !== null,
    })
  ) {
    return null;
  }
  return (
    <PlotControls
      tools={config.availableTools}
      activeTool={interactions.activeTool}
      onToolChange={interactions.chooseTool}
      canResetZoom={zoom !== null}
      onResetZoom={() => {
        onZoom(null, "pointer");
      }}
      canClearSelection={interactions.selected.length > 0}
      onClearSelection={() => {
        interactions.clearSelection("pointer");
      }}
      canClearIntervals={interactions.intervals.length > 0}
      onClearIntervals={() => {
        interactions.clearIntervals("pointer");
      }}
      boundsInputs={boundsInputs}
      onApplyBounds={applyBounds}
    />
  );
}
