/**
 * Compile-time contract for createPlotLayer kind→value correlation (#786).
 *
 * Six separately-typed factories collapsed into one generic whose mapping is
 * only as good as `LayerValue<K>`. Runtime tests cannot see a silent
 * degradation to `unknown`. These statements live in a dead branch so nothing
 * runs at import time; svelte-check still type-checks them. Same role as
 * `data/data-contract.ts` — knip entry, never imported at runtime.
 */
import type {
  CoordSpec,
  FacetInput,
  GuidesSpec,
  Labs,
  LegendSpec,
  Scales,
  ThemeName,
  ThemeSpec,
} from "@ggts-sh/spec";

import { createPlotLayer } from "./plot-layer.svelte.js";

// Dead branch: type-checked, never executed (getContext must not run at load).
if (false as boolean) {
  // Positive: each kind accepts its own value type.
  createPlotLayer("scale", (): Scales => ({}));
  createPlotLayer("theme", (): ThemeName | ThemeSpec => "default");
  createPlotLayer("coord", (): CoordSpec | "flip" => "flip");
  createPlotLayer("facet", (): FacetInput => ({ wrap: "x" }));
  createPlotLayer("labs", (): Labs => ({ title: "t" }));
  createPlotLayer("guides", (): GuidesSpec => ({}));
  createPlotLayer("legend", (): LegendSpec => ({}));

  // Negative: mismatched kind/value pairs must not compile.
  // @ts-expect-error — labs value is not a scale fragment
  createPlotLayer("scale", (): Labs => ({ title: "nope" }));
  // @ts-expect-error — scales value is not a coord
  createPlotLayer("coord", (): Scales => ({}));
  // @ts-expect-error — flip is not a facet input
  createPlotLayer("facet", (): "flip" => "flip");
  // @ts-expect-error — guides bag is not labs
  createPlotLayer("labs", (): GuidesSpec => ({}));
  // @ts-expect-error — legend options are not a guides bag
  createPlotLayer("guides", (): LegendSpec => ({}));
  // @ts-expect-error — theme name is not a legend spec
  createPlotLayer("legend", (): ThemeName => "dark");
  // @ts-expect-error — mark is not a PlotLayerKind
  createPlotLayer("mark", (): never => {
    throw new Error("unreachable");
  });
}
