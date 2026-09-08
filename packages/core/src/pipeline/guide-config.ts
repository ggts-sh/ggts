/** Resolve guide precedence, visibility, strict merge identity, and ordering. */
import type { GuideSpec, GuidesSpec, Scales, StyleAesthetic } from "@ggts-sh/spec";

import type { GuidePlan } from "../layout/guide-plan-types.js";
import type { DiscreteLegendInput, LegendInput, ResolvedLegendAppearance } from "../legend.js";
import { encodeKey } from "../scales/state.js";
import type { ThemeTokens } from "../theme.js";

import { enrichPaintLegendKeys } from "./guide-paint-keys.js";
import { PipelineError, type LayerBinding } from "./types.js";

type GuideAesthetic = "x" | "y" | "color" | "fill" | StyleAesthetic;
type NonPositionAesthetic = Exclude<GuideAesthetic, "x" | "y">;

type NonPositionGuide = Exclude<GuideSpec, { type: "axis" }>;
type LegendKeyStyle = ReturnType<NonNullable<DiscreteLegendInput["keyOf"]>>;

function typedGuide(value: unknown): GuideSpec | undefined {
  if (typeof value !== "object" || value === null || !("type" in value)) return undefined;
  return value as GuideSpec;
}

export interface AxisGuideAppearance {
  visible: boolean;
  title?: string;
  showTicks: boolean;
  showLabels: boolean;
  collision: "auto" | "preserve" | "ellipsis";
  theme?: import("@ggts-sh/spec").GuideThemeSpec;
}

export function resolveAxisGuide(
  aesthetic: "x" | "y",
  scales: Scales,
  guides: GuidesSpec | undefined,
  /**
   * Resolved plot theme. `labelsX` / `labelsY` AND with guide showLabels so
   * theme_void (and role overrides) suppress tick labels and margin reserve
   * without touching showTicks (render already gates tick marks via theme.ticks*).
   */
  theme?: Pick<ThemeTokens, "labelsX" | "labelsY">,
): AxisGuideAppearance {
  const local = typedGuide(scales[aesthetic]?.guide);
  const top = guides?.[aesthetic];
  if (axisHidden(local, top)) {
    return { visible: false, showTicks: false, showLabels: false, collision: "auto" };
  }
  const chosen = chooseAxisGuide(local, top);
  return {
    visible: true,
    ...(chosen?.title !== undefined && { title: chosen.title }),
    showTicks: chosen?.showTicks ?? true,
    showLabels: (chosen?.showLabels ?? true) && axisThemeAllowsLabels(aesthetic, theme),
    collision: chosen?.collision ?? "auto",
    ...(chosen?.theme !== undefined && { theme: chosen.theme }),
  };
}

function axisHidden(local: GuideSpec | undefined, top: GuideSpec | undefined): boolean {
  return top?.type === "none" || (top === undefined && local?.type === "none");
}

function chooseAxisGuide(
  local: GuideSpec | undefined,
  top: GuideSpec | undefined,
): Extract<GuideSpec, { type: "axis" }> | undefined {
  const localAxis = local?.type === "axis" ? local : undefined;
  if (top?.type === "axis")
    return { ...localAxis, ...top, theme: { ...localAxis?.theme, ...top.theme } };
  return top === undefined ? localAxis : undefined;
}

function axisThemeAllowsLabels(
  aesthetic: "x" | "y",
  theme: Pick<ThemeTokens, "labelsX" | "labelsY"> | undefined,
): boolean {
  return theme === undefined || (aesthetic === "x" ? theme.labelsX : theme.labelsY);
}

export interface LegendResolutionItem {
  input: LegendInput | null;
  plan: Exclude<GuidePlan, { type: "axis" }> | null;
}

function effectiveGuide(
  aesthetic: GuideAesthetic,
  defaultType: "legend" | "colorbar" | "colorsteps",
  scales: Scales,
  guides: GuidesSpec | undefined,
): NonPositionGuide {
  const local = typedGuide(scales[aesthetic]?.guide);
  const top = guides?.[aesthetic];
  const fallback = { type: defaultType } as NonPositionGuide;
  if (local === undefined && top === undefined) return fallback;
  if (top === undefined) return local as NonPositionGuide;
  if (local === undefined || local.type !== top.type) return top as NonPositionGuide;
  return {
    ...local,
    ...top,
    ...(local.type !== "none" &&
      top.type !== "none" &&
      (local.theme !== undefined || top.theme !== undefined) && {
        theme: { ...local.theme, ...top.theme },
      }),
  } as NonPositionGuide;
}

