/**
 * Shared types for the held-out NL→spec eval harness (milestone M3).
 *
 * The corpus under tests/evals/cases/ is HELD OUT BY CONSTRUCTION: every case
 * is written fresh for this harness — never copied from the examples corpus,
 * never published to docs — so measured scores reflect generalization, not
 * memorized documentation.
 */
import type { DataProfile, PortableSpec, SpecError } from "@ggts-sh/spec";

/** What a case probes. */
export type CaseKind =
  | "chart"
  | "adversarial-ambiguous"
  | "adversarial-missing-field"
  | "adversarial-unsupported";

/** One inline row (strict JSON cell values). */
export type Row = Record<string, string | number | boolean | null>;

/** One held-out eval case (cases/NN-slug.json). */
export interface EvalCase {
  /** Unique id; must equal the file basename without ".json". */
  id: string;
  kind: CaseKind;
  /** The natural-language request handed to the model. */
  prompt: string;
  /** The DataProfile handed to the model alongside the prompt. */
  dataProfile: DataProfile;
  /**
   * Small deterministic inline rows for render scoring, keyed by dataset
   * name (the first key is the primary dataset). Null for refusal cases.
   */
  data: Record<string, Row[]> | null;
  /**
   * The reference answer in CANONICAL form (normalize() output — layers
   * self-contained, stat/position filled, no plot-level aes). Null for
   * unsupported-refusal cases.
   */
  gold: PortableSpec | null;
  /** True when the correct behavior is the documented refusal shape. */
  expectRefusal: boolean;
  /** Why this case exists / what it probes. */
  notes: string;
}

/**
 * The documented graceful-refusal shape: instead of a spec, the model replies
 * with this JSON object (see run.ts header for the full contract).
 */
export interface RefusalReply {
  unsupported: string;
  closestAlternative: PortableSpec | null;
}

/** Structural rubric breakdown (weights documented in score.ts). */
export interface StructuralScore {
  /** Multiset similarity of layer geoms (weight 0.4). */
  geoms: number;
  /** Channel→field binding agreement (weight 0.4). */
  bindings: number;
  /** Scales/facet/coord/non-default-position facts reproduced (weight 0.2). */
  extras: number;
  /** Weighted total in [0, 1]. */
  total: number;
}

/** The graded outcome for one case. */
export interface CaseScore {
  id: string;
  kind: CaseKind;
  expectRefusal: boolean;
  /** The model reply parsed as the refusal shape. */
  refused: boolean;
  /** First attempt normalized + validated ok (hard gate, pre-repair). */
  validity: boolean;
  /** Final attempt (after the optional repair round) validated ok. */
  validityAfterRepair: boolean;
  /** A repair round actually ran. */
  repaired: boolean;
  /** Structural rubric vs gold (null when not applicable). */
  structural: StructuralScore | null;
  /** Headless renderToSVGString succeeded (null when not attempted). */
  renderOk: boolean | null;
  /** Render failure message, when renderOk is false. */
  renderError?: string;
  pass: boolean;
  /** Validation errors from the FINAL attempt (for the report). */
  errors: SpecError[];
  /** The final normalized candidate spec (null when none validated). */
  candidate: PortableSpec | null;
  /** Raw final model reply (truncated for the scoreboard). */
  reply: string;
}

export interface ScoreboardTotals {
  passRate: number;
  meanStructural: number;
  validityRate: number;
  validityAfterRepairRate: number;
  renderRate: number;
  refusalAccuracy: number;
}

export interface Scoreboard {
  meta: {
    timestamp: string;
    model: string;
    dryRun: boolean;
    caseCount: number;
  };
  totals: ScoreboardTotals;
  cases: CaseScore[];
}
