/**
 * NL→spec eval runner (milestone M3, held-out harness).
 *
 *   bun tests/evals/run.ts [--dry-run] [--cases id1,id2] [--max N]
 *                          [--repair | --no-repair] [--model id]
 *
 * For each case under tests/evals/cases/, the responder (a model via the
 * OpenRouter chat-completions API, or the deterministic MockResponder)
 * receives the system prompt + the case prompt with its DataProfile, and
 * must emit ONE ggts PortableSpec as JSON. The harness then normalizes, validates against the
 * profile, scores structurally against the gold, optionally runs ONE repair
 * round (default ON: re-prompt with the SpecError JSON — "errors include
 * fix.example — apply the fixes"), and renders the candidate headlessly.
 *
 * REFUSAL CONTRACT (documented; also stated in the system prompt): when a
 * request needs an unsupported chart type (choropleth map, 3D surface, ...)
 * the model must reply — instead of a spec — with exactly:
 *
 *   {"unsupported": "<one-sentence reason>",
 *    "closestAlternative": <a supported PortableSpec or null>}
 *
 * expectRefusal cases pass iff the reply parses as that shape. For
 * adversarial-missing-field cases the gold maps the closest real field, but
 * a refusal-shaped reply (asking instead of guessing) is tolerated as a
 * pass. Scoring thresholds live in score.ts.
 *
 * Responder selection: OpenRouterResponder when OPENROUTER_API_KEY is set
 * and --dry-run is not passed; otherwise a clear notice is logged and the
 * MockResponder runs (dry-run stays the default without the key). Structured
 * output is schema-in-prompt + validate-and-repair — see model.ts for why
 * json_schema response_format is deliberately not used. Calls are
 * sequential, 100ms apart (rate-limit friendly), 60s timeout each.
 *
 * Outputs: tests/evals/out/scoreboard.json and tests/evals/out/report.md.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { SpecError } from "@ggts-sh/spec";

import type { Responder } from "./model.ts";
import { MockResponder, OpenRouterResponder } from "./model.ts";
import { buildRepairPrompt, buildSystemPrompt, buildUserPrompt } from "./prompt.ts";
import { gate, parseReply, PASS_STRUCTURAL, renderCheck, structuralScore } from "./score.ts";
import type { CaseScore, EvalCase, Scoreboard, ScoreboardTotals } from "./types.ts";

const HERE = import.meta.dirname;
export const CASES_DIR = join(HERE, "cases");
export const OUT_DIR = join(HERE, "out");
const REPLY_TRUNCATE = 2000;
const INTER_CALL_DELAY_MS = 100;

export interface RunEvalsOptions {
  dryRun?: boolean;
  /** Restrict to these case ids. */
  cases?: string[];
  /** Run at most N cases (after filtering). */
  max?: number;
  /** One repair round on validation failure. Default true. */
  repair?: boolean;
  /** Model id override (else EVAL_MODEL env, else the default). */
  model?: string;
  /** Inject a responder (tests). Overrides dryRun-based selection. */
  responder?: Responder;
  /** Write out/scoreboard.json + out/report.md. Default true. */
  writeOutputs?: boolean;
  /** Suppress per-case console logging. Default false. */
  quiet?: boolean;
}