function sourceIdentity(
  aesthetic: NonPositionAesthetic,
  bindings: readonly LayerBinding[],
): string {
  return JSON.stringify(
    bindings.map((binding) => {
      const style = binding[aesthetic];
      let source: string;
      if (style.field === null) {
        source =
          style.scaledConstant === null ? "none" : `constant:${encodeKey(style.scaledConstant)}`;
        if ("statColumn" in style && style.statColumn !== null) source = `stat:${style.statColumn}`;
      } else {
        source = `field:${style.field}`;
      }
      return `${String(binding.index)}:${source}`;
    }),
  );
}

function appearanceOf(guide: NonPositionGuide, title: string): ResolvedLegendAppearance {
  if (guide.type === "none") {
    return { type: "none", title, order: 0, position: "auto", direction: "auto" };
  }
  return {
    type: guide.type,
    title: guide.title ?? title,
    order: guide.order ?? 0,
    position: guide.position ?? "auto",
    direction: guide.direction ?? "auto",
    ...(guide.type === "legend" && guide.keySize !== undefined && { keySize: guide.keySize }),
    ...(guide.collision !== undefined && { collision: guide.collision }),
    ...(guide.force !== undefined && { force: guide.force }),
    ...(guide.theme !== undefined && { theme: guide.theme }),
    ...("showTicks" in guide && guide.showTicks !== undefined && { showTicks: guide.showTicks }),
    ...("showLabels" in guide &&
      guide.showLabels !== undefined && { showLabels: guide.showLabels }),
  };
}

function appearanceIdentity(appearance: ResolvedLegendAppearance) {
  const theme = appearance.theme;
  return {
    type: appearance.type,
    title: appearance.title,
    order: appearance.order,
    position: appearance.position,
    direction: appearance.direction,
    keySize: appearance.keySize ?? null,
    collision: appearance.collision ?? null,
    force: appearance.force ?? false,
    showTicks: appearance.showTicks ?? true,
    showLabels: appearance.showLabels ?? true,
    theme:
      theme === undefined
        ? null
        : {
            titleSize: theme.titleSize ?? null,
            labelSize: theme.labelSize ?? null,
            keyGap: theme.keyGap ?? null,
            rowGap: theme.rowGap ?? null,
            blockGap: theme.blockGap ?? null,
            colorbarThickness: theme.colorbarThickness ?? null,
            colorbarLength: theme.colorbarLength ?? null,
          },
  };
}

function mergeIdentity(
  input: DiscreteLegendInput,
  plan: Exclude<GuidePlan, { type: "axis" }>,
  source: string,
  appearance: ResolvedLegendAppearance,
): string {
  if (plan.type !== "discrete" || input.interactive === false) return `unique:${plan.id}`;
  return JSON.stringify({
    source,
    family: plan.scaleType,
    title: appearance.title,
    domain: plan.domain.map(encodeKey),
    labels: plan.entries.map((entry) => entry.label),
    distinguishesNaFromUnknown: encodeKey(plan.naValue) !== encodeKey(plan.unknownValue),
    interactive: input.interactive ?? true,
    appearance: appearanceIdentity(appearance),
  });
}

function isPaintLegend(input: LegendInput): boolean {
  return input.scale === "color" || input.scale === "fill";
}

function paintCompatible(
  left: Readonly<{ input: LegendInput; plan: Exclude<GuidePlan, { type: "axis" }> }>,
  right: Readonly<{ input: LegendInput; plan: Exclude<GuidePlan, { type: "axis" }> }>,
): boolean {
  if (!isPaintLegend(left.input) || !isPaintLegend(right.input)) return true;
  if (left.plan.type !== "discrete" || right.plan.type !== "discrete") return false;
  const rightEntries = right.plan.entries;
  return left.plan.entries.every((entry, index) => entry.color === rightEntries[index]?.color);
}

function mergeDiscrete(group: readonly DiscreteLegendInput[]): DiscreteLegendInput {
  const first = group[0]!;
  return {
    ...first,
    aesthetics: Object.freeze(group.flatMap((input) => input.aesthetics ?? [input.scale])),
    colorOf(value: unknown): string | undefined {
      for (const input of group) {
        const color = input.colorOf?.(value) ?? input.keyOf?.(value)?.color;
        if (color !== undefined) return color;
      }
      return undefined;
    },
    keyOf(value: unknown): LegendKeyStyle {
      const key: LegendKeyStyle = {};
      for (const input of group) Object.assign(key, input.keyOf?.(value));
      // Paint enrichment may stamp a solid linetype fallback on colour keys.
      // Dedicated style scales must win regardless of input order.
      for (const input of group) {
        if (input.scale === "color" || input.scale === "fill") continue;
        Object.assign(key, input.keyOf?.(value));
      }
      // Paint enrichment may stamp shape:"circle" onto colour keys. When the
      // same domain also carries linetype (line+point dual layers), keep the
      // dash pattern unless a shape scale is in the merge group — otherwise
      // renderers prefer shape and hide the stroke key entirely.
      if (
        key.shape !== undefined &&
        (key.linetype !== undefined || key.linewidth !== undefined) &&
        !group.some((input) => input.scale === "shape")
      ) {
        delete key.shape;
      }
      return key;
    },
  };
}

