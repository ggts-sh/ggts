/**
 * Competitive browser budget gate: compares results/browser.json (written by
 * `bun run measure:browser`) against the committed budgets.json, then locks
 * the Svelte-peer win with a same-run relative gate. Exits 1 on any
 * violation. Mirrors ../../benchmarks/check-budgets.ts conventions.
 *
 *   1. Absolute: every ggsvelte-* ok result's mount median (and update
 *      median, when measuresUpdate is set) must be <= its budgets.json
 *      entry. ggsvelte cells and budget keys must cover the SAME set —
 *      asserted in BOTH directions so a new cell cannot dodge budgeting and
 *      a stale budget cannot linger after a cell is removed.
 *   2. Relative: the win this gate locks is against the Svelte ecosystem
 *      peers, paired by render form factor (scenarios.ts LIBS[].form):
 *      ggsvelte-svg vs SVG peers (layercake, svelteplot), ggsvelte-canvas
 *      vs canvas peers (layercake-canvas). General-purpose reference bars
 *      (d3/uplot/chartjs/echarts/tanstack-react) are reported but NEVER gated. Same-run
 *      same-runner comparison, so no headroom factor. A peer cell that
 *      errored outright FAILS the gate — we want to know when a fixture
 *      breaks.
 *   3. Known gaps (budgets.json "knownGaps"): explicit, issue-tracked
 *      exemptions to the relative gate. The ratchet is self-destructing —
 *      if a listed gap CLOSES beyond the short-cell noise margin, the check
 *      FAILS until the exemption is removed, so the gate tightens
 *      automatically as gaps are fixed without flapping on jitter.
 *
 * Cell lists are data-driven from results/browser.json: peers gaining new
 * cells (area, bars, ...) are picked up automatically.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { LIBS } from "./scenarios";

interface BrowserResult {
  lib: string;
  caseId: string;
  ok: boolean;
  mountMedianMs?: number;
  updateMedianMs?: number;
  mountSyncMedianMs?: number;
  updateSyncMedianMs?: number;
  error?: string;
}

interface BrowserFile {
  generatedAt?: string;
  /** Set by measure-browser when in-place update medians were measured. */
  measuresUpdate?: boolean;
  measuresSync?: boolean;
  results: BrowserResult[];
}

interface KnownGap {
  /** ggsvelte lib id that currently LOSES the comparison. */
  ggsvelte: string;
  /** Peer lib id it loses to. */
  peer: string;
  caseId: string;
  /** "mount" or "update" — which timing the exemption covers. */
  kind: "mount" | "update";
  /** Tracking issue URL/number — required so exemptions cannot rot silently. */
  issue: string;
  note?: string;
}

interface BudgetsFile {
  budgets: Record<string, { budgetMs: number }>;
  knownGaps?: KnownGap[];
}

/** General-purpose reference bars, NOT Svelte peers: useful context in the
 * report, but the win this gate locks is against the Svelte ecosystem peers. */
const REFERENCE_LIBS = new Set(["d3", "uplot", "chartjs", "echarts", "tanstack-react"]);

const isGgsvelte = (lib: string) => lib.startsWith("ggsvelte");
const isPeer = (lib: string) => !isGgsvelte(lib) && !REFERENCE_LIBS.has(lib);

const FORM_BY_LIB = new Map(LIBS.map((l) => [l.id, l.form] as const));

/** Max allowed ggsvelte/peer median ratio in the relative gate. */
const MAX_RELATIVE_RATIO = 1.0;
/** Short-cell tolerance: unthrottled double-rAF totals still include host and
 * compositor scheduling, so near-equal medians can cross a strict 1.0 ratio.
 * The paired sync medians corroborate a total-time loss before CI fails;
 * repeat dense contested cells before changing an exemption. */
const REL_EPS = 0.02;
const ABS_EPS_MS = 2;
const withinGate = (ggMs: number, peerMs: number) =>
  ggMs <= peerMs * (MAX_RELATIVE_RATIO + REL_EPS) + ABS_EPS_MS;
