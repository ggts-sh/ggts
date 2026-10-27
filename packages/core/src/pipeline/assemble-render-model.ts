/**
 * Assemble the public RenderModel (scene, scales, contracts, dispose/row).
 */
import type { PanelCoordProjector } from "../coord-projector.js";
import type { GuideDegradedCode } from "../layout/guide-degraded-codes.js";
import type { TickFormatter } from "../layout/layout.js";
import type { GuidePlan } from "../layout/temporal-guide.js";
import type { ResolvedStyleScale } from "../scales/style.js";
import type { ScaleState } from "../scales/state.js";
import type { PositionScale } from "../scales/train.js";
import type { Scene } from "../scene.js";
import type { CellValue, ColumnTable } from "../table.js";
import type { LazyInteraction } from "../candidate-runtime.js";
import { createSemanticViewport } from "../semantic-viewport.js";
import type { AdvisoryCode } from "../diagnostics.js";

import {
  dedupeRenderModelDiagnostics,
  freezeRenderModelDomains,
} from "./assemble-render-model-domains.js";
import {
  buildRenderModelAxisFormatters,
  buildRenderModelScales,
} from "./assemble-render-model-scales.js";
import { createRenderModelLifecycle } from "./assemble-render-model-lifecycle.js";
import type { SourceRegistry } from "./source-registry.js";
import type { PositionConversionContext } from "./temporal-position.js";
import type {
  Advisory,
  LayerBackend,
  MappedField,
  PipelineWarning,
  RenderModel,
  ResolvedColorScale,
  ScaleDecision,
  ScaleDiagnostic,
  ScaleDomainSnapshot,
} from "./types.js";

export interface AssembleRenderModelInput {
  scene: Scene;
  xScale: PositionScale;
  yScale: PositionScale;
  color: ResolvedColorScale | null;
  fill: ResolvedColorScale | null;
  styles: Record<string, ResolvedStyleScale | null>;
  panelScales: { x: PositionScale; y: PositionScale }[];
  colorState: ScaleState | null;
  fillState: ScaleState | null;
  styleStates: Record<string, ScaleState | null>;
  warnings: PipelineWarning[];
  advisories: Advisory[];
  scaleDecisions: ScaleDecision[];
  scaleDiagnostics: ScaleDiagnostic[];
  guidePlans: readonly GuidePlan[];
  coordProjectors: readonly PanelCoordProjector[];
  flipped: boolean;
  xConversion: PositionConversionContext;
  yConversion: PositionConversionContext;
  runId: number;
  layerBackends: LayerBackend[];
  layerFields: MappedField[][];
  layerPositions: readonly string[];
  layerScaledConstants: ReadonlyArray<Readonly<Partial<Record<string, CellValue>>>>;
  baselineDomains: ScaleDomainSnapshot;
  effectiveDomains: ScaleDomainSnapshot;
  interaction: LazyInteraction;
  formatX: TickFormatter | undefined;
  formatY: TickFormatter | undefined;
  table: ColumnTable;
  /** Multi-table global row registry (#589). When set, model.row uses it. */
  sourceRegistry?: SourceRegistry | null;
}

/** coord_flip fix shared by band degradations (each long label gets its own row). */
const COORD_FLIP_FIX = {
  description: "Map the category to y with coord_flip so each long label gets its own row.",
  typescript: ".coordFlip()",
  portable: { coord: { type: "flip" } },
} as const;

type BandGuideDegradedCode = Extract<
  GuideDegradedCode,
  "band-label-overlap" | "band-label-margin-overflow"
>;
type TemporalGuideDegradedCode = Extract<
  GuideDegradedCode,
  "temporal-label-overlap" | "temporal-label-margin-overflow" | "temporal-break-outside-domain"
>;

