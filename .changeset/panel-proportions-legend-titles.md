---
"@ggts-sh/core": minor
"@ggts-sh/spec": minor
"@ggts-sh/skill": patch
---

Legend titles can now sit on any side of a legend, and short or wide plots report panel proportion problems without failing the render.

Legend guides gain `titlePosition` with `"top" | "bottom" | "left" | "right"`. `left` and `right` put a horizontal legend title on the key row, removing the separate title band; `top` retains the previous arrangement. `ThemeSpec` gains `legendTitlePosition` for the plot-wide default, resolved adaptively per legend when omitted.

Renders now warn with `panel-aspect-extreme` when a panel exceeds 4:1 or falls under 0.25:1, and with `panel-height-share-low` when the panel receives under half the plot height. The warnings are non-blocking. `ThemeSpec.panelAspect: "free"` silences them for intentional strips. Fixed, sf, and radial coordinates are excluded.

Bottom-legend spacing is compact on short plots, so the panel keeps more of the available height. The improvement is density-dependent; there is no fixed target share.

To restore the previous title-above-keys arrangement, set `titlePosition: "top"` on a legend guide or `legendTitlePosition: "top"` on the theme.

Migration: none — additive options; existing specifications remain valid.