/** A known gap closes only after ggsvelte wins beyond the same noise margin. */
const clearlyBeats = (ggMs: number, peerMs: number) =>
  ggMs * (MAX_RELATIVE_RATIO + REL_EPS) + ABS_EPS_MS <= peerMs;

function fail(message: string): never {
  console.error(`check-budgets: ${message}`);
  process.exit(1);
}

function readJson(url: URL, what: string): unknown {
  const path = fileURLToPath(url);
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return fail(
      `missing ${what} at ${path}${what === "results/browser.json" ? " — run `bun run measure:browser` first" : ""}`,
    );
  }
  try {
    return JSON.parse(raw);
  } catch {
    return fail(`${what} at ${path} is not valid JSON`);
  }
}

// --- load + validate shapes --------------------------------------------------

const browserJson = readJson(
  new URL("./results/browser.json", import.meta.url),
  "results/browser.json",
) as BrowserFile;
if (!Array.isArray(browserJson.results) || browserJson.results.length === 0) {
  fail('results/browser.json must have a non-empty "results" array');
}
const results = browserJson.results;
const measuresUpdate = browserJson.measuresUpdate === true;
if (browserJson.measuresSync !== true) {
  fail("results/browser.json has no paired sync measurements — rerun `bun run measure:browser`");
}

type Kind = "mount" | "update";
const KINDS: readonly Kind[] = measuresUpdate ? ["mount", "update"] : ["mount"];
const medianOf = (r: BrowserResult, kind: Kind): number | undefined =>
  kind === "mount" ? r.mountMedianMs : r.updateMedianMs;
const syncMedianOf = (r: BrowserResult, kind: Kind): number | undefined =>
  kind === "mount" ? r.mountSyncMedianMs : r.updateSyncMedianMs;

for (const r of results) {
  if (typeof r.lib !== "string" || typeof r.caseId !== "string" || typeof r.ok !== "boolean") {
    fail(`malformed result entry: ${JSON.stringify(r)}`);
  }
  if (!FORM_BY_LIB.has(r.lib as never)) {
    fail(`result lib "${r.lib}" is not in scenarios.ts LIBS — add it (with a form) first`);
  }
  for (const kind of KINDS) {
    const v = medianOf(r, kind);
    if (r.ok && (typeof v !== "number" || !Number.isFinite(v))) {
      fail(`ok result missing ${kind} median: ${JSON.stringify(r)}`);
    }
    const sync = syncMedianOf(r, kind);
    if (r.ok && (typeof sync !== "number" || !Number.isFinite(sync))) {
      fail(`ok result missing ${kind} sync median: ${JSON.stringify(r)}`);
    }
  }
}

const budgetsJson = readJson(new URL("./budgets.json", import.meta.url), "budgets.json");
const budgetsFile = budgetsJson as BudgetsFile;
if (typeof budgetsFile.budgets !== "object" || budgetsFile.budgets === null) {
  fail('budgets.json must have a "budgets" object');
}
const budgets = budgetsFile.budgets;
for (const [key, entry] of Object.entries(budgets)) {
  if (!isGgsvelte(key.split(" ")[0]!)) {
    fail(`budget key "${key}" is not a ggsvelte lib — peers get no absolute budgets`);
  }
  if (
    typeof entry.budgetMs !== "number" ||
    !Number.isFinite(entry.budgetMs) ||
    entry.budgetMs <= 0
  ) {
    fail(`malformed budget entry for "${key}": ${JSON.stringify(entry)}`);
  }
}

const knownGaps = budgetsFile.knownGaps ?? [];
for (const gap of knownGaps) {
  if (
    !isGgsvelte(gap.ggsvelte) ||
    !isPeer(gap.peer) ||
    typeof gap.caseId !== "string" ||
    (gap.kind !== "mount" && gap.kind !== "update") ||
    typeof gap.issue !== "string" ||
    gap.issue.length === 0
  ) {
    fail(`malformed knownGaps entry: ${JSON.stringify(gap)}`);
  }
  if (gap.kind === "update" && !measuresUpdate) {
    fail(
      `knownGaps entry covers "update" but results/browser.json has measuresUpdate=false: ${JSON.stringify(gap)}`,
    );
  }
}

