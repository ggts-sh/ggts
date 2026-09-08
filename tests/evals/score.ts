/**
 * Pure scoring for the NL→spec eval harness. No network, no I/O.
 *
 * RUBRIC (documented thresholds)
 * ------------------------------
 * Hard gate: the reply must parse as JSON (markdown fences are stripped if
 * present), then survive normalize() followed by validate(spec, { profile })
 * with ok: true. Validity is counted PRE-repair (`validity`) and POST-repair
 * (`validityAfterRepair`) separately.
 *
 * Structural score (candidate vs gold, BOTH normalized), weights sum to 1:
 *   - geoms    0.4  multiset similarity of layer geoms: |∩| / |∪|.
 *   - bindings 0.4  channel→field agreement: layers aligned by geom
 *                   (greedy, in order; leftovers pair in order), then over
 *                   the union of field-mapped channels in the gold+candidate
 *                   layers, the fraction whose (channel, field) pair matches.
 *   - extras   0.2  fraction of gold's NON-DEFAULT facts reproduced: facet
 *                   form + fields (+ non-fixed facet scales), coord flip,
 *                   declared scale types, and layer positions that differ
 *                   from the geom's default. Gold with no such facts scores 1.
 *
 * PASS (chart-shaped cases): hard gate passed AND structural >= 0.8
 * (PASS_STRUCTURAL) AND the candidate renders headlessly (renderOk).
 *
 * Refusal cases (expectRefusal): pass iff the reply parses as the documented
 * refusal shape {"unsupported": string, "closestAlternative": spec|null}.
 *
 * adversarial-missing-field cases: the gold uses the closest REAL field
 * (expectRefusal false), but a refusal-shaped reply — the model asking
 * instead of guessing — is tolerated and also counts as a pass.
 *
 * Render check: rows come from the case's inline `data` (primary = first
 * key); when a chart case carries none, 20 deterministic rows are
 * synthesized from the profile with a seeded mulberry32 PRNG. The candidate
 * is rendered with its data ref forced to the harness dataset (the request's
 * data is out of band by construction) and any candidate `datasets` dropped.
 */
import type { DataProfile, PortableSpec, SpecError, SpecInput } from "@ggts-sh/spec";
import { GEOM_DEFAULTS, normalize, validate } from "@ggts-sh/spec";
import { registerAll, renderToSVGString } from "@ggts-sh/core";

// Headless full-grammar rendering (#1420): explicit opt-in.
registerAll();

import type { EvalCase, RefusalReply, Row, StructuralScore } from "./types.ts";

export const PASS_STRUCTURAL = 0.8;
export const WEIGHT_GEOMS = 0.4;
export const WEIGHT_BINDINGS = 0.4;
export const WEIGHT_EXTRAS = 0.2;
export const RENDER_WIDTH = 640;
export const RENDER_HEIGHT = 400;
export const SYNTH_ROWS = 20;

// ---------------------------------------------------------------------------
// Reply parsing
// ---------------------------------------------------------------------------

