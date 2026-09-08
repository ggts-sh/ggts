/**
 * Scales-and-guides guide section (docs pages + llms surfaces).
 */

export const SCALES_GUIDES_MD = `# Scales and guides

A scale translates semantic data values into a visual position or color. A
position transform runs before statistics; an axis explains the trained scale
without changing its meaning.

## Continuous position scales

Numeric x and y fields use a continuous linear scale by default. Non-temporal
continuous scales reserve 5% multiplicative display expansion at both ends.
Expansion affects only display training, never filtering or statistics. Restore
flush bounds with \`expand: { mult: 0, add: 0 }\`.

Use the closed \`identity\`, \`log10\`, and \`sqrt\` transforms. The scale family
stays \`linear\`: GuidePlan and RenderModel report \`type/scaleType: "linear"\`
plus the transform. Authored \`type: "log"\` remains an accepted alias and
canonicalizes to \`{ type: "linear", transform: "log10" }\`.

\`\`\`json fragment
{
  "scales": {
    "x": { "type": "linear", "transform": "log10" },
    "y": { "type": "linear", "transform": "sqrt", "reverse": true }
  }
}
\`\`\`

Builder helpers and their ggplot2 aliases produce the same canonical spec:

\`\`\`ts fragment
import {
  scaleXLog10,
  scaleYSqrt,
  scale_x_log10,
  scaleColorGradient,
  scale_color_gradient2,
  scale_fill_gradientn,
} from "@ggts-sh/spec";

const camel = scaleXLog10({ domain: [1, 10_000] });
const alias = scale_x_log10({ limits: [1, 10_000] });
const root = scaleYSqrt({ reverse: true });
// Continuous colour gradients (#826): map to sequential scales with explicit range.
const twoStop = scaleColorGradient({ low: "#132B43", high: "#56B1F7" });
const diverging = scale_color_gradient2({ low: "#B2182B", mid: "#F7F7F7", high: "#2166AC" });
const nStop = scale_fill_gradientn({ colours: ["#440154", "#21918c", "#fde725"] });
\`\`\`

Svelte shells: \`<ScaleColorGradient>\`, \`<ScaleColorGradient2>\`,
\`<ScaleColorGradientn>\` (and fill / colour aliases). gradientn requires ≥2
hex stops via \`colours\` / \`colors\` / \`values\`. See
[gradient colour example](/examples/point/gradient-continuous).

The Svelte surface accepts the same JSON and re-exports the same helpers:

\`\`\`svelte fragment
<GGPlot data={rows} aes={{ x: "latency", y: "requests" }}>
  <GeomPoint />
  <GeomSmooth method="lm" />
  <Scale
    value={{
      x: { type: "linear", transform: "log10" },
      y: { type: "linear", transform: "sqrt" },
    }}
  />
</GGPlot>
\`\`\`

The smooth receives transformed x and y. This is intentionally different from
a post-stat coordinate transform: scale transformation can change a fit,
histogram, density estimate, summary, or boxplot.

## Limits, missing values, and OOB policy

\`domain\` and helper \`limits\` pin an unexpanded interval in semantic source
units. Supplying both to a helper is an error. The default \`oob: "censor"\`
replaces out-of-limit values with missing before stats; \`oob: "squish"\`
clamps them to the nearest limit first. \`naValue\` replaces missing/censored
positions before transform-domain validation.

Log10 requires positive values and sqrt requires non-negative values. Recovery
is explicit: filter or repair the data, select identity, widen limits, or choose
the intended OOB policy. See
[scale-transform-domain](/guide/errors#scale-transform-domain),
[scale-oob-censored](/guide/errors#scale-oob-censored), and
[scale-oob-squished](/guide/errors#scale-oob-squished).

## Binned positions

A binned scale assigns quantitative values to bounded transformed-space bins
while preserving source values for tooltips and events:

\`\`\`svelte fragment
<Scale
  value={{
    x: {
      type: "binned",
      transform: "log10",
      breaks: [1, 10, 100, 1000],
    },
  }}
/>
\`\`\`

The runtime keeps integer bin identities private for count/stack/fill/dodge.
Geometry, jitter, guides, and synthesized candidates use transformed centers
and semantic inverse values. Explicit or automatic bins are right-closed with
an inclusive lowest edge and are capped at 64.

## Breaks and labels

\`breaks\` and \`minorBreaks\` are bounded semantic source values. Major breaks
win when a major and minor coincide. Explicit breaks outside the trained domain
are omitted with
[scale-break-outside-domain](/guide/errors#scale-break-outside-domain).
Temporal \`dateMinorBreaks\` outranks generic \`minorBreaks\`.

\`reverse\` changes the pixel direction but not semantic tick order. \`nice\`
controls numeric domain rounding. Guides retain complete semantic values and
apply the forward transform exactly once. For the full split between scale
formats, axis guides, and plot titles, see
[Axes and ticks](/reference/axes) and [Labs](/reference/labs).

## Categorical color

Use a named categorical scheme when color identifies groups:

\`\`\`svelte fragment
<GGPlot data={cars} aes={{ x: "weight", y: "economy", color: "vehicleClass" }}>
  <GeomPoint />
  <Scale value={{ color: { type: "ordinal", scheme: "observable10" } }} />
</GGPlot>
\`\`\`

Stable assignments preserve category identity as rows filter or reorder. See
registered schemes and capacities on
[Color palettes](/palettes). Palette exhaustion is
\`onExhaust: "cycle"\` (default, warn once) or \`"error"\` — diagnostics at
[palette-exhausted](/guide/errors#palette-exhausted) and
[palette-exhausted — warning](/guide/errors#palette-exhausted-warning).

ggplot2-shaped discrete helpers (portable named schemes, not bake-only):

\`\`\`svelte fragment
<ScaleColorHue />
<!-- or: <ScaleColorGrey />, <ScaleColorOrdinal scheme="colorblind" /> -->
\`\`\`

\`\`\`ts fragment
import { scaleColorHue, scaleColorGrey, scaleColorOrdinal } from "@ggts-sh/spec";

scaleColorHue(); // { color: { type: "ordinal", scheme: "hue" } }
scaleColorGrey(); // bakes a 10-stop greyscale range (US gray is a binding-identical alias)
scaleColorOrdinal({ scheme: "colorblind" }); // alias of scaleColorDiscrete
// Custom h/c/l (hue) or start/end (grey) bake a fixed 10-stop range instead.
\`\`\`

[Hue discrete colour](/examples/point/hue-discrete): even-hue groups via
\`scale_color_hue\`. There is no registered \`"grey"\` / \`"gray"\` scheme —
use \`scaleColorGrey()\` / \`<ScaleColorGrey />\` for greyscale discrete color.

## Continuous, binned, manual, and identity color

Quantitative color/fill defaults to a continuous viridis colorbar. Named
viridis-family constructors match ggplot2 \`scale_*_viridis_{c,d,b}\`
(\`option\` selects \`viridis\`/\`magma\`/\`plasma\`/\`inferno\`/\`cividis\`/\`turbo\`;
\`direction: -1\` reverses). Discrete viridis samples evenly across the ramp.
The \`identity\`, \`log10\`, and \`sqrt\` transforms run before color-domain
training; they do not change position statistics. Explicit reference
\`breaks\` stay in semantic source units.

\`\`\`ts fragment
import {
  scaleColorLog10,
  scaleColorViridisD,
  scaleFillViridisC,
} from "@ggts-sh/spec";

const color = scaleColorLog10({ domain: [1, 1000] });
const fill = scaleFillViridisC({ option: "plasma" });
const groups = scaleColorViridisD({ option: "viridis" });
\`\`\`

Binned color/fill uses deterministic \`[lower, upper)\` intervals with the final
upper edge included. At most 65 boundaries (64 steps) are portable. A
colorsteps guide exposes every boundary, label, swatch, and inclusivity rule:

\`\`\`svelte fragment
<GGPlot data={rows} aes={{ x: "hour", y: "pm25", color: "pm25" }}>
  <GeomPoint />
  <Scale
    value={scaleColorBinned({
    breaks: [0, 12, 35, 55, 100],
    range: ["#2a9d8f", "#e9c46a", "#f4a261", "#e76f51"],
    })}
  />
</GGPlot>
\`\`\`

Manual scales pair each domain value with exactly one color and never recycle
unknown values. Identity scales validate source \`#rgb\`/\`#rrggbb\` values and
show no guide by default. \`naValue\` handles missing values; \`unknownValue\`
handles invalid, unmapped, or censored values. Multi-aesthetic helpers expand
the same identity or manual config across channels (British \`colour\` aliases
\`color\`):

\`\`\`ts fragment
import {
  scaleContinuousIdentity,
  scaleDiscreteManual,
  scaleType,
} from "@ggts-sh/spec";

const linked = scaleDiscreteManual({
  aesthetics: ["colour", "fill"],
  values: ["#4477aa", "#ee6677"],
  domain: ["control", "treated"],
});
const rawSize = scaleContinuousIdentity({ aesthetics: ["size", "alpha"] });
// Agent default: scaleType({ aesthetic: "color", dataKind: "nominal" }) → "ordinal"
\`\`\`

\`\`\`ts fragment
const manual = scaleColorManual({
  domain: ["control", "treated"],
  values: ["#4477aa", "#ee6677"],
  unknownValue: "#999999",
});
const identity = scaleFillIdentity({ naValue: "#cccccc" });
\`\`\`

Color and colour spellings are binding-identical exports, including
\`scaleColorBinned\`, \`scaleColourBinned\`, \`scale_color_binned\`, and
\`scale_colour_binned\`. Fill exports use the same families. Date/datetime
helpers reuse the strict parser registry and semantic epoch representation:
\`scaleColorDate\`, \`scaleColorDatetime\`, \`scaleFillDate\`, and
\`scaleFillDatetime\`.

Open [binned color](/examples/color/binned) for colorsteps, and continuous
color scales via \`scaleColorContinuous\` / \`scale_color_continuous\`.

## Size, linewidth, alpha, shape, and linetype

The remaining visual channels use the same stable scale contract. Quantitative
\`size\`, \`linewidth\`, and \`alpha\` default to sequential scales; categorical
values default to ordinal scales. Size interpolation is perceptually linear in
symbol area. Alpha is bounded to 0–1, while size and linewidth must stay
positive.

\`\`\`ts fragment
import {
  scaleSizeContinuous,
  scaleLinewidthBinned,
  scaleAlphaDate,
  scaleShapeManual,
  scaleLinetypeDiscrete,
} from "@ggts-sh/spec";

const scales = {
  ...scaleSizeContinuous({ range: [2, 10] }),
  ...scaleLinewidthBinned({ breaks: [0, 10, 20, 50] }),
  ...scaleShapeManual({
    domain: ["control", "treated"],
    values: ["circle", "triangle"],
  }),
  ...scaleLinetypeDiscrete(),
};
\`\`\`

Shape and linetype are finite perceptual sets. Continuous values therefore
require an explicit \`binned\` scale; they are never silently interpolated.
Manual scales require one output per domain value, and exhaustion errors by
default unless \`onExhaust: "cycle"\` is explicitly selected. Identity scales
validate literal outputs and suppress guides.

Discrete and binned style mappings participate in grouping; continuous numeric
styles do not. Mapped values survive stats, positions, SVG/Canvas rendering,
server rendering, inspection, legend focus/filtering, and hit testing. Literal
constants remain unscaled unless authored as \`{ value, scale: true }\`.
Missing and invalid values use distinct \`naValue\` and \`unknownValue\` outputs.
Date/datetime helpers reuse the strict parser and timezone semantics used by
position and color scales.

The five style channels each have their own scale families in the
[scales reference](/reference/scales): [size](/reference/scales/size_continuous),
[alpha](/reference/scales/alpha_continuous),
[shape](/reference/scales/shape_ordinal),
[linetype](/reference/scales/linetype_discrete), and
[linewidth](/reference/scales/linewidth_continuous).

## Responsive guide presentation

Guide appearance is downstream of scale training. The full list of guide shells
and helpers lives in the [guides reference](/reference/guides):
[GuideLegend](/reference/guides/legend),
[GuideColorbar](/reference/guides/colorbar),
[GuideColorsteps](/reference/guides/colorsteps),
[GuideAxis](/reference/guides/axis), and
[GuideNone](/reference/guides/none). Author top-level \`guides\`,
a scale-local \`guide\`, or fluent \`.guides()\` with \`guideAxis\`,
\`guideLegend\`, \`guideColorbar\`, \`guideColorsteps\`, and \`guideNone\`.
Top-level entries win over scale-local entries. Axis shells, collision, and
band label layout are catalogued under [Axes and ticks](/reference/axes);
plot titles stay on [Labs](/reference/labs).

\`\`\`ts fragment
import { guideAxis, guideColorsteps } from "@ggts-sh/spec";

const guides = {
  x: guideAxis({ title: "Hour", showTicks: false }),
  color: guideColorsteps({ position: "bottom", direction: "horizontal" }),
};
\`\`\`

In Svelte that object is a \`<Guides>\` child:

\`\`\`svelte fragment
<GGPlot data={rows} aes={{ x: "hour", y: "pm25", color: "pm25" }}>
  <GeomPoint />
  <Guides value={guides} />
</GGPlot>
\`\`\`

Automatic legends stay right only when the viewport is wider than 480px and at
least 320px of readable panel remains; otherwise they move below. Bottom keys
wrap without shrinking type and bottom ramps are horizontal. Discrete guides
merge only across exact semantic and presentation identities. Exact raw-value
entries stay interactive after merging; numeric ticks and bins do not become
filter targets. Identity/manual guides with fewer than two entries remain
hidden unless \`force: true\` is explicit.

## Date and time axes

Declare a time scale for ISO 8601 values and let the scale choose UTC calendar
ticks. Time axes preserve temporal parsing and expansion behavior and always
use the identity position transform. Pin breaks or labels only when the
audience needs a fixed convention. The
[time-axis example](/examples/line/time-axis) is the runnable contract.
`;