// --- 1. absolute budgets (ggsvelte cells only) --------------------------------

const ggsvelteResults = results.filter((r) => isGgsvelte(r.lib));
const budgetKey = (r: BrowserResult, kind: Kind) => `${r.lib} ${r.caseId} ${kind}`;

const cellKeys = new Set(ggsvelteResults.flatMap((r) => KINDS.map((k) => budgetKey(r, k))));
const missingBudgets = [...cellKeys].filter((key) => !(key in budgets));
if (missingBudgets.length > 0) {
  fail(
    `ggsvelte cells without a budget (add them to benchmarks/competitive/budgets.json): ${missingBudgets.join(", ")}`,
  );
}
const staleBudgets = Object.keys(budgets).filter((key) => !cellKeys.has(key));
if (staleBudgets.length > 0) {
  fail(
    `budget entries with no result cell (stale? remove or re-run measure:browser): ${staleBudgets.join(", ")}`,
  );
}

let failures = 0;

const absNameWidth = Math.max(...[...cellKeys].map((k) => k.length), "cell".length);
console.log(
  [
    "cell".padEnd(absNameWidth),
    "measured".padStart(13),
    "budget".padStart(13),
    "headroom".padStart(9),
    "",
  ].join("  "),
);
for (const r of ggsvelteResults) {
  for (const kind of KINDS) {
    const key = budgetKey(r, kind);
    const budgetMs = budgets[key]!.budgetMs;
    if (!r.ok) {
      failures++;
      console.log(
        key.padEnd(absNameWidth),
        "ERROR".padStart(13),
        `${budgetMs.toFixed(1).padStart(10)} ms`,
        "".padStart(9),
        `OVER BUDGET (cell errored: ${(r.error ?? "").slice(0, 60)})`,
      );
      continue;
    }
    const measured = medianOf(r, kind)!;
    const over = measured > budgetMs;
    if (over) failures++;
    const headroomPct = ((budgetMs - measured) / budgetMs) * 100;
    console.log(
      [
        key.padEnd(absNameWidth),
        `${measured.toFixed(1).padStart(10)} ms`,
        `${budgetMs.toFixed(1).padStart(10)} ms`,
        `${headroomPct.toFixed(1).padStart(7)} %`,
        over ? "OVER BUDGET" : "ok",
      ].join("  "),
    );
  }
}

// --- 2. relative gate: ggsvelte vs Svelte peers, same form factor -------------

const erroredPeers = results.filter((r) => isPeer(r.lib) && !r.ok);
for (const r of erroredPeers) {
  failures++;
  console.error(
    `check-budgets: peer cell errored outright (fixture broken?): ${r.lib} ${r.caseId}: ${(r.error ?? "").slice(0, 120)}`,
  );
}

const okGgsvelte = ggsvelteResults.filter((r) => r.ok);
const okPeers = results.filter((r) => isPeer(r.lib) && r.ok);

type Comparison = {
  kind: Kind;
  caseId: string;
  ggLib: string;
  peerLib: string;
  ggMs: number;
  peerMs: number;
  ratio: number;
  totalPass: boolean;
  syncPass: boolean;
  pass: boolean;
  /** Same-form peer pair that is GATED, vs cross-form context that is not. */
  gated: boolean;
  gap?: KnownGap;
};
const comparisons: Comparison[] = [];
for (const gg of okGgsvelte) {
  for (const peer of okPeers) {
    if (peer.caseId !== gg.caseId) continue;
    const sameForm = FORM_BY_LIB.get(gg.lib as never) === FORM_BY_LIB.get(peer.lib as never);
    for (const kind of KINDS) {
      const ggMs = medianOf(gg, kind)!;
      const peerMs = medianOf(peer, kind)!;
      const ratio = ggMs / peerMs;
      const totalPass = withinGate(ggMs, peerMs);
      const syncPass = withinGate(syncMedianOf(gg, kind)!, syncMedianOf(peer, kind)!);
      // A total-only miss can be frame/compositor scheduling drift. Require
      // the paired synchronous phase to corroborate it before failing CI.
      const pass = totalPass || syncPass;
      const gap = knownGaps.find(
        (g) =>
          g.ggsvelte === gg.lib && g.peer === peer.lib && g.caseId === gg.caseId && g.kind === kind,
      );
      comparisons.push({
        kind,
        caseId: gg.caseId,
        ggLib: gg.lib,
        peerLib: peer.lib,
        ggMs,
        peerMs,
        ratio,
        totalPass,
        syncPass,
        pass,
        // Framework hosts have their own regression budgets; do not require
        // React or Svelte to beat every unrelated Svelte peer.
        gated: sameForm && (gg.lib === "ggsvelte-svg" || gg.lib === "ggsvelte-canvas"),
        gap,
      });
    }
  }
}