export type ParsedReply =
  | { kind: "refusal"; refusal: RefusalReply }
  | { kind: "spec"; spec: unknown }
  | { kind: "unparseable"; error: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Strip a surrounding markdown code fence (```json ... ```), if present. */
export function stripFences(raw: string): string {
  const trimmed = raw.trim();
  const match = /^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```$/.exec(trimmed);
  return match === null ? trimmed : match[1]!.trim();
}

/** Parse a raw model reply into a refusal, a candidate spec, or a failure. */
export function parseReply(raw: string): ParsedReply {
  let value: unknown;
  try {
    value = JSON.parse(stripFences(raw));
  } catch (error) {
    return {
      kind: "unparseable",
      error: `Reply is not JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (isRecord(value) && typeof value["unsupported"] === "string") {
    return {
      kind: "refusal",
      refusal: {
        unsupported: value["unsupported"],
        closestAlternative: (value["closestAlternative"] ?? null) as PortableSpec | null,
      },
    };
  }
  return { kind: "spec", spec: value };
}

// ---------------------------------------------------------------------------
// Hard gate: normalize, then validate against the profile
// ---------------------------------------------------------------------------

export interface GateResult {
  ok: boolean;
  spec: PortableSpec | null;
  errors: SpecError[];
}

/** normalize() first, then validate(candidate, { profile }). */
export function gate(candidate: unknown, profile: DataProfile): GateResult {
  let normalized: unknown;
  try {
    normalized = normalize(candidate as SpecInput);
  } catch (error) {
    return {
      ok: false,
      spec: null,
      errors: [
        {
          code: "invalid-spec-root",
          path: "",
          message: `normalize() threw: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
  const result = validate(normalized, { profile });
  if (result.ok) return { ok: true, spec: result.spec, errors: [] };
  return { ok: false, spec: null, errors: result.errors };
}

// ---------------------------------------------------------------------------
// Structural score
// ---------------------------------------------------------------------------

type Layerish = {
  geom: string;
  stat?: string;
  position?: string;
  aes?: Record<string, unknown>;
};

function layersOf(spec: PortableSpec): Layerish[] {
  return spec.layers;
}

/** Multiset similarity |∩| / |∪| of the two layer-geom multisets. */
export function geomSimilarity(gold: PortableSpec, candidate: PortableSpec): number {
  const count = (spec: PortableSpec): Map<string, number> => {
    const m = new Map<string, number>();
    for (const layer of layersOf(spec)) m.set(layer.geom, (m.get(layer.geom) ?? 0) + 1);
    return m;
  };
  const a = count(gold);
  const b = count(candidate);
  let intersection = 0;
  let union = 0;
  const keys = new Set([...a.keys(), ...b.keys()]);
  for (const key of keys) {
    const na = a.get(key) ?? 0;
    const nb = b.get(key) ?? 0;
    intersection += Math.min(na, nb);
    union += Math.max(na, nb);
  }
  return union === 0 ? 1 : intersection / union;
}

/** Field-mapped channels of one layer, as channel → field. */
function fieldBindings(layer: Layerish | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (layer?.aes === undefined) return out;
  for (const [channel, value] of Object.entries(layer.aes)) {
    if (isRecord(value) && typeof value["field"] === "string") {
      out.set(channel, value["field"]);
    }
  }
  return out;
}

/** Align layers by geom (greedy, stable order); leftovers pair in order. */
export function alignLayers(
  gold: PortableSpec,
  candidate: PortableSpec,
): Array<[Layerish | undefined, Layerish | undefined]> {
  const goldLayers = layersOf(gold);
  const candLayers = layersOf(candidate);
  const consumed = new Set<number>();
  const pairs: Array<[Layerish | undefined, Layerish | undefined]> = [];
  const leftoverGold: Layerish[] = [];
  for (const g of goldLayers) {
    const j = candLayers.findIndex((c, idx) => !consumed.has(idx) && c.geom === g.geom);
    if (j === -1) {
      leftoverGold.push(g);
    } else {
      consumed.add(j);
      pairs.push([g, candLayers[j]]);
    }
  }
  const leftoverCand = candLayers.filter((_, idx) => !consumed.has(idx));
  const n = Math.max(leftoverGold.length, leftoverCand.length);
  for (let i = 0; i < n; i++) pairs.push([leftoverGold[i], leftoverCand[i]]);
  return pairs;
}

/** Channel→field binding agreement over aligned layers. */
export function bindingSimilarity(gold: PortableSpec, candidate: PortableSpec): number {
  let matches = 0;
  let union = 0;
  for (const [g, c] of alignLayers(gold, candidate)) {
    const gb = fieldBindings(g);
    const cb = fieldBindings(c);
    const channels = new Set([...gb.keys(), ...cb.keys()]);
    for (const channel of channels) {
      union += 1;
      if (gb.has(channel) && gb.get(channel) === cb.get(channel)) matches += 1;
    }
  }
  return union === 0 ? 1 : matches / union;
}

/** Non-default facts: facet form+fields, coord flip, scale types, positions. */
export function nonDefaultFacts(spec: PortableSpec): string[] {
  const facts: string[] = [];
  const s = spec as unknown as Record<string, unknown>;

  addFacetFacts(s["facet"], facts);

  const coord = s["coord"];
  if (isRecord(coord) && coord["type"] === "flip") facts.push("coord=flip");

  addScaleFacts(s["scales"], facts);
  addPositionFacts(spec, facts);
  return facts;
}

function addFacetFacts(facet: unknown, facts: string[]): void {
  if (isRecord(facet)) {
    for (const form of ["wrap", "rows", "cols"] as const) {
      const ref = facet[form];
      if (isRecord(ref) && typeof ref["field"] === "string") {
        facts.push(`facet.${form}=${ref["field"]}`);
      }
    }
    if (typeof facet["scales"] === "string" && facet["scales"] !== "fixed") {
      facts.push(`facet.scales=${facet["scales"]}`);
    }
  }
}

function addScaleFacts(scales: unknown, facts: string[]): void {
  if (isRecord(scales)) {
    for (const channel of ["x", "y", "color", "fill"] as const) {
      const config = scales[channel];
      if (isRecord(config) && typeof config["type"] === "string") {
        facts.push(`scales.${channel}.type=${config["type"]}`);
      }
    }
  }
}

function addPositionFacts(spec: PortableSpec, facts: string[]): void {
  const seen = new Map<string, number>();
  for (const layer of layersOf(spec)) {
    const defaults = GEOM_DEFAULTS[layer.geom as keyof typeof GEOM_DEFAULTS];
    const position = layer.position ?? defaults?.position ?? "identity";
    if (defaults !== undefined && position !== defaults.position) {
      const key = `position:${layer.geom}=${position}`;
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      facts.push(n === 0 ? key : `${key}#${n}`); // multiset-safe within a set
    }
  }
}

/** Fraction of gold's non-default facts reproduced by the candidate. */
export function extrasSimilarity(gold: PortableSpec, candidate: PortableSpec): number {
  const goldFacts = nonDefaultFacts(gold);
  if (goldFacts.length === 0) return 1;
  const candFacts = new Set(nonDefaultFacts(candidate));
  let reproduced = 0;
  for (const fact of goldFacts) if (candFacts.has(fact)) reproduced += 1;
  return reproduced / goldFacts.length;
}

export function structuralScore(gold: PortableSpec, candidate: PortableSpec): StructuralScore {
  const round3 = (n: number): number => Math.round(n * 1000) / 1000;
  const geoms = geomSimilarity(gold, candidate);
  const bindings = bindingSimilarity(gold, candidate);
  const extras = extrasSimilarity(gold, candidate);
  const total = WEIGHT_GEOMS * geoms + WEIGHT_BINDINGS * bindings + WEIGHT_EXTRAS * extras;
  return {
    geoms: round3(geoms),
    bindings: round3(bindings),
    extras: round3(extras),
    total: round3(total),
  };
}

// ---------------------------------------------------------------------------
// Render check
// ---------------------------------------------------------------------------

/** mulberry32 — tiny seeded PRNG (deterministic synth data only). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SYNTH_CATEGORIES = ["alpha", "beta", "gamma", "delta"] as const;

/** Deterministic rows synthesized from a DataProfile (seeded mulberry32). */
export function synthesizeRows(profile: DataProfile, rowCount = SYNTH_ROWS): Row[] {
  const rand = mulberry32(0xa11ce);
  const rows: Row[] = [];
  for (let i = 0; i < rowCount; i++) {
    const row: Row = {};
    for (const field of profile.fields) {
      switch (field.type) {
        case "quantitative":
          row[field.name] = Math.round((1 + rand() * 99) * 100) / 100;
          break;
        case "temporal": {
          const day = String((i % 28) + 1).padStart(2, "0");
          row[field.name] = `2026-03-${day}`;
          break;
        }
        default: {
          const examples = field.examples?.filter((e) => typeof e === "string");
          const pool =
            examples !== undefined && examples.length > 0 ? examples : [...SYNTH_CATEGORIES];
          row[field.name] = pool[i % pool.length]!;
        }
      }
    }
    rows.push(row);
  }
  return rows;
}

export interface RenderResult {
  ok: boolean;
  error?: string;
}

/**
 * Render the candidate headlessly against the case's inline data. The data
 * ref is forced to the harness's primary dataset (candidate datasets are
 * dropped) — the eval data is out of band by construction.
 */
export function renderCheck(spec: PortableSpec, evalCase: EvalCase): RenderResult {
  const data = evalCase.data ?? { main: synthesizeRows(evalCase.dataProfile) };
  const primary = Object.keys(data)[0] ?? "main";
  const runnable = { ...spec, data: { name: primary } } as SpecInput & {
    datasets?: unknown;
  };
  delete runnable.datasets;
  try {
    const svg = renderToSVGString(runnable, {
      width: RENDER_WIDTH,
      height: RENDER_HEIGHT,
      data,
    });
    return svg.length > 0 ? { ok: true } : { ok: false, error: "empty SVG output" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
