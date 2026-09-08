/**
 * Ordered TypeBox named `$defs` for the ggts PortableSpec graph.
 *
 * Key **insertion order** is load-bearing: `Type.Cyclic` / the published
 * `schema/v0.json` serialize `$defs` in this order. The bag is split into
 * family partial-record modules (`schema-decls-*.ts`); this aggregator
 * composes `SpecDeclarations` via spread in the EXACT original key order —
 * do not reorder spreads or edit field descriptions while relocating.
 *
 * Cross-refs use string `Type.Ref("Name")` and resolve only after this object
 * is passed to `Type.Cyclic` / `Type.Module` in schema.ts.
 */
import { DataDecls } from "./schema-decls-data.js";
import { PaintDecls } from "./schema-decls-paint.js";
import { ParamsPointPathDecls } from "./schema-decls-params-point-path.js";
import { ParamsColContourDecls } from "./schema-decls-params-col-contour.js";
import { ParamsViolinSummaryDecls } from "./schema-decls-params-violin-summary.js";
import { ParamsErrorbarPositionDecls } from "./schema-decls-params-errorbar-position.js";
import { ParamsAreaAblineDecls } from "./schema-decls-params-area-abline.js";
import { ParamsCurveLabelDecls } from "./schema-decls-params-curve-label.js";
import { LayersPointPathDecls } from "./schema-decls-layers-point-path.js";
import { LayersColBoxplotDecls } from "./schema-decls-layers-col-boxplot.js";
import { LayersCountPointrangeDecls } from "./schema-decls-layers-count-pointrange.js";
import { LayersCrossbarJitterDecls } from "./schema-decls-layers-crossbar-jitter.js";
import { LayersTextMapDecls } from "./schema-decls-layers-text-map.js";
import { LayersSfBlankDecls } from "./schema-decls-layers-sf-blank.js";
import { ScaleDecls } from "./schema-decls-scales.js";
import { StyleScaleDecls } from "./schema-decls-scales-guides.js";
import { GuidesThemeDecls } from "./schema-decls-guides-theme.js";
import { PlotDecls } from "./schema-decls-plot.js";

export const SpecDeclarations = {
  ...DataDecls,
  ...PaintDecls,
  ...ParamsPointPathDecls,
  ...ParamsColContourDecls,
  ...ParamsViolinSummaryDecls,
  ...ParamsErrorbarPositionDecls,
  ...ParamsAreaAblineDecls,
  ...ParamsCurveLabelDecls,
  ...LayersPointPathDecls,
  ...LayersColBoxplotDecls,
  ...LayersCountPointrangeDecls,
  ...LayersCrossbarJitterDecls,
  ...LayersTextMapDecls,
  ...LayersSfBlankDecls,
  ...ScaleDecls,
  ...StyleScaleDecls,
  ...GuidesThemeDecls,
  ...PlotDecls,
};