export function loadCases(casesDir: string = CASES_DIR): EvalCase[] {
  const files = readdirSync(casesDir)
    .filter((name) => name.endsWith(".json"))
    .toSorted();
  return files.map((name) => {
    const parsed = JSON.parse(readFileSync(join(casesDir, name), "utf8")) as EvalCase;
    return parsed;
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Run one case through prompt → reply → (repair) → score. */
export async function runCase(
  evalCase: EvalCase,
  responder: Responder,
  repairEnabled: boolean,
): Promise<CaseScore> {
  const system = buildSystemPrompt();
  const user = buildUserPrompt(evalCase.prompt, evalCase.dataProfile);
  const firstReply = await responder.complete(system, user);
  const first = parseReply(firstReply);

  let refused = first.kind === "refusal";
  let validity = false;
  let validityAfterRepair = false;
  let repaired = false;
  let finalSpec = null as CaseScore["candidate"];
  let errors: SpecError[] = [];
  let finalReply = firstReply;

  if (first.kind === "spec") {
    const g1 = gate(first.spec, evalCase.dataProfile);
    validity = g1.ok;
    validityAfterRepair = g1.ok;
    finalSpec = g1.spec;
    errors = g1.errors;
    if (!g1.ok && repairEnabled) {
      repaired = true;
      const repairReply = await responder.complete(
        system,
        buildRepairPrompt(user, firstReply, g1.errors),
      );
      finalReply = repairReply;
      const second = parseReply(repairReply);
      if (second.kind === "spec") {
        const g2 = gate(second.spec, evalCase.dataProfile);
        validityAfterRepair = g2.ok;
        finalSpec = g2.spec;
        errors = g2.errors;
      } else if (second.kind === "refusal") {
        refused = true;
        errors = [];
      } else {
        errors = [{ code: "invalid-spec-root", path: "", message: second.error }];
      }
    }
  } else if (first.kind === "unparseable") {
    errors = [{ code: "invalid-spec-root", path: "", message: first.error }];
  }

  const score: CaseScore = {
    id: evalCase.id,
    kind: evalCase.kind,
    expectRefusal: evalCase.expectRefusal,
    refused,
    validity,
    validityAfterRepair,
    repaired,
    structural: null,
    renderOk: null,
    pass: false,
    errors,
    candidate: finalSpec,
    reply: finalReply.slice(0, REPLY_TRUNCATE),
  };

  if (evalCase.expectRefusal) {
    score.pass = refused;
    return score;
  }
  if (refused) {
    // Tolerated only for missing-field cases: asking beats guessing there.
    score.pass = evalCase.kind === "adversarial-missing-field";
    return score;
  }
  if (finalSpec !== null && evalCase.gold !== null) {
    score.structural = structuralScore(evalCase.gold, finalSpec);
  }
  if (finalSpec !== null) {
    const render = renderCheck(finalSpec, evalCase);
    score.renderOk = render.ok;
    if (render.error !== undefined) score.renderError = render.error;
  }
  score.pass =
    validityAfterRepair &&
    score.structural !== null &&
    score.structural.total >= PASS_STRUCTURAL &&
    score.renderOk === true;
  return score;
}

function computeTotals(cases: CaseScore[]): ScoreboardTotals {
  const rate = (num: number, den: number): number =>
    den === 0 ? 1 : Math.round((num / den) * 1000) / 1000;
  const specExpected = cases.filter((c) => !c.expectRefusal);
  const structural = cases.filter((c) => c.structural !== null);
  const rendered = cases.filter((c) => c.renderOk !== null);
  const refusals = cases.filter((c) => c.expectRefusal);
  return {
    passRate: rate(cases.filter((c) => c.pass).length, cases.length),
    meanStructural: rate(
      structural.reduce((sum, c) => sum + (c.structural?.total ?? 0), 0),
      structural.length,
    ),
    validityRate: rate(specExpected.filter((c) => c.validity).length, specExpected.length),
    validityAfterRepairRate: rate(
      specExpected.filter((c) => c.validityAfterRepair).length,
      specExpected.length,
    ),
    renderRate: rate(rendered.filter((c) => c.renderOk === true).length, rendered.length),
    refusalAccuracy: rate(refusals.filter((c) => c.refused).length, refusals.length),
  };
}

function renderReport(board: Scoreboard, casesById: Map<string, EvalCase>): string {
  const lines: string[] = [
    "# NL→spec eval report",
    "",
    `- model: ${board.meta.model} (dryRun: ${board.meta.dryRun})`,
    `- timestamp: ${board.meta.timestamp}`,
    `- cases: ${board.meta.caseCount}`,
    "",
    "## Totals",
    "",
    "| passRate | meanStructural | validity | validityAfterRepair | render | refusalAccuracy |",
    "| --- | --- | --- | --- | --- | --- |",
    `| ${board.totals.passRate} | ${board.totals.meanStructural} | ${board.totals.validityRate} | ${board.totals.validityAfterRepairRate} | ${board.totals.renderRate} | ${board.totals.refusalAccuracy} |`,
    "",
    "## Cases",
    "",
    "| id | kind | pass | structural | valid pre→post | render | refused |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const c of board.cases) {
    lines.push(
      `| ${c.id} | ${c.kind} | ${c.pass ? "PASS" : "FAIL"} | ${
        c.structural?.total ?? "—"
      } | ${c.validity ? "ok" : "no"}→${c.validityAfterRepair ? "ok" : "no"} | ${
        c.renderOk === null ? "—" : c.renderOk ? "ok" : "no"
      } | ${c.refused ? "yes" : "no"} |`,
    );
  }
  const failures = board.cases.filter((c) => !c.pass);
  if (failures.length > 0) {
    lines.push("", "## Failures", "");
    for (const c of failures) {
      const evalCase = casesById.get(c.id);
      lines.push(`### ${c.id} (${c.kind})`, "");
      if (evalCase !== undefined) lines.push(`- notes: ${evalCase.notes}`);
      if (c.structural !== null) {
        lines.push(
          `- structural: total ${c.structural.total} (geoms ${c.structural.geoms}, bindings ${c.structural.bindings}, extras ${c.structural.extras})`,
        );
      }
      if (c.errors.length > 0) {
        lines.push(`- errors: ${c.errors.map((e) => `[${e.code}] ${e.message}`).join(" | ")}`);
      }
      if (c.renderOk === false) lines.push(`- render: ${c.renderError ?? "failed"}`);
      if (evalCase !== undefined && evalCase.gold !== null) {
        lines.push("", "gold:", "```json", JSON.stringify(evalCase.gold), "```");
      }
      if (c.candidate === null) {
        lines.push("", "reply:", "```", c.reply.slice(0, 600), "```");
      } else {
        lines.push("", "candidate:", "```json", JSON.stringify(c.candidate), "```");
      }
      lines.push("");
    }
  }
  return lines.join("\n") + "\n";
}

function resolveResponder(options: RunEvalsOptions): Responder {
  const dryRun = options.dryRun ?? false;
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (options.responder !== undefined) {
    return options.responder;
  }
  if (!dryRun && apiKey !== undefined && apiKey !== "") {
    return new OpenRouterResponder(apiKey, options.model);
  }
  if (!dryRun && !(options.quiet ?? false)) {
    console.log("NOTICE: OPENROUTER_API_KEY is not set — falling back to the MockResponder.");
  }
  return new MockResponder();
}

function selectCases(options: RunEvalsOptions): EvalCase[] {
  let cases = loadCases();
  if (options.cases !== undefined && options.cases.length > 0) {
    const wanted = new Set(options.cases);
    cases = cases.filter((c) => wanted.has(c.id));
  }
  if (options.max !== undefined) cases = cases.slice(0, options.max);
  return cases;
}

async function scoreCases(
  cases: EvalCase[],
  responder: Responder,
  options: RunEvalsOptions,
): Promise<CaseScore[]> {
  const live = responder instanceof OpenRouterResponder;
  const repairEnabled = options.repair ?? true;
  const scores: CaseScore[] = [];
  for (const evalCase of cases) {
    if (scores.length > 0 && live) await sleep(INTER_CALL_DELAY_MS);
    const score = await runCase(evalCase, responder, repairEnabled);
    scores.push(score);
    if (!(options.quiet ?? false)) {
      const structural = score.structural === null ? "—" : String(score.structural.total);
      console.log(
        `${score.pass ? "PASS" : "FAIL"}  ${evalCase.id}  structural=${structural} valid=${score.validity}${
          score.repaired ? `→${score.validityAfterRepair}` : ""
        } render=${score.renderOk ?? "—"}${score.refused ? " refused" : ""}`,
      );
    }
  }
  return scores;
}

function buildScoreboard(responder: Responder, scores: CaseScore[]): Scoreboard {
  return {
    meta: {
      timestamp: new Date().toISOString(),
      model: responder.name,
      dryRun: !(responder instanceof OpenRouterResponder),
      caseCount: scores.length,
    },
    totals: computeTotals(scores),
    cases: scores,
  };
}

function writeOutputs(board: Scoreboard, cases: EvalCase[]): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "scoreboard.json"), JSON.stringify(board, null, 2) + "\n");
  const casesById = new Map(cases.map((c) => [c.id, c]));
  writeFileSync(join(OUT_DIR, "report.md"), renderReport(board, casesById));
}

