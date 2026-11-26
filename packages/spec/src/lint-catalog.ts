/**
 * Spec lint-advisory catalog — pure data for docs and code identity.
 * Runtime SpecAdvisory instances and lintSpec() live in lint.ts;
 * Rule emission sites: lint-layer-rules.ts, lint-bar-end-label.ts, lint-scale-rules.ts,
 * lint-guide-rules.ts, lint-color-scale.ts, lint-node-link.ts, lint-area-period.ts,
 * lint-labs-rules.ts, lint-color-alpha.ts, lint-temporal-prefix.ts.
 */

/** One entry of the lint catalog (docs render straight from it). */
export interface LintCatalogEntry {
  summary: string;
  /** What evidence the rule needs ("spec" alone, or inline data / profile). */
  needs: "spec" | "data" | "data-or-profile";
  rationale: string;
}

/** The lint-advisory catalog — the single source for the docs page. */
export const LINT_CATALOG = {
  "node-link-layout": {
    summary: "Segments connect point rows in a node-link layout.",
    needs: "data",
    rationale:
      "ggts has no graph layout. Segments between points placed by an external layout draw a node-link diagram whose axes mean nothing. Use a graph library, or show the network as an adjacency matrix (`tile`) or a degree distribution (`histogram`).",
  },
  "line-over-nominal-x": {
    summary: "A line layer connects points across a nominal (unordered) x field.",
    needs: "data-or-profile",
    rationale:
      "Lines encode order; connecting unordered categories draws meaningless slopes. Use col/bar for per-category values, or declare the field ordinal if it is genuinely ordered.",
  },
  "many-discrete-colors": {
    summary: "A discrete color/fill field has more than 10 distinct values.",
    needs: "data",
    rationale:
      "Beyond ~10 hues, colors stop being distinguishable and the default palette cycles. Facet by the field, aggregate it, or pin an explicit domain + range.",
  },
  "stacked-area-negative": {
    summary: "A stacked area layer's y field contains negative values.",
    needs: "data",
    rationale:
      'Stacked areas imply parts of a whole; negative contributions make band boundaries cross and mislead. Use a line layer per series, or position: "identity".',
  },
  "discrete-discrete-scatter": {
    summary: "A point layer maps discrete fields on BOTH x and y.",
    needs: "data-or-profile",
    rationale:
      "Discrete-by-discrete points overplot into a grid where counts are invisible. Jitter the points, or count the combinations and encode the count.",
  },
  "transform-domain-data": {
    summary:
      "A transform scale (log10/sqrt) is configured over data that mixes in-domain and out-of-domain values.",
    needs: "data",
    rationale:
      "log10 rejects values <= 0 and sqrt rejects values < 0; the transform silently drops out-of-domain rows before stats (the pipeline warns at render). Filter the data deliberately, or use an identity/linear scale if those values are meaningful.",
  },
  "fractional-calendar-years": {
    summary:
      "A position channel holds year-like numbers with month fractions (year + month/12) on a linear scale.",
    needs: "data",
    rationale:
      'Encoding calendar months as 1854.25 / 1855.917 makes linear tick and tooltip formatters print decimals like 1855.9 — a silent unit lie. Store ISO year-month or date strings ("1854-04" / "1854-04-01") and use a time scale (ScaleXDate, labels "%b %Y") so axes and Inspect pins read as calendar months.',
  },
  "area-over-period-totals": {
    summary:
      "An area layer's x sits on a regular calendar grid (year/quarter/month starts or integer years) with a totals-per-period shape.",
    needs: "data",
    rationale:
      'An area interpolates between x values, but a total per period has no value between periods. Use `col` with `position: "stack"` for totals per period, or a `line` or `area` of a cumulative or rate series.',
  },
  "line-over-period-totals": {
    summary:
      "A line or step layer's x sits on a regular calendar grid (year/quarter/month starts or integer years) with >= 8 periods and jagged integer counts.",
    needs: "data",
    rationale:
      "A line over a per-period total invites a trend reading, but a total per period is a flow, not a stock. Plot the cumulative stock or signed deltas when the chart asks how much is in force; label a per-period count as such.",
  },
  "missing-chart-title": {
    summary: "A chart with a subtitle or layer data has no labs.title.",
    needs: "spec",
    rationale:
      "A title states the chart's message. A subtitle without a title leaves the chart unnamed, and a heading outside the spec is host chrome that is not part of the chart.",
  },
  "missing-axis-title": {
    summary: "A positional channel (x or y) maps a field without a non-blank axis title in labs.",
    needs: "spec",
    rationale:
      "Every positional channel that carries meaning needs an axis title. An absent title falls back to the humanized column name, and a blank title renders nothing; neither tells the reader what the axis measures.",
  },
  "ordinal-color-times-alpha": {
    summary:
      "A discrete color/fill scale (>4 classes) combines with a continuous interpolating alpha ramp.",
    needs: "data",
    rationale:
      "A hue scale and a continuous alpha ramp multiply into a grid of shades the reader cannot separate. Encode one variable with color and the other with position or small multiples.",
  },
  "manual-palette-too-large": {
    summary:
      "A manual or ordinal color/fill scale defines an explicit range with more than 8 colors.",
    needs: "spec",
    rationale:
      "More than eight hues cannot be told apart in a legend or on the marks, even when every hue is authored. Use a named ordinal scheme with eight or fewer classes, or move the field to position or small multiples.",
  },
  "bar-end-label-offset": {
    summary:
      'A text or label layer sets params.anchor to "start" or "end" over a col or bar layer instead of centering.',
    needs: "spec",
    rationale:
      "A value label on a bar is read as belonging to the bar. A start or end anchor puts the label's edge at the bar's value end, so the value sits beside the mark instead of on it. Center the label, or place it with a rule that knows the bar's geometry.",
  },
  "sparse-temporal-prefix": {
    summary:
      "A temporal x column has a sparse leading span (>= 5 years and >= 3x median spacing) with at most 10% of rows at the start.",
    needs: "data",
    rationale:
      "A temporal axis that starts at one early row implies the decades after it were measured and empty. Start at the first period with meaningful coverage, or state the sparse prefix explicitly.",
  },
  "suppressed-mapped-guide": {
    summary:
      'A non-positional aesthetic maps a data field while its guide is suppressed (type: "none").',
    needs: "spec",
    rationale:
      "Suppressing a guide hides the mapping key from the reader. Restore the guide, drop the data mapping if it adds no signal, or label the mapped field directly on the marks.",
  },
} as const satisfies Record<string, LintCatalogEntry>;

export type LintAdvisoryCode = keyof typeof LINT_CATALOG;