if (comparisons.length === 0) {
  fail(
    "no ggsvelte-vs-peer comparisons possible — are peer cells missing from results/browser.json?",
  );
}

const knownGapKeys = new Set(knownGaps.map((g) => `${g.ggsvelte}|${g.peer}|${g.caseId}|${g.kind}`));
const seenGapKeys = new Set<string>();

for (const c of comparisons) {
  if (!c.gated) continue; // cross-form context: printed, never gated
  if (c.gap) {
    seenGapKeys.add(`${c.gap.ggsvelte}|${c.gap.peer}|${c.gap.caseId}|${c.gap.kind}`);
    if (clearlyBeats(c.ggMs, c.peerMs)) {
      // Ratchet: require a win beyond the short-cell noise margin. `c.pass`
      // cannot prove a known gap closed because it includes that tolerance.
      failures++;
      console.error(
        `check-budgets: known gap CLOSED (ggsvelte ${c.ggMs.toFixed(1)}ms <= ${c.peerLib} ${c.peerMs.toFixed(1)}ms on ${c.caseId} ${c.kind}) — remove the exemption from budgets.json knownGaps (${c.gap.issue})`,
      );
    }
    continue;
  }
  if (!c.pass) failures++;
}
for (const key of knownGapKeys) {
  if (!seenGapKeys.has(key)) {
    failures++;
    console.error(
      `check-budgets: knownGaps entry matched no gated comparison (stale exemption?): ${key}`,
    );
  }
}

const colW = (sel: (c: Comparison) => string, min: string) =>
  Math.max(...comparisons.map((c) => sel(c).length), min.length);

console.log("\n=== Relative gate: ggsvelte vs Svelte peers (median, same run) ===\n");
console.log(
  [
    "kind".padEnd(6),
    "case".padEnd(colW((c) => c.caseId, "case")),
    "ggsvelte".padEnd(colW((c) => c.ggLib, "ggsvelte")),
    "peer".padEnd(colW((c) => c.peerLib, "peer")),
    "ggsvelte ms".padStart(12),
    "peer ms".padStart(12),
    "ratio".padStart(7),
    "verdict",
  ].join("  "),
);
for (const c of comparisons) {
  const verdict = !c.gated
    ? "info (ungated comparison)"
    : c.gap
      ? clearlyBeats(c.ggMs, c.peerMs)
        ? `STALE GAP — remove exemption (${c.gap.issue})`
        : `known gap (${c.gap.issue})`
      : c.pass
        ? c.totalPass
          ? "PASS"
          : "PASS (sync corroboration)"
        : "FAIL";
  console.log(
    [
      c.kind.padEnd(6),
      c.caseId.padEnd(colW((x) => x.caseId, "case")),
      c.ggLib.padEnd(colW((x) => x.ggLib, "ggsvelte")),
      c.peerLib.padEnd(colW((x) => x.peerLib, "peer")),
      c.ggMs.toFixed(1).padStart(12),
      c.peerMs.toFixed(1).padStart(12),
      c.ratio.toFixed(3).padStart(7),
      verdict,
    ].join("  "),
  );
}

// --- verdict -----------------------------------------------------------------

if (failures > 0) {
  console.error(`\ncheck-budgets: ${failures} violation(s)`);
  process.exit(1);
}
console.log(
  `\ncheck-budgets: ${ggsvelteResults.length} ggsvelte cells within budget; ${comparisons.filter((c) => c.gated).length} gated peer comparison(s) PASS`,
);
