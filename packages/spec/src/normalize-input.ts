/**
 * Builder-level SpecInput surface — bare-string channel shorthand and layer
 * option forms accepted by normalize() / gg(). Canonical PortableSpec types
 * live in schema.ts; this module is the convenience superset only.
 */
import type {
  A11yMode,
  ChannelValue,
  CoordSpec,
  DataRef,
  FacetScales,
  GuidesSpec,
  InlineData,
  Labs,
  LegendSpec,
  Scales,
  ThemeName,
  ThemeSpec,
} from "./schema.js";
import type { LayerInput } from "./normalize-input-layers-special.js";

/** Channel form accepted at the TS/builder level: bare string = { field }. */
export type ChannelInput = string | ChannelValue;

/** Aes accepted at the TS/builder level (bare-string shorthand allowed). */
export interface AesInput {
  x?: ChannelInput;
  y?: ChannelInput;
  color?: ChannelInput;
  fill?: ChannelInput;
  size?: ChannelInput;
  linewidth?: ChannelInput;
  alpha?: ChannelInput;
  shape?: ChannelInput;
  linetype?: ChannelInput;
  group?: ChannelInput;
  label?: ChannelInput;
  weight?: ChannelInput;
  sample?: ChannelInput;
  ymin?: ChannelInput;
  ymax?: ChannelInput;
  xmin?: ChannelInput;
  xmax?: ChannelInput;
  xend?: ChannelInput;
  yend?: ChannelInput;
  width?: ChannelInput;
  height?: ChannelInput;
  z?: ChannelInput;
  map_id?: ChannelInput;
  angle?: ChannelInput;
  radius?: ChannelInput;
}

/** Facet field accepted at the TS/builder level (bare-string field shorthand). */
export type FacetFieldInput =
  | string
  | {
      field: string;
      /** Closed explicit panel order (DomainValue[]). */
      levels?: readonly (string | number | boolean | null)[];
      /** Display-label map keyed by string form of semantic values. */
      labels?: Readonly<Record<string, string>>;
    };

/** Facet accepted at the TS/builder level (bare-string field shorthand). */
export interface FacetInput {
  wrap?: FacetFieldInput;
  rows?: FacetFieldInput;
  cols?: FacetFieldInput;
  ncol?: number;
  scales?: FacetScales;
  /** GRID ONLY: panel sizes proportional to scale lengths (facet_grid `space`). */
  space?: "fixed" | "free" | "free_x" | "free_y";
  /** Strip chrome: position (top/bottom/left/right) and visibility. */
  strip?: {
    position?: "top" | "bottom" | "left" | "right";
    show?: boolean;
  };
}

export type {
  AreaLayerInput,
  BarLayerInput,
  BoxplotLayerInput,
  ColLayerInput,
  ContourLayerInput,
  CountLayerInput,
  CrossbarLayerInput,
  Density2dFilledLayerInput,
  Density2dLayerInput,
  DensityLayerInput,
  DotplotLayerInput,
  ErrorbarLayerInput,
  FreqpolyLayerInput,
  HistogramLayerInput,
  HlineLayerInput,
  JitterLayerInput,
  LabelLayerInput,
  LineLayerInput,
  LinerangeLayerInput,
  PathLayerInput,
  PointLayerInput,
  PointrangeLayerInput,
  QuantileLayerInput,
  RibbonLayerInput,
  RuleLayerInput,
  SmoothLayerInput,
  TextLayerInput,
  ViolinLayerInput,
  VlineLayerInput,
} from "./normalize-input-layers-marks.js";

export type {
  AblineLayerInput,
  Bin2dLayerInput,
  BlankLayerInput,
  CurveLayerInput,
  FunctionLayerInput,
  HexLayerInput,
  LayerInput,
  MapLayerInput,
  PolygonLayerInput,
  QqLayerInput,
  QqLineLayerInput,
  RasterLayerInput,
  RectLayerInput,
  RugLayerInput,
  SegmentLayerInput,
  SfLabelLayerInput,
  SfLayerInput,
  SfTextLayerInput,
  SpokeLayerInput,
  StepLayerInput,
  TileLayerInput,
} from "./normalize-input-layers-special.js";

/** Spec accepted at the TS/builder level (superset of PortableSpec forms). */
export interface SpecInput {
  $schema?: string;
  /** Defaults edition (Hadley lesson 13). Absent = current; normalize stamps it. */
  edition?: number;
  data?: DataRef;
  datasets?: Record<string, InlineData>;
  aes?: AesInput;
  layers: LayerInput[];
  facet?: FacetInput;
  coord?: CoordSpec;
  scales?: Scales;
  guides?: GuidesSpec;
  legend?: LegendSpec;
  labs?: Labs;
  theme?: ThemeName | ThemeSpec;
  width?: number;
  height?: number;
  a11y?: A11yMode;
}
