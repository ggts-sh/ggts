/**
 * Fold removed GGPlot grammar props into a PortableSpec `spec` bag for tests.
 *
 * After #704, theme/scales/coord/facet/labs/guides/legend are children-only on
 * `<GGPlot>`. Many browser suites still pass them as props via `render(GGPlot, …)`;
 * Svelte drops unknown props at runtime, so the plot silently loses grammar.
 * Prefer child components in new tests; use this helper to keep existing prop-style
 * suites green without rewriting every fixture as Svelte children.
 */
import type {
  A11yMode,
  AesInput,
  CoordSpec,
  DataInput,
  FacetInput,
  GuidesSpec,
  Labs,
  LayerInput,
  LegendSpec,
  Scales,
  SpecInput,
  ThemeName,
  ThemeSpec,
} from "@ggts-sh/spec";

type GrammarBag = {
  readonly data?: DataInput | readonly Record<string, unknown>[];
  readonly aes?: AesInput;
  readonly layers?: LayerInput[];
  readonly theme?: ThemeName | ThemeSpec;
  readonly scales?: Scales;
  readonly coord?: CoordSpec | "flip";
  readonly facet?: FacetInput;
  readonly labs?: Labs;
  readonly guides?: GuidesSpec;
  readonly legend?: LegendSpec;
  readonly a11y?: A11yMode;
};

function dataRef(data: DataInput | readonly Record<string, unknown>[]): DataInput {
  if (Array.isArray(data)) return { values: data as never };
  return data as DataInput;
}

/** PortableSpec rejects the GGPlot-prop `"flip"` shorthand — expand it. */
function portableCoord(coord: CoordSpec | "flip"): CoordSpec {
  return coord === "flip" ? { type: "flip" } : coord;
}

/** True when any #704-removed grammar key is present. */
function hasGrammarProps(input: GrammarBag): boolean {
  return (
    input.theme !== undefined ||
    input.scales !== undefined ||
    input.coord !== undefined ||
    input.facet !== undefined ||
    input.labs !== undefined ||
    input.guides !== undefined ||
    input.legend !== undefined
  );
}

/**
 * If grammar props are present, return `{ ...rest, spec }` so GGPlot still
 * receives a complete plot. Interaction/layout props stay top-level.
 */
export function withGrammarAsSpec<T extends GrammarBag>(
  input: T,
): Omit<T, keyof GrammarBag> & {
  spec?: SpecInput;
  data?: T["data"];
  aes?: T["aes"];
  layers?: T["layers"];
  a11y?: T["a11y"];
} {
  if (!hasGrammarProps(input) && input.a11y === undefined) return input;

  const { data, aes, layers, theme, scales, coord, facet, labs, guides, legend, a11y, ...rest } =
    input;

  const spec: SpecInput = {
    ...(data !== undefined && { data: dataRef(data) }),
    ...(aes !== undefined && { aes }),
    layers: layers ?? [],
    ...(theme !== undefined && { theme }),
    ...(scales !== undefined && { scales }),
    ...(coord !== undefined && { coord: portableCoord(coord) }),
    ...(facet !== undefined && { facet }),
    ...(labs !== undefined && { labs }),
    ...(guides !== undefined && { guides }),
    ...(legend !== undefined && { legend }),
    ...(a11y !== undefined && { a11y }),
  };

  return { ...rest, spec };
}