export function prepareLegendInputs(input: {
  items: readonly LegendResolutionItem[];
  bindings: readonly LayerBinding[];
  scales: Scales;
  guides: GuidesSpec | undefined;
}): LegendInput[] {
  const prepared = input.items
    .map((item) => prepareLegendItem(item, input))
    .filter((item): item is PreparedLegend => item !== undefined);
  return mergePreparedLegends(prepared);
}

type PreparedLegend = {
  input: LegendInput;
  plan: Exclude<GuidePlan, { type: "axis" }>;
  identity: string;
};

function prepareLegendItem(
  item: LegendResolutionItem,
  input: Parameters<typeof prepareLegendInputs>[0],
): PreparedLegend | undefined {
  if (item.input === null || item.plan === null) return undefined;
  const aesthetic = item.input.scale;
  const defaultType =
    item.input.kind === "ramp" ? "colorbar" : item.input.kind === "steps" ? "colorsteps" : "legend";
  const guide = effectiveGuide(aesthetic, defaultType, input.scales, input.guides);
  if (guide.type === "none") return undefined;
  const appearance = appearanceOf(guide, item.input.title);
  if (appearance.type !== defaultType)
    throwGuideCompatibilityError(input, aesthetic, appearance.type, defaultType);
  if (singleManualLegend(item.plan, appearance)) return undefined;
  const decorated = {
    ...item.input,
    title: appearance.title,
    aesthetics: Object.freeze([item.input.scale]),
    appearance,
  } as LegendInput;
  const withMarkKeys =
    decorated.kind === "discrete" && isPaintLegend(decorated)
      ? enrichPaintLegendKeys(decorated, input.bindings)
      : decorated;
  return {
    input: withMarkKeys,
    plan: item.plan,
    identity:
      withMarkKeys.kind === "discrete"
        ? mergeIdentity(
            withMarkKeys,
            item.plan,
            sourceIdentity(aesthetic, input.bindings),
            appearance,
          )
        : `unique:${item.plan.id}`,
  };
}

function throwGuideCompatibilityError(
  input: Parameters<typeof prepareLegendInputs>[0],
  aesthetic: GuideAesthetic,
  actual: string,
  expected: string,
): never {
  throw new PipelineError(
    "guide-aesthetic-incompatible",
    input.guides?.[aesthetic] === undefined ? `/scales/${aesthetic}/guide` : `/guides/${aesthetic}`,
    `The ${actual} guide is incompatible with the trained ${expected} guide for ${aesthetic}. Use ${expected}, none, or choose a matching explicit scale family.`,
  );
}

function singleManualLegend(
  plan: Exclude<GuidePlan, { type: "axis" }>,
  appearance: ResolvedLegendAppearance,
): boolean {
  return (
    plan.type === "discrete" &&
    (plan.scaleType === "manual" || plan.scaleType === "identity") &&
    plan.entries.length < 2 &&
    appearance.force !== true
  );
}

function mergePreparedLegends(prepared: readonly PreparedLegend[]): LegendInput[] {
  const out: LegendInput[] = [];
  const merged = new Set<number>();
  for (let index = 0; index < prepared.length; index++) {
    if (merged.has(index)) continue;
    const current = prepared[index]!;
    if (current.input.kind !== "discrete" || current.identity.startsWith("unique:")) {
      out.push(current.input);
      continue;
    }
    const group = [current];
    for (let other = index + 1; other < prepared.length; other++) {
      const candidate = prepared[other]!;
      if (
        candidate.identity !== current.identity ||
        candidate.input.kind !== "discrete" ||
        !group.every((member) => paintCompatible(member, candidate))
      )
        continue;
      merged.add(other);
      group.push(candidate);
    }
    out.push(mergeDiscrete(group.map((member) => member.input as DiscreteLegendInput)));
  }
  return out.toSorted(
    (left, right) => (left.appearance?.order ?? 0) - (right.appearance?.order ?? 0),
  );
}
