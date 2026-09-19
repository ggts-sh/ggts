import type {
  InteractionTool,
  PreciseBoundsApplyEvent,
  ZoomDomains,
} from "@ggts-sh/core/interaction";

import { PlotControls } from "./plot-controls.js";

export function shouldMountReactToolRail(input: {
  interactive: boolean;
  toolCount: number;
  selectedCount: number;
  intervalCount: number;
  hasZoom: boolean;
}): boolean {
  return (
    input.interactive &&
    (input.toolCount > 1 || input.selectedCount > 0 || input.intervalCount > 0 || input.hasZoom)
  );
}

interface ReactPlotControlsState {
  interactive: boolean;
  config: { availableTools: readonly InteractionTool[] };
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
    !shouldMountReactToolRail({
      interactive,
      toolCount: config.availableTools.length,
      selectedCount: interactions.selected.length,
      intervalCount: interactions.intervals.length,
      hasZoom: zoom !== null,
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
