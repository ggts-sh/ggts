/**
 * Plot-level deprecation advisories (ADR 0013).
 *
 * Sibling union to InteractionDiagnostic, delivered through the existing
 * `ondiagnostic` channel as PlotDiagnostic. One code (`DEPRECATED_PLOT_PROP`)
 * covers every deprecated grammar prop — `prop` carries the name.
 *
 * Runtime emission left in 0.13.0 (#704) when the seven grammar props were
 * removed. Types + catalog + builder stay for union typing, upgrade-guide
 * anchors, and codemod consumers. Discriminate with
 * `d.code === "DEPRECATED_PLOT_PROP"` (no type-guard export).
 *
 * Deliberately NOT merged into INTERACTION_DIAGNOSTIC_CATALOG / the
 * interaction-reference guide page: a deprecated grammar prop is not an
 * interaction concern, and migration guidance belongs on /guide/upgrading
 * (docUrl below). Omitting it from the interaction catalog is a decision,
 * not an oversight.
 */
import type { InteractionDiagnostic } from "../interaction/interaction-diagnostics.js";
import type { CompositionDiagnostic } from "./composition.js";

export type DeprecationDiagnosticCode = "DEPRECATED_PLOT_PROP";

export interface DeprecationDiagnostic {
  readonly severity: "advisory";
  readonly code: DeprecationDiagnosticCode;
  readonly message: string;
  readonly prop: string;
  readonly since: string;
  readonly removeIn: string;
  readonly suggestions: ReadonlyArray<string>;
  readonly docUrl: string;
}

/**
 * Union of every diagnostic the plot may deliver through `ondiagnostic`.
 * Interaction capability/key/lineage checks, grammar-prop deprecations, and
 * composition collisions (duplicate scale channels). Additive: handlers
 * annotated `PlotDiagnostic` (the 0.11 form) remain valid. Exhaustive
 * `switch` on `.code` needs arms for `DUPLICATE_SCALE_CHANNEL` and
 * `DUPLICATE_PLOT_LAYER`.
 */
export type PlotDiagnostic = InteractionDiagnostic | DeprecationDiagnostic | CompositionDiagnostic;

const GUIDE_UPGRADING = "https://ggts.sh/guide/upgrading";

/**
 * Frozen catalog entry for the single deprecation code. Message / prop /
 * since / removeIn / docUrl are filled per emission by
 * {@link deprecatedPropDiagnostic}.
 */
export const DEPRECATION_DIAGNOSTIC_CATALOG: Readonly<
  Record<
    DeprecationDiagnosticCode,
    Pick<DeprecationDiagnostic, "severity" | "code"> & {
      readonly messageTemplate: (prop: string, since: string, removeIn: string) => string;
    }
  >
> = Object.freeze({
  DEPRECATED_PLOT_PROP: {
    severity: "advisory",
    code: "DEPRECATED_PLOT_PROP",
    messageTemplate: (prop, since, removeIn) =>
      `GGPlot prop "${prop}" is deprecated since ${since} and will be removed in ${removeIn}. Prefer the matching declaration-only child layer.`,
  },
});

export type DeprecatedPropDiagnosticInput = {
  readonly prop: string;
  readonly since: string;
  readonly removeIn: string;
  readonly suggestions: ReadonlyArray<string>;
  /** Heading anchor on /guide/upgrading (without the leading `#`). */
  readonly anchor: string;
};

/** Build a fully-populated deprecation advisory for one prop. */
export function deprecatedPropDiagnostic(
  input: DeprecatedPropDiagnosticInput,
): DeprecationDiagnostic {
  const entry = DEPRECATION_DIAGNOSTIC_CATALOG.DEPRECATED_PLOT_PROP;
  return {
    severity: entry.severity,
    code: entry.code,
    message: entry.messageTemplate(input.prop, input.since, input.removeIn),
    prop: input.prop,
    since: input.since,
    removeIn: input.removeIn,
    suggestions: input.suggestions,
    docUrl: `${GUIDE_UPGRADING}#${input.anchor}`,
  };
}
