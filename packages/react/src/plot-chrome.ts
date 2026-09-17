const CHROME_STYLE_ID = "gg-react-plot-chrome";

const REACT_PLOT_CHROME_CSS = `
.gg-tooltip {
  position: absolute;
  pointer-events: none;
  z-index: 2;
  background: var(--gg-tooltipPaper, var(--gg-tooltip-background, var(--gg-theme-tooltipPaper, var(--gg-paper, #fff))));
  color: var(--gg-tooltipInk, var(--gg-tooltip-foreground, var(--gg-theme-tooltipInk, var(--gg-ink, #1f2328))));
  border: 1px solid var(--gg-tooltipBorder, var(--gg-tooltip-border, var(--gg-theme-tooltipBorder, var(--gg-grid, #b8b8b8))));
  border-radius: var(--gg-tooltip-radius, 3px);
  padding: 8px 10px;
  font-family: var(--gg-font-family, inherit);
  font-size: 12.5px;
  line-height: 1.4;
  max-width: min(280px, calc(100% - 16px));
  max-height: min(320px, calc(100% - 16px));
  box-sizing: border-box;
  overflow: auto;
  overflow-wrap: anywhere;
  box-shadow: var(--gg-tooltip-shadow, none);
  user-select: text;
}
.gg-tooltip.gg-tooltip-interactive.gg-tooltip-pinned {
  pointer-events: auto;
}
.gg-tooltip-members {
  display: grid;
  gap: 6px;
}
.gg-tooltip dl {
  margin: 0;
  display: grid;
  grid-template-columns: auto auto;
  gap: 0 10px;
}
.gg-tooltip dt {
  font-weight: 600;
}
.gg-tooltip dd {
  margin: 0;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.gg-tooltip-axis {
  margin-bottom: 6px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}
.gg-tooltip-more,
.gg-tooltip-hint {
  margin: 7px 0 0;
  color: color-mix(in srgb, currentColor 72%, var(--gg-tooltipPaper, #fff));
}
.gg-legend-chrome {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
}
.gg-legend-targets {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
}
.gg-legend-target {
  position: absolute;
  min-width: 24px;
  min-height: 24px;
  margin: 0;
  border: 1px solid transparent;
  border-radius: 3px;
  padding: 0;
  background: transparent;
  color: transparent;
  pointer-events: auto;
  touch-action: manipulation;
}
.gg-legend-target:hover,
.gg-legend-target-active,
.gg-legend-target[aria-pressed="true"] {
  border-color: var(--gg-interactionInk, var(--gg-theme-interactionInk, currentColor));
  background: color-mix(in srgb, currentColor 7%, transparent);
}
.gg-legend-target-label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
.gg-legend-clear {
  position: absolute;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  min-height: 24px;
  height: 24px;
  margin: 0;
  border: 1px solid var(--gg-tooltipBorder, var(--gg-theme-tooltipBorder, currentColor));
  border-radius: 0.2rem;
  padding: 0 0.4rem;
  background: var(--gg-tooltipPaper, var(--gg-theme-tooltipPaper, var(--gg-paper, #fff)));
  color: var(--gg-tooltipInk, var(--gg-theme-tooltipInk, var(--gg-ink, #1f2328)));
  font: 600 0.75rem/1 var(--gg-font-family, system-ui, sans-serif);
  letter-spacing: -0.01em;
  white-space: nowrap;
  pointer-events: auto;
  cursor: pointer;
}
`;

export function ensureReactPlotChrome(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector(`#${CHROME_STYLE_ID}`) !== null) return;
  const style = document.createElement("style");
  style.id = CHROME_STYLE_ID;
  style.textContent = REACT_PLOT_CHROME_CSS;
  document.head.append(style);
}

export function shouldShowTooltipPinHint(input: { pin: boolean; tooltipBorder: string }): boolean {
  if (!input.pin) return false;
  const border = input.tooltipBorder.trim().toLowerCase();
  return border !== "transparent" && border !== "none";
}