export async function runEvals(options: RunEvalsOptions = {}): Promise<Scoreboard> {
  const responder = resolveResponder(options);
  const cases = selectCases(options);
  const scores = await scoreCases(cases, responder, options);
  const board = buildScoreboard(responder, scores);
  if (options.writeOutputs ?? true) {
    writeOutputs(board, cases);
  }
  if (!(options.quiet ?? false)) {
    console.log(JSON.stringify(board.totals));
  }
  return board;
}

function parseArgs(argv: string[]): RunEvalsOptions {
  const options: RunEvalsOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--repair":
        options.repair = true;
        break;
      case "--no-repair":
        options.repair = false;
        break;
      case "--cases":
        options.cases = (argv[++i] ?? "").split(",").filter((s) => s !== "");
        break;
      case "--max":
        options.max = Number(argv[++i]);
        break;
      case "--model": {
        const model = argv[++i];
        if (model === undefined || model === "") throw new Error("--model needs a model id");
        options.model = model;
        break;
      }
      case "--quiet":
        options.quiet = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

if (import.meta.main) {
  const options = parseArgs(process.argv.slice(2));
  const board = await runEvals(options);
  const failed = board.cases.filter((c) => !c.pass).length;
  console.log(
    `Done: ${board.cases.length - failed}/${board.cases.length} passed. Outputs in tests/evals/out/.`,
  );
  if (failed > 0) process.exitCode = 1;
}
