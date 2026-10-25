export function tooltipCardPosition(input: {
  anchorX: number;
  anchorY: number;
  measuredWidth: number;
  measuredHeight: number;
  sceneWidth: number;
  sceneHeight: number;
}): { left: number; top: number } {
  const OFFSET = 10;
  const EDGE = 8;
  const tooltipWidth = Math.min(
    input.measuredWidth || 280,
    Math.max(0, input.sceneWidth - EDGE * 2),
  );
  const tooltipHeight = Math.min(
    input.measuredHeight || 160,
    Math.max(0, input.sceneHeight - EDGE * 2),
  );
  const preferredX =
    input.anchorX + OFFSET + tooltipWidth <= input.sceneWidth - EDGE
      ? input.anchorX + OFFSET
      : input.anchorX - OFFSET - tooltipWidth;
  const preferredY =
    input.anchorY + OFFSET + tooltipHeight <= input.sceneHeight - EDGE
      ? input.anchorY + OFFSET
      : input.anchorY - OFFSET - tooltipHeight;
  return {
    left: Math.max(EDGE, Math.min(preferredX, input.sceneWidth - tooltipWidth - EDGE)),
    top: Math.max(EDGE, Math.min(preferredY, input.sceneHeight - tooltipHeight - EDGE)),
  };
}

export function tooltipOverflowCount(input: {
  transient: boolean;
  mode: "exact" | "xy" | "x" | "y";
  groupMemberCount: number;
  displayCount: number;
  shownCount: number;
}): number {
  if (!input.transient) return 0;
  const full =
    input.mode === "x" || input.mode === "y" ? input.groupMemberCount : input.displayCount;
  return Math.max(0, full - input.shownCount);
}
