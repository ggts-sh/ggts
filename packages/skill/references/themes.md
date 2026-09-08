<!-- Source of truth: packages/spec/src/schema-names.ts (THEME_NAMES, THEME_NAME_ALIASES), packages/core/src/theme-builtins.ts (token maps), packages/svelte/src/lib (Theme* shells). Inventory table is asserted complete by scripts/skill-content/inventory.test.ts. -->

# Themes

JSON form: `"theme": "minimal"` (a registered name) or a theme object —
optional `"name"` base plus role overrides, e.g.
`{"name": "dark", "ink": "#eee"}`. `grey` and `gray` are registered aliases of
`ggplot2` (same token map). Theme is a REPLACE grammar family on `<GGPlot>`
(last child wins) — merge rules live in
[composition-surfaces.md](composition-surfaces.md).

## Product themes (32)

| Name                    | Look                                                                       |
| ----------------------- | -------------------------------------------------------------------------- |
| default                 | quiet hrbrthemes-style base: real typography, hairline grid, no axis frame |
| light                   | light grid, thin panel border, x/y ticks                                   |
| dark                    | dark paper and panel, light ink                                            |
| minimal                 | light grid only, no ticks or border                                        |
| ggplot2                 | classic grey panel, white grid                                             |
| classic                 | no grid, black axis lines and ticks                                        |
| bw                      | white panel, grey grid, black rectangular border (print/B&W)               |
| hrbr                    | same token map as default                                                  |
| few                     | no grid, thin panel border (Stephen Few)                                   |
| clean                   | dashed y grid only, axis lines and ticks                                   |
| fivethirtyeight         | grey paper and panel, white grid, blue accent                              |
| economist               | pale blue paper, white grid, x ticks, red accent                           |
| tufte                   | monochrome ink, no grid                                                    |
| linedraw                | black-on-white line art: hairline black grid, black border                 |
| void                    | no axes, grid, or panel chrome; marks and legends remain                   |
| stata                   | Stata s2color: bluish-gray plot region, white panel, y-grid                |
| stata_s1color           | Stata s1color: white panel with black border, light y-grid                 |
| solarized               | Solarized light: cream panel, muted base1 chrome, blue accent              |
| solarizeddark           | Solarized dark: deep teal panel, muted base01 chrome, blue accent          |
| economist_white         | Economist Graphic Detail: white panel, gray grid, light-gray paper         |
| solarized_2             | Solarized grey-style variant: base2 panel, base3 grid, no frame            |
| solarized_2dark         | solarized_2 on dark base tones                                             |
| wsj                     | Wall Street Journal: brown paper, dotted black y-grid, x line + ticks      |
| hc                      | Highcharts default: y-only #D8D8D8 grid on white, no border                |
| hcdark                  | Highcharts darkunica: #2a2a2b paper, #707073 y-grid                        |
| pander                  | pander: dashed grey grid and ticks, bold title on white                    |
| base                    | base R: black frame and ticks, no grid, bold title                         |
| igray                   | inverse gray: white panel, gray90 surround and grid                        |
| map                     | every axis/panel/grid element blank — marks only, for maps                 |
| solid                   | nothing but marks — every non-geom element removed                         |
| grey (alias of ggplot2) | UK theme_grey                                                              |
| gray (alias of ggplot2) | US theme_gray                                                              |

The internal `test` theme exists for snapshots only — not a product surface;
do not document or recommend it.

**Headless named themes:** `@ggts-sh/core/headless` resolves only `default`
and `void`. A named catalog theme (`dark`, `minimal`, `economist`, …) on that
entry throws. Use `@ggts-sh/core` or `@ggts-sh/core/render` (or pass the
full editions table). This is not a `register*()` call. Full inventory:
SKILL.md Registration.

## Svelte shells and overrides

One named shell per product theme — `ThemeDefault`, `ThemeLight`,
`ThemeDark`, `ThemeMinimal`, `ThemeGgplot2`, `ThemeClassic`, `ThemeBw`,
`ThemeHrbr`, `ThemeFew`, `ThemeClean`, `ThemeFivethirtyeight`,
`ThemeEconomist`, `ThemeTufte`, `ThemeLinedraw`, `ThemeVoid`, `ThemeStata`,
`ThemeStatas1color`, `ThemeSolarized`, `ThemeSolarizeddark`,
`ThemeEconomistwhite`, `ThemeSolarized2`, `ThemeSolarized2dark`, `ThemeWsj`,
`ThemeHc`, `ThemeHcdark`, `ThemePander`, `ThemeBase`, `ThemeIgray`,
`ThemeMap`, `ThemeSolid`, `ThemeGrey`, `ThemeGray`. Escape hatch
`<Theme name={dynamicName} />` for reactive names.

Every shell and `<Theme>` also accepts role-override props (`ink`, `paper`,
`accent`, `grid`, `panel`, `axisText`, `axisLine`, `tickColor`,
`panelBorder`, tooltip/selection/focus roles, …): `<ThemeDark ink="#eee" />`.

```svelte fragment
<GGPlot data={rows} aes={{ x: "displ", y: "hwy" }} layers={[{ geom: "point" }]}>
  <ThemeEconomist />
</GGPlot>
```

```json complete
{
  "data": {
    "values": [
      { "displ": 1.8, "hwy": 29 },
      { "displ": 3.5, "hwy": 26 }
    ]
  },
  "layers": [
    {
      "geom": "point",
      "aes": { "x": { "field": "displ" }, "y": { "field": "hwy" } }
    }
  ],
  "theme": "economist"
}
```
