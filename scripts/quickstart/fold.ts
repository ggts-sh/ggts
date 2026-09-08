/**
 * Pure fold of the sakura lesson steps into a PortableSpec + complete Svelte source.
 *
 * Same count always yields the same spec and the same source text. Shared by the
 * docs site, llms surfaces, and the packed consumer-compat fixture.
 */

import type { GuidesSpec, Labs, LayerSpec, PortableSpec, Scales, ThemeName } from "@ggsvelte/spec";

import { SAKURA_STEPS, SAKURA_Y_LAB } from "./steps";

/** A row of the plot-level dataset (the shape kyotoSakura rows have). */
export type SakuraRow = Record<string, string | number>;

export interface SakuraFold {
  /** The PortableSpec this step's chart renders from. */
  readonly spec: PortableSpec;
  /** The complete `+page.svelte` at this step. */
  readonly source: string;
  /** Runtime-only <GGPlot> props, which are not spec fields. */
  readonly key: string | undefined;
  readonly inspect: { mode: "exact"; pin: true } | undefined;
}

const BASE_LAYERS: Record<string, LayerSpec> = { points: { geom: "point" } };
const BASE_ORDER = ["points"];
const BASE_CHILDREN: Record<string, string> = { points: "  <GeomPoint />" };
/**
 * Readable defaults so the first chart does not ship camelCase axis titles or
 * grouped year ticks. `bloomDate` is a full ISO date per year; month-day y
 * collapses the year so the scatter is bloom timing, not a year-vs-year
 * diagonal. Reverse puts earlier blooms higher on the y-axis.
 * X domain is fixed from the first render so year ticks stay stable as steps
 * add chrome (labels: "d" so 1000 CE is not "1,000").
 */
const BASE_SCALES: Scales = {
  x: { type: "linear", labels: "d", domain: [800, 2030] },
  y: { type: "time", temporalKind: "monthDay", reverse: true },
};
const BASE_LABS: Labs = { x: "Year", y: SAKURA_Y_LAB };
const BASE_GRAMMAR: Record<string, string> = {
  scaleY: `  <ScaleYMonthDay reverse />`,
  scaleX: `  <ScaleXContinuous labels="d" domain={[800, 2030]} />`,
  labs: `  <Labs x="Year" y="${SAKURA_Y_LAB}" />`,
};
const BASE_COMPONENTS = [
  "GeomPoint",
  "GGPlot",
  "Labs",
  "ScaleXContinuous",
  "ScaleYMonthDay",
] as const;

/**
 * Emission order for the grammar children after mark layers (ggplot2 thinking
 * order): scales / theme / guides / labs, then host-only Inspect last. None of
 * these can override a different family, so this is readability only.
 */
const GRAMMAR_ORDER = [
  "scaleY",
  "scaleX",
  "scaleFill",
  "theme",
  "guides",
  "labs",
  "inspect",
] as const;

/** Layers that only make sense when the chart is wide enough to place text. */
export const SAKURA_ANNOTATION_LAYERS = ["leaders", "callouts", "baselineLab"] as const;

export interface FoldSakuraOptions {
  /**
   * Drop the record callouts and their leader lines. The page does this below
   * a ~560px chart container, where hand-placed text collides with the data;
   * the records move to the caption instead. Bands, trend, baseline and points
   * are never dropped.
   */
  readonly annotations?: boolean;
}

interface SakuraFoldState {
  readonly layers: Record<string, LayerSpec>;
  order: readonly string[];
  scales: Scales;
  guides: GuidesSpec | undefined;
  labs: Labs | undefined;
  theme: ThemeName | undefined;
  readonly components: Set<string>;
  readonly registers: Set<string>;
  readonly consts: string[];
  readonly attrs: Map<string, string>;
  readonly children: Record<string, string>;
  readonly grammar: Record<string, string>;
  childOrder: readonly string[];
}

