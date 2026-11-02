/**
 * Spec lint-advisory catalog — pure data for docs and code identity.
 * Runtime SpecAdvisory instances and lintSpec() live in lint.ts;
 * Rule emission sites: lint-layer-rules.ts, lint-scale-rules.ts, lint-node-link.ts.
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
} as const satisfies Record<string, LintCatalogEntry>;

export type LintAdvisoryCode = keyof typeof LINT_CATALOG;
