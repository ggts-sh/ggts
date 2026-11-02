/**
 * `$defs` partial — guides/legend/theme schemas (Scales…Labs).
 * Composed by schema-declarations.ts via spread; key insertion order is load-bearing.
 */

import Type from "typebox";
import { THEME_NAME_SCHEMAS } from "./schema-name-schemas.js";
import { THEME_NAMES } from "./schema-names.js";

export const GuidesThemeDecls = {
  Scales: Type.Object(
    {
      x: Type.Optional(Type.Ref("PositionScaleSpec")),
      y: Type.Optional(Type.Ref("PositionScaleSpec")),
      color: Type.Optional(Type.Ref("ColorScaleSpec")),
      fill: Type.Optional(Type.Ref("ColorScaleSpec")),
      size: Type.Optional(Type.Ref("PositiveStyleScaleSpec")),
      linewidth: Type.Optional(Type.Ref("PositiveStyleScaleSpec")),
      alpha: Type.Optional(Type.Ref("AlphaScaleSpec")),
      shape: Type.Optional(Type.Ref("ShapeScaleSpec")),
      linetype: Type.Optional(Type.Ref("LinetypeScaleSpec")),
    },
    {
      additionalProperties: false,
      description:
        "Per-scale configuration, keyed by aesthetic. Omitted scales use inference (type from field data, domain from data extent).",
    },
  ),

  // --- guide / legend / theme --------------------------------------------------

  GuideThemeSpec: Type.Object(
    {
      titleSize: Type.Optional(Type.Number({ minimum: 8, maximum: 32 })),
      labelSize: Type.Optional(Type.Number({ minimum: 8, maximum: 24 })),
      keyGap: Type.Optional(Type.Number({ minimum: 0, maximum: 32 })),
      rowGap: Type.Optional(Type.Number({ minimum: 0, maximum: 32 })),
      blockGap: Type.Optional(Type.Number({ minimum: 0, maximum: 64 })),
      colorbarThickness: Type.Optional(Type.Number({ minimum: 4, maximum: 48 })),
      colorbarLength: Type.Optional(Type.Number({ minimum: 48, maximum: 512 })),
    },
    {
      additionalProperties: false,
      description: "Bounded presentation overrides for one guide block.",
    },
  ),

  BandAxisGuideSpec: Type.Object(
    {
      mode: Type.Optional(
        Type.Union(
          [
            Type.Literal("auto"),
            Type.Literal("single"),
            Type.Literal("wrap"),
            Type.Literal("rotate"),
            Type.Literal("off"),
          ],
          {
            description: 'Band axis label layout: "auto", "single", "wrap", "rotate", or "off".',
          },
        ),
      ),
      angle: Type.Optional(
        Type.Number({ description: 'Rotation in degrees when mode is "rotate".' }),
      ),
      wrap: Type.Optional(
        Type.Number({
          minimum: 1,
          maximum: 8,
          description: 'Maximum wrapped lines when mode is "wrap".',
        }),
      ),
    },
    {
      additionalProperties: false,
      description:
        "Scale-local band-axis label layout override retained independently from guide appearance.",
    },
  ),

  AxisGuideSpec: Type.Object(
    {
      type: Type.Literal("axis"),
      title: Type.Optional(Type.String({ maxLength: 256 })),
      showTicks: Type.Optional(Type.Boolean()),
      showLabels: Type.Optional(Type.Boolean()),
      collision: Type.Optional(
        Type.Union([Type.Literal("auto"), Type.Literal("preserve"), Type.Literal("ellipsis")]),
      ),
      theme: Type.Optional(Type.Ref("GuideThemeSpec")),
    },
    { additionalProperties: false },
  ),

  LegendGuideSpec: Type.Object(
    {
      type: Type.Literal("legend"),
      title: Type.Optional(Type.String({ maxLength: 256 })),
      order: Type.Optional(Type.Integer({ minimum: -1024, maximum: 1024 })),
      position: Type.Optional(
        Type.Union([Type.Literal("auto"), Type.Literal("right"), Type.Literal("bottom")]),
      ),
      direction: Type.Optional(
        Type.Union([Type.Literal("auto"), Type.Literal("vertical"), Type.Literal("horizontal")]),
      ),
      titlePosition: Type.Optional(
        Type.Union(
          [
            Type.Literal("top"),
            Type.Literal("bottom"),
            Type.Literal("left"),
            Type.Literal("right"),
          ],
          {
            description:
              "Legend title placement. Omit for adaptive placement from the resolved theme and available width.",
          },
        ),
      ),
      keySize: Type.Optional(Type.Number({ minimum: 4, maximum: 48 })),
      collision: Type.Optional(
        Type.Union([Type.Literal("ellipsis"), Type.Literal("wrap"), Type.Literal("error")]),
      ),
      force: Type.Optional(Type.Boolean()),
      theme: Type.Optional(Type.Ref("GuideThemeSpec")),
    },
    { additionalProperties: false },
  ),

  ColorbarGuideSpec: Type.Object(
    {
      type: Type.Literal("colorbar"),
      title: Type.Optional(Type.String({ maxLength: 256 })),
      order: Type.Optional(Type.Integer({ minimum: -1024, maximum: 1024 })),
      position: Type.Optional(
        Type.Union([Type.Literal("auto"), Type.Literal("right"), Type.Literal("bottom")]),
      ),
      direction: Type.Optional(
        Type.Union([Type.Literal("auto"), Type.Literal("vertical"), Type.Literal("horizontal")]),
      ),
      showTicks: Type.Optional(Type.Boolean()),
      showLabels: Type.Optional(Type.Boolean()),
      collision: Type.Optional(Type.Union([Type.Literal("ellipsis"), Type.Literal("error")])),
      force: Type.Optional(Type.Boolean()),
      theme: Type.Optional(Type.Ref("GuideThemeSpec")),
    },
    { additionalProperties: false },
  ),

  ColorstepsGuideSpec: Type.Object(
    {
      type: Type.Literal("colorsteps"),
      title: Type.Optional(Type.String({ maxLength: 256 })),
      order: Type.Optional(Type.Integer({ minimum: -1024, maximum: 1024 })),
      position: Type.Optional(
        Type.Union([Type.Literal("auto"), Type.Literal("right"), Type.Literal("bottom")]),
      ),
      direction: Type.Optional(
        Type.Union([Type.Literal("auto"), Type.Literal("vertical"), Type.Literal("horizontal")]),
      ),
      showLabels: Type.Optional(Type.Boolean()),
      collision: Type.Optional(Type.Union([Type.Literal("ellipsis"), Type.Literal("error")])),
      force: Type.Optional(Type.Boolean()),
      theme: Type.Optional(Type.Ref("GuideThemeSpec")),
    },
    { additionalProperties: false },
  ),

  NoneGuideSpec: Type.Object({ type: Type.Literal("none") }, { additionalProperties: false }),

  GuideSpec: Type.Union([
    Type.Ref("AxisGuideSpec"),
    Type.Ref("LegendGuideSpec"),
    Type.Ref("ColorbarGuideSpec"),
    Type.Ref("ColorstepsGuideSpec"),
    Type.Ref("NoneGuideSpec"),
  ]),

  GuidesSpec: Type.Object(
    {
      x: Type.Optional(Type.Ref("GuideSpec")),
      y: Type.Optional(Type.Ref("GuideSpec")),
      color: Type.Optional(Type.Ref("GuideSpec")),
      fill: Type.Optional(Type.Ref("GuideSpec")),
      size: Type.Optional(Type.Ref("GuideSpec")),
      linewidth: Type.Optional(Type.Ref("GuideSpec")),
      alpha: Type.Optional(Type.Ref("GuideSpec")),
      shape: Type.Optional(Type.Ref("GuideSpec")),
      linetype: Type.Optional(Type.Ref("GuideSpec")),
    },
    {
      additionalProperties: false,
      description: "Appearance-only guide configuration keyed by aesthetic.",
    },
  ),

  LegendSpec: Type.Object(
    {
      order: Type.Optional(
        Type.Union(
          [
            Type.Literal("stable-domain"),
            Type.Literal("present-first-seen"),
            Type.Literal("sorted"),
          ],
          {
            description:
              'Order of discrete legend entries: "stable-domain" (default — stored assignment order, stable across data changes), "present-first-seen" (first occurrence in the current data), "sorted" (alphabetical). Ordering NEVER changes color assignments.',
          },
        ),
      ),
    },
    {
      additionalProperties: false,
      description: "Legend options. Legends style only through the theme.",
    },
  ),

  ThemeName: Type.Union(THEME_NAME_SCHEMAS, {
    description: `A registered theme name: ${THEME_NAMES.map((name) => `"${name}"`).join(", ")}.`,
  }),

  ThemeSpec: Type.Object(
    {
      name: Type.Optional(
        Type.Ref("ThemeName", {
          description: 'Base theme to override. Default "default".',
        }),
      ),
      ink: Type.Optional(
        Type.String({
          description:
            "Foreground role (CSS color): axis lines, tick labels, titles, unmapped line/point/text marks.",
        }),
      ),
      paper: Type.Optional(
        Type.String({
          description:
            'Background role (CSS color) painted behind the plot. "none" for transparent.',
        }),
      ),
      accent: Type.Optional(
        Type.String({
          description:
            "Accent role (CSS color): default fill for unmapped bars, columns, and areas.",
        }),
      ),
      grid: Type.Optional(Type.String({ description: "Panel grid line color (CSS color)." })),
      panel: Type.Optional(Type.String({ description: "Panel background color (CSS color)." })),
      panelAspect: Type.Optional(
        Type.Union([Type.Literal("auto"), Type.Literal("free")], {
          description:
            'Panel aspect policy: "free" suppresses panel aspect diagnostics; "auto" (default) reports them.',
        }),
      ),
      letterboxFill: Type.Optional(
        Type.String({
          description:
            "Fixed-aspect gutter color (CSS color). Defaults to the resolved paper role.",
        }),
      ),
      axisText: Type.Optional(Type.String({ description: "Axis tick-label color (CSS color)." })),
      axisLine: Type.Optional(Type.String({ description: "Axis-line color (CSS color)." })),
      tickColor: Type.Optional(Type.String({ description: "Axis-tick color (CSS color)." })),
      panelBorder: Type.Optional(Type.String({ description: "Panel-border color (CSS color)." })),
      interactionInk: Type.Optional(
        Type.String({ description: "Primary interaction-control and overlay ink (CSS color)." }),
      ),
      interactionMuted: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          exclusiveMaximum: 1,
          description: "Opacity for marks de-emphasized by an interaction.",
        }),
      ),
      focusRing: Type.Optional(Type.String({ description: "Focus-ring color (CSS color)." })),
      crosshair: Type.Optional(Type.String({ description: "Crosshair-guide color (CSS color)." })),
      selectionFill: Type.Optional(
        Type.String({ description: "Interval-selection fill (CSS color, normally translucent)." }),
      ),
      selectionStroke: Type.Optional(
        Type.String({ description: "Selection and zoom-target stroke (CSS color)." }),
      ),
      tooltipPaper: Type.Optional(
        Type.String({ description: "Opaque tooltip surface (CSS color)." }),
      ),
      tooltipInk: Type.Optional(Type.String({ description: "Tooltip foreground (CSS color)." })),
      tooltipBorder: Type.Optional(Type.String({ description: "Tooltip keyline (CSS color)." })),
      toolActive: Type.Optional(
        Type.String({ description: "Active-tool text and underline (CSS color)." }),
      ),
      fontFamily: Type.Optional(Type.String({ description: "Chart font-family stack." })),
      fontSize: Type.Optional(
        Type.Number({ minimum: 1, description: "Base and tick-label font size in px." }),
      ),
      axisTextSize: Type.Optional(Type.Number({ minimum: 1 })),
      fontWeight: Type.Optional(Type.Number({ minimum: 1, maximum: 1000 })),
      titleSize: Type.Optional(Type.Number({ minimum: 1 })),
      titleWeight: Type.Optional(Type.Number({ minimum: 1, maximum: 1000 })),
      subtitleSize: Type.Optional(Type.Number({ minimum: 1 })),
      subtitleWeight: Type.Optional(Type.Number({ minimum: 1, maximum: 1000 })),
      axisTitleSize: Type.Optional(Type.Number({ minimum: 1 })),
      axisTitleWeight: Type.Optional(Type.Number({ minimum: 1, maximum: 1000 })),
      guideTitleSize: Type.Optional(Type.Number({ minimum: 8, maximum: 32 })),
      legendTitlePosition: Type.Optional(
        Type.Union(
          [
            Type.Literal("top"),
            Type.Literal("bottom"),
            Type.Literal("left"),
            Type.Literal("right"),
          ],
          {
            description:
              "Default discrete legend title placement. Omit for adaptive placement; a guide's titlePosition overrides this.",
          },
        ),
      ),
      legendKeySize: Type.Optional(Type.Number({ minimum: 4, maximum: 48 })),
      legendKeyGap: Type.Optional(Type.Number({ minimum: 0, maximum: 32 })),
      legendRowGap: Type.Optional(Type.Number({ minimum: 0, maximum: 32 })),
      guideBlockGap: Type.Optional(Type.Number({ minimum: 0, maximum: 64 })),
      colorbarThickness: Type.Optional(Type.Number({ minimum: 4, maximum: 48 })),
      colorbarLengthMin: Type.Optional(Type.Number({ minimum: 48, maximum: 512 })),
      captionSize: Type.Optional(Type.Number({ minimum: 1 })),
      stripSize: Type.Optional(Type.Number({ minimum: 1 })),
      stripWeight: Type.Optional(Type.Number({ minimum: 1, maximum: 1000 })),
      axisLineWidth: Type.Optional(Type.Number({ minimum: 0 })),
      tickWidth: Type.Optional(Type.Number({ minimum: 0 })),
      tickLength: Type.Optional(Type.Number({ minimum: 0 })),
      gridWidth: Type.Optional(Type.Number({ minimum: 0 })),
      panelBorderWidth: Type.Optional(Type.Number({ minimum: 0 })),
      gridDasharray: Type.Optional(
        Type.String({ description: "SVG stroke-dasharray for major grid lines." }),
      ),
      axisLineX: Type.Optional(Type.Boolean()),
      axisLineY: Type.Optional(Type.Boolean()),
      ticksX: Type.Optional(Type.Boolean()),
      ticksY: Type.Optional(Type.Boolean()),
      labelsX: Type.Optional(
        Type.Boolean({
          description: "When false, suppress x-axis tick labels (theme_void).",
        }),
      ),
      labelsY: Type.Optional(
        Type.Boolean({
          description: "When false, suppress y-axis tick labels (theme_void).",
        }),
      ),
      gridX: Type.Optional(Type.Boolean()),
      gridY: Type.Optional(Type.Boolean()),
      showPanelBorder: Type.Optional(Type.Boolean()),
    },
    {
      additionalProperties: false,
      description:
        "A theme object: a named base plus role overrides. Roles feed geom defaults (ink/paper/accent); every color rides a --gg-* CSS custom property so hosts can restyle without a re-render.",
    },
  ),

  Labs: Type.Object(
    {
      title: Type.Optional(Type.String({ description: "Plot title." })),
      subtitle: Type.Optional(Type.String({ description: "Plot subtitle, under the title." })),
      caption: Type.Optional(Type.String({ description: "Small caption under the plot." })),
      x: Type.Optional(
        Type.String({
          description:
            "X axis title. Defaults to a humanized form of the mapped field name (sentence case).",
        }),
      ),
      y: Type.Optional(
        Type.String({
          description:
            "Y axis title. Defaults to a humanized form of the mapped field name (sentence case).",
        }),
      ),
      color: Type.Optional(
        Type.String({
          description:
            "Color legend title. Defaults to a humanized form of the mapped field name (sentence case).",
        }),
      ),
      fill: Type.Optional(
        Type.String({
          description:
            "Fill legend title. Defaults to a humanized form of the mapped field name (sentence case).",
        }),
      ),
      size: Type.Optional(
        Type.String({
          description:
            "Size legend title. Defaults to a humanized form of the mapped field name (sentence case).",
        }),
      ),
      linewidth: Type.Optional(
        Type.String({
          description:
            "Linewidth legend title. Defaults to a humanized form of the mapped field name (sentence case).",
        }),
      ),
      alpha: Type.Optional(
        Type.String({
          description:
            "Alpha legend title. Defaults to a humanized form of the mapped field name (sentence case).",
        }),
      ),
      shape: Type.Optional(
        Type.String({
          description:
            "Shape legend title. Defaults to a humanized form of the mapped field name (sentence case).",
        }),
      ),
      linetype: Type.Optional(
        Type.String({
          description:
            "Linetype legend title. Defaults to a humanized form of the mapped field name (sentence case).",
        }),
      ),
    },
    {
      additionalProperties: false,
      description: "Human-readable labels: titles, axis titles, legend titles, caption.",
    },
  ),

  // --- facets / coord ----------------------------------------------------------
};