function accumulateSakuraSteps(steps: readonly (typeof SAKURA_STEPS)[number][]): SakuraFoldState {
  const state: SakuraFoldState = {
    layers: { ...BASE_LAYERS },
    order: BASE_ORDER,
    scales: { ...BASE_SCALES },
    guides: undefined,
    labs: { ...BASE_LABS },
    theme: undefined,
    components: new Set<string>(BASE_COMPONENTS),
    registers: new Set<string>(),
    consts: [],
    attrs: new Map<string, string>([
      ["data", "  data={kyotoSakura}"],
      ["aes", `  aes={{ x: "year", y: "bloomDate" }}`],
    ]),
    children: { ...BASE_CHILDREN },
    grammar: { ...BASE_GRAMMAR },
    childOrder: BASE_ORDER,
  };
  for (const step of steps) {
    Object.assign(state.layers, step.spec.layers ?? {});
    if (step.spec.order !== undefined) state.order = step.spec.order;
    state.scales = { ...state.scales, ...step.spec.scales };
    if (step.spec.guides !== undefined) state.guides = { ...state.guides, ...step.spec.guides };
    if (step.spec.labs !== undefined) state.labs = { ...state.labs, ...step.spec.labs };
    if (step.spec.theme !== undefined) state.theme = step.spec.theme;
    for (const component of step.source.components ?? []) state.components.add(component);
    for (const register of step.source.registers ?? []) state.registers.add(register);
    state.consts.push(...(step.source.consts ?? []));
    for (const [name, text] of Object.entries(step.source.attrs ?? {})) {
      state.attrs.set(name, text);
    }
    Object.assign(state.grammar, step.source.grammar ?? {});
    Object.assign(state.children, step.source.children ?? {});
    if (step.source.childOrder !== undefined) state.childOrder = step.source.childOrder;
  }
  return state;
}

function buildSakuraSpec(
  state: SakuraFoldState,
  rows: readonly SakuraRow[],
  annotations: boolean | undefined,
): PortableSpec {
  const order =
    annotations === false
      ? state.order.filter((name) => !SAKURA_ANNOTATION_LAYERS.includes(name as never))
      : state.order;
  return {
    data: { values: [...rows] },
    aes: { x: { field: "year" }, y: { field: "bloomDate" } },
    layers: order.map((name) => state.layers[name]!),
    ...(Object.keys(state.scales).length > 0 && { scales: state.scales }),
    ...(state.guides !== undefined && { guides: state.guides }),
    ...(state.labs !== undefined && { labs: state.labs }),
    ...(state.theme !== undefined && { theme: state.theme }),
  };
}

function buildSakuraSource(state: SakuraFoldState): string {
  const imported = [...state.components, ...state.registers].toSorted((a, b) => a.localeCompare(b));
  const imports =
    imported.join(", ").length > 60
      ? `{\n${imported.map((name) => `    ${name},`).join("\n")}\n  }`
      : `{ ${imported.join(", ")} }`;
  const script = [
    `  import ${imports} from "@ggsvelte/svelte";`,
    `  import { kyotoSakura } from "@ggsvelte/core/data";`,
    ...(state.registers.size > 0
      ? [
          "",
          `  // A stat= override opts into its family explicitly (#1420).`,
          ...[...state.registers].map((fn) => `  ${fn}();`),
        ]
      : []),
    ...(state.consts.length > 0 ? ["", ...state.consts] : []),
  ].join("\n");
  const children = [
    ...state.childOrder.map((name) => state.children[name]!),
    ...GRAMMAR_ORDER.filter((name) => state.grammar[name] !== undefined).map(
      (name) => state.grammar[name]!,
    ),
  ].join("\n");
  return `<script lang="ts">
${script}
</script>

<GGPlot
${[...state.attrs.values()].join("\n")}
>
${children}
</GGPlot>`;
}

/**
 * Accumulate the first `count` steps (0 = the first render). Pure: the same
 * count always yields the same spec and the same source text.
 */
export function foldSakura(
  count: number,
  rows: readonly SakuraRow[] = [],
  options: FoldSakuraOptions = {},
): SakuraFold {
  const steps = SAKURA_STEPS.slice(0, Math.max(0, Math.min(count, SAKURA_STEPS.length)));
  const state = accumulateSakuraSteps(steps);
  const spec = buildSakuraSpec(state, rows, options.annotations);
  const source = buildSakuraSource(state);

  return {
    spec,
    source,
    key: state.attrs.has("key") ? "year" : undefined,
    // Host capability: preferred as `<Inspect>` child (not a PortableSpec field).
    inspect: state.components.has("Inspect") ? { mode: "exact", pin: true } : undefined,
  };
}

/** The honest starting chart: 838 points, default everything, noise winning. */
export const QUICKSTART_PAGE_SVELTE = foldSakura(0).source;

/** The chart the lesson is building toward. */
export const SAKURA_FINISHED_SVELTE = foldSakura(SAKURA_STEPS.length).source;