function bandGuideDiagnostic(
  code: BandGuideDegradedCode,
  plan: Extract<GuidePlan, { type: "axis" }>,
  vertical: boolean,
): ScaleDiagnostic {
  const aesthetic = plan.aesthetic;
  const mode = plan.bandLabelMode;
  const thinned = plan.ticks.some((tick) => tick.label === "" && tick.fullLabel !== "");
  const keepEveryFix = {
    description: `Keep every label with scales.${aesthetic}.guide.mode = "single" or collision: "preserve"; labels may overlap or exceed the margin.`,
  };
  if (code === "band-label-overlap" && thinned) {
    return {
      code,
      severity: "warning" as const,
      path: `/scales/${aesthetic}`,
      problem: plan.overlap
        ? "Some categorical labels were thinned, but shown labels still overlap."
        : "Some categorical labels were thinned to avoid overlap.",
      cause: "The category pitch is smaller than one label line at the available axis extent.",
      fixes: [
        {
          description:
            "Allocate more space along the categorical axis or reduce the number of categories.",
        },
        keepEveryFix,
      ],
      documentationUrl: "/guide/discrete-scales#categorical-axis-labels",
    };
  }
  if (code === "band-label-margin-overflow" && !plan.marginOverflow) {
    return {
      code,
      severity: "warning" as const,
      path: `/scales/${aesthetic}`,
      problem: "Some categorical labels were thinned to fit the bounded axis margin.",
      cause:
        "The widest labels exceed the bounded axis margin; hiding them reduces the shown footprint.",
      fixes: [
        { description: "Use shorter category labels or allocate more chart width." },
        keepEveryFix,
      ],
      documentationUrl: "/guide/discrete-scales#categorical-axis-labels",
    };
  }
  const margin = code === "band-label-margin-overflow";
  // A margin overflow on a single-line axis is a width-cap truncation, not a
  // rotated-label bottom-margin problem — steer the user to label width and
  // never claim rotation. Forced wrap overflow can need width and/or height.
  const singleLineCap = margin && mode === "single-line";
  const wrappedCap = margin && mode === "wrapped";
  return {
    code,
    severity: "warning" as const,
    path: `/scales/${aesthetic}`,
    problem: singleLineCap
      ? "A categorical label is truncated to fit the bounded axis margin."
      : wrappedCap
        ? "A wrapped categorical label exceeds the axis margin budget."
        : margin
          ? "A rotated categorical label is truncated to fit the axis margin cap."
          : "Categorical labels overlap at the available axis extent.",
    cause: singleLineCap
      ? "The complete label is wider than the bounded axis margin allows."
      : wrappedCap
        ? "The forced wrap footprint is taller than the bottom margin and/or wider than the side margin allows."
        : margin
          ? "The full label is longer than the bounded bottom margin allows, even rotated."
          : "There are more categories than the available axis extent can separate.",
    fixes: [
      {
        description: singleLineCap
          ? "Use shorter category labels or allocate more chart width."
          : wrappedCap
            ? "Use shorter category labels, fewer wrap lines, or allocate more chart width/height."
            : margin
              ? "Use shorter category labels or allocate more chart height."
              : "Reduce the number of categories or allocate more space along the categorical axis.",
      },
      ...(vertical ? [] : [COORD_FLIP_FIX]),
    ],
    documentationUrl: "/guide/discrete-scales#categorical-axis-labels",
  };
}

function temporalGuideDiagnostic(
  code: TemporalGuideDegradedCode,
  aesthetic: "x" | "y",
): ScaleDiagnostic {
  const margin = code === "temporal-label-margin-overflow";
  const outside = code === "temporal-break-outside-domain";
  return {
    code,
    severity: "warning" as const,
    path: `/scales/${aesthetic}${outside ? "/breaks" : ""}`,
    problem: outside
      ? "One or more explicit temporal breaks are outside the trained domain."
      : margin
        ? "Temporal labels exceed the axis margin cap."
        : "Temporal labels overlap at the available panel extent.",
    cause: outside
      ? "Breaks outside the scale domain cannot be projected onto this axis."
      : margin
        ? "The complete label text is wider than the bounded margin."
        : "No bounded automatic candidate fits, or authored breaks are denser than the extent.",
    fixes: [
      {
        description: outside
          ? "Remove the out-of-domain breaks or widen the explicit domain."
          : margin
            ? "Use a shorter dateLabels format or allocate more chart space."
            : "Use a coarser dateBreaks interval or allocate more chart space.",
      },
    ],
    documentationUrl: "/guide/temporal-scales#responsive-calendar-labels",
  };
}

function guidePlanDiagnostics(input: AssembleRenderModelInput): RenderModel["scaleDiagnostics"] {
  const seen = new Set<string>();
  return input.guidePlans.flatMap((plan) =>
    plan.type === "axis"
      ? plan.degraded.flatMap((code) => {
          const key = `${code}:${plan.aesthetic}`;
          if (seen.has(key)) return [];
          seen.add(key);
          if (plan.scaleType === "band") {
            if (code !== "band-label-overlap" && code !== "band-label-margin-overflow") return [];
            const vertical = (plan.aesthetic === "y") !== input.flipped;
            return [bandGuideDiagnostic(code, plan, vertical)];
          }
          if (
            code !== "temporal-label-overlap" &&
            code !== "temporal-label-margin-overflow" &&
            code !== "temporal-break-outside-domain"
          ) {
            return [];
          }
          return [temporalGuideDiagnostic(code, plan.aesthetic)];
        })
      : [],
  );
}

