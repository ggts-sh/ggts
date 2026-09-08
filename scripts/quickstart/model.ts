/**
 * The sakura lesson's step model — the three types every step declares.
 *
 * A step carries two deltas: the PortableSpec fragment the chart renders and
 * the Svelte source delta the reader copies. `foldSakura` (`./fold.ts`)
 * accumulates both.
 */

import type { GuidesSpec, Labs, LayerSpec, Scales, ThemeName } from "@ggts-sh/spec";

export interface SakuraSpecDelta {
  /** Layers keyed by name; a repeated key replaces that layer. */
  readonly layers?: Readonly<Record<string, LayerSpec>>;
  /** Full bottom-to-top z-order after this step. */
  readonly order?: readonly string[];
  readonly scales?: Scales;
  readonly guides?: GuidesSpec;
  readonly labs?: Labs;
  readonly theme?: ThemeName;
}

export interface SakuraSourceDelta {
  /** Components added to the `@ggts-sh/svelte` import. */
  readonly components?: readonly string[];
  /**
   * Register functions added to the `@ggts-sh/svelte` import and called in
   * the script body. A `stat="…"` override on a basic shell needs its family
   * registered — the shell registers only its default stat (#1420).
   */
  readonly registers?: readonly string[];
  /** Whole `const` blocks added to the module script. */
  readonly consts?: readonly string[];
  /** `<GGPlot>` attributes, keyed by attribute name; a repeat replaces it. */
  readonly attrs?: Readonly<Record<string, string>>;
  /**
   * Declaration-only **grammar layers** (`<ScaleYMonthDay>`, `<Labs>`,
   * `<GuideLegend>`, `<ThemeTufte>`, …), keyed by the grammar piece they
   * carry; a repeat replaces it.
   *
   * These **are** plot layers (`Layer.kind` scale/theme/coord/facet/labs/
   * guides/legend via `createPlotLayer`). They are held apart from
   * {@link children} only because they are **not mark layers**: they never
   * appear in `childOrder` (geom z-order). The lesson emits marks first, then
   * grammar, then Inspect — ggplot2 thinking order. Registration order still
   * drives mark z-order and last-wins folds within a grammar family (#659).
   *
   * Do not call them “non-layers.” PortableSpec puts marks in `layers[]` and
   * folds these families into top-level keys; that is serialization, not
   * ontology.
   */
  readonly grammar?: Readonly<Record<string, string>>;
  /** Mark/geom child elements keyed by the layer they draw; a repeat replaces it. */
  readonly children?: Readonly<Record<string, string>>;
  /** Full bottom-to-top mark child order after this step. */
  readonly childOrder?: readonly string[];
}

export interface SakuraStep {
  readonly id: string;
  /** Step heading. States the reader's goal, not the mechanism. */
  readonly title: string;
  /**
   * Optional one-line note under the heading. Empty string = no note
   * (prefer no marketing prose on this page).
   */
  readonly outcome: string;
  /**
   * Optional grammar note under the fragment. Empty string = no note.
   */
  readonly explanation: string;
  /** The delta the reader types, as it appears above the chart. */
  readonly fragment: string;
  readonly spec: SakuraSpecDelta;
  readonly source: SakuraSourceDelta;
}