/** Advisories for the heuristic band label layout the planner chose (Hadley lesson 12). */
function bandLabelAdvisories(guidePlans: AssembleRenderModelInput["guidePlans"]): Advisory[] {
  const seen = new Set<string>();
  const out: Advisory[] = [];
  for (const plan of guidePlans) {
    if (plan.type !== "axis" || plan.scaleType !== "band") continue;
    // Author-pinned modes are intentional — do not emit heuristic wrap/rotate advisories.
    if (plan.bandLabelAuthorPinned === true) continue;
    const mode = plan.bandLabelMode;
    if (mode !== "wrapped" && mode !== "rotated") continue;
    const key = `${mode}:${plan.aesthetic}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const code: AdvisoryCode = mode === "wrapped" ? "band-labels-wrapped" : "band-labels-rotated";
    out.push(
      mode === "wrapped"
        ? {
            code,
            path: `/scales/${plan.aesthetic}`,
            chosen: "wrapped long labels onto multiple lines",
            howToOverride: `Set scales.${plan.aesthetic}.guide.mode ("single"|"wrap"|"rotate"|"off") or .guide.wrap, use shorter labels, or coordFlip() for horizontal bars.`,
          }
        : {
            code,
            path: `/scales/${plan.aesthetic}`,
            chosen: `rotated long labels ${String(plan.bandLabelAngle ?? -90)}°`,
            howToOverride: `Set scales.${plan.aesthetic}.guide.mode ("single"|"wrap"|"rotate"|"off") or .guide.angle, or coordFlip() for horizontal category rows.`,
          },
    );
  }
  return out;
}

/**
 * One plan-list pass buckets guide plan ids by aesthetic so each scale decision
 * indexes rather than rescanning the full plan list (#1310). Append order
 * matches guidePlans order — that order is user-visible through guide assignment.
 */
function guidePlanIdsByAesthetic(
  guidePlans: AssembleRenderModelInput["guidePlans"],
): ReadonlyMap<"x" | "y", readonly string[]> {
  const buckets: { x: string[]; y: string[] } = { x: [], y: [] };
  for (const plan of guidePlans) {
    if (plan.aesthetic === "x" || plan.aesthetic === "y") {
      buckets[plan.aesthetic].push(plan.id);
    }
  }
  // Freeze so decisions that share an aesthetic cannot mutate each other's list.
  return new Map<"x" | "y", readonly string[]>([
    ["x", Object.freeze(buckets.x)],
    ["y", Object.freeze(buckets.y)],
  ]);
}

export function assembleRenderModel(input: AssembleRenderModelInput): RenderModel {
  const { scene, interaction } = input;
  const scales = buildRenderModelScales(input);
  const lifecycle = createRenderModelLifecycle({
    scene,
    interaction,
    table: input.table,
    ...(input.sourceRegistry !== undefined && { sourceRegistry: input.sourceRegistry }),
  });
  const advisories = [...input.advisories, ...bandLabelAdvisories(input.guidePlans)];
  const diagnostics = dedupeRenderModelDiagnostics(input.warnings, advisories);
  const planIdsByAesthetic = guidePlanIdsByAesthetic(input.guidePlans);

  return {
    scene,
    scales,
    warnings: diagnostics.warnings,
    advisories: diagnostics.advisories,
    // Training rich diagnostics are emitted with structured facts at train time
    // (#628). Prepare-time transform/OOB entries are one-per-field and share an
    // axis path — do not collapse them here. Free-panel training dedupe lives
    // on the training channel before merge (finalize).
    scaleDiagnostics: [...input.scaleDiagnostics, ...guidePlanDiagnostics(input)],
    scaleDecisions: input.scaleDecisions.map((decision) => ({
      ...decision,
      domain: decision.aesthetic === "x" ? [...input.xScale.domain] : [...input.yScale.domain],
      guidePlanIds: planIdsByAesthetic.get(decision.aesthetic) ?? [],
    })),
    guidePlans: input.guidePlans,
    coordProjectors: input.coordProjectors,
    viewport: createSemanticViewport({
      panels: scene.panels,
      scales,
      coordProjectors: input.coordProjectors,
      flipped: input.flipped,
      candidates: interaction.ensure,
      sceneSize: { width: scene.width, height: scene.height },
    }),
    runId: input.runId,
    layerBackends: input.layerBackends,
    layerFields: input.layerFields,
    layerPositions: input.layerPositions,
    layerScaledConstants: input.layerScaledConstants,
    domains: freezeRenderModelDomains(input.baselineDomains, input.effectiveDomains),
    // Lazy getters (#1421): `candidates` builds the store on first access
    // through the installed runtime hook. `lineage` does NOT ensure: the
    // store populates it when it assembles (first candidate read), exactly
    // like the pre-#1421 eager build — a lineage-only reader pays nothing.
    get lineage() {
      return interaction.lineageStore;
    },
    get candidates() {
      return interaction.ensure();
    },
    axisFormatters: buildRenderModelAxisFormatters(
      input.xScale,
      input.yScale,
      input.formatX,
      input.formatY,
      input.xConversion,
      input.yConversion,
    ),
    row: lifecycle.row,
    dispose: lifecycle.dispose,
  };
}
