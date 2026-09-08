/**
 * `ggsvelte-render` CLI implementation (the bin lives on the `@ggsvelte/cli`
 * package — packages/cli/bin/ggsvelte-render.js is a thin wrapper around
 * this pure-entry module, so the logic is testable without spawning).
 *
 * Contract:
 *   ggsvelte-render [spec.json] [--width N] [--height N] [--data file.json]
 *                   [--max-marks N] [--inspect MODE]
 *
 *   - The spec is read from the file argument, or from stdin when omitted.
 *   - --data file.json provides NAMED datasets: the file is an object mapping
 *     dataset names to inline data ({values}/{columns}/rows/columns).
 *   - --inspect MODE declares host inspect intent (auto|exact|x|y|xy). Inspect
 *     mode is host-only, not a PortableSpec field; the flag lets agents run the
 *     same pure inspect×geom collectors that feed ondiagnostic (#1531).
 *   - SVG goes to stdout. Nothing else ever does.
 *   - Errors and advisories go to stderr as JSON LINES:
 *       {"kind":"error","code",...} | {"kind":"warning",...} |
 *       {"kind":"advisory",...}
 *     Scale inference diagnostics reuse those same `kind` values (mapped from
 *     their internal severity) and set `source: "scale"` so hosts can filter.
 *     Interaction intent diagnostics set `source: "interaction"`.
 *
 * Exit codes (documented contract):
 *   0  rendered
 *   1  render failed (pipeline/renderer error — spec was structurally valid)
 *   2  usage error (bad flags, unreadable input, invalid JSON)
 *   3  invalid spec (validation errors — see stderr JSON lines)
 */
import type { SpecInput } from "@ggsvelte/spec";
import { lintSpec, SpecValidationError, validate } from "@ggsvelte/spec";

import type { CLIDiagnosticCode } from "./diagnostics.js";
import {
  collectInspectIntentDiagnostics,
  isInspectIntentMode,
  type InspectIntentMode,
} from "./inspect-geom-advisories.js";
import type { NamedData } from "./pipeline.js";
import { PipelineError, runPipeline } from "./pipeline.js";
import { registerAll } from "./register.js";
import { countMarks, sceneToSVGString } from "./render-svg.js";

export interface CLIIO {
  /** Read the entire stdin as text (used when no file argument is given). */
  readStdin(): Promise<string>;
  readFile(path: string): string;
  writeOut(text: string): void;
  writeErr(line: string): void;
}

/** Map a scale diagnostic's severity onto the documented CLI JSONL `kind`. */
export function scaleDiagnosticCliKind(
  severity: "advisory" | "warning" | "error",
): "advisory" | "warning" | "error" {
  return severity;
}

export const CLI_OPTIONS = [
  {
    anchor: "width",
    flag: "--width",
    value: "N",
    description: "Plot width in px (default: spec.width, then 832)",
    kind: "number",
    target: "width",
  },
  {
    anchor: "height",
    flag: "--height",
    value: "N",
    description: "Plot height in px (default: spec.height, then 400)",
    kind: "number",
    target: "height",
  },
  {
    anchor: "data",
    flag: "--data",
    value: "FILE",
    description: "JSON file with named datasets",
    detail: '{"name": rows|columns|{values}|{columns}}',
    kind: "file",
    target: "dataPath",
  },
  {
    anchor: "max-marks",
    flag: "--max-marks",
    value: "N",
    description: "Refuse to render more marks than N (default 100000)",
    kind: "number",
    target: "maxMarks",
  },
  {
    anchor: "inspect",
    flag: "--inspect",
    value: "MODE",
    description: "Host inspect intent for interaction advisories",
    detail: "auto|exact|x|y|xy — host-only; not a PortableSpec field",
    kind: "inspectMode",
    target: "inspectMode",
  },
  {
    anchor: "version",
    flag: "--version",
    value: "",
    description: "Print the installed ggsvelte CLI version",
    kind: "boolean",
    target: "version",
  },
  {
    anchor: "help",
    flag: "--help",
    aliases: ["-h"],
    value: "",
    description: "Show this help",
    kind: "boolean",
    target: "help",
  },
] as const;

const cliOptionLines = CLI_OPTIONS.map((option) => {
  const signature = `${option.flag}${option.value === "" ? "" : ` ${option.value}`}`;
  const detail =
    "detail" in option && typeof option.detail === "string" && option.detail.length > 0
      ? ` ${option.detail}`
      : "";
  return `  ${signature.padEnd(17)} ${option.description}${detail}`;
}).join("\n");

function cliUsage(command?: "render" | "check"): string {
  return `Usage: ${command === undefined ? "ggsvelte-render" : `ggts ${command}`} [spec.json] [options]

Renders a ggsvelte plot spec (JSON) to SVG on stdout. Reads the spec from
the file argument, or from stdin when omitted.

Options:
${cliOptionLines}

Diagnostics are JSON lines on stderr. Exit codes: 0 rendered, 1 render
failed, 2 usage error, 3 invalid spec.${command === "check" ? "\nCheck runs the same rendering checks and diagnostics, with no SVG output." : ""}`;
}

interface ParsedArgs {
  specPath: string | null;
  width: number | null;
  height: number | null;
  dataPath: string | null;
  maxMarks: number | null;
  inspectMode: InspectIntentMode | null;
  help: boolean;
  version: boolean;
}

class UsageError extends Error {}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const out: ParsedArgs = {
    specPath: null,
    width: null,
    height: null,
    dataPath: null,
    maxMarks: null,
    inspectMode: null,
    help: false,
    version: false,
  };
  const optionByFlag = new Map<string, (typeof CLI_OPTIONS)[number]>();
  for (const option of CLI_OPTIONS) {
    optionByFlag.set(option.flag, option);
    if ("aliases" in option) {
      for (const alias of option.aliases) optionByFlag.set(alias, option);
    }
  }
  const numberFlag = (flag: string, raw: string | undefined): number => {
    const n = Number(raw);
    if (raw === undefined || !Number.isFinite(n) || n <= 0) {
      throw new UsageError(`${flag} needs a positive number (got ${raw ?? "nothing"})`);
    }
    return n;
  };
  const inspectFlag = (raw: string | undefined): InspectIntentMode => {
    if (raw === undefined) {
      throw new UsageError("--inspect needs a mode (auto|exact|x|y|xy)");
    }
    if (!isInspectIntentMode(raw)) {
      throw new UsageError(`--inspect mode must be auto|exact|x|y|xy (got ${JSON.stringify(raw)})`);
    }
    return raw;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const option = optionByFlag.get(arg);
    if (option !== undefined) {
      if (option.kind === "boolean") {
        out[option.target] = true;
      } else if (option.kind === "number") {
        out[option.target] = numberFlag(option.flag, argv[++i]);
      } else if (option.kind === "inspectMode") {
        out[option.target] = inspectFlag(argv[++i]);
      } else {
        const path = argv[++i];
        if (path === undefined) throw new UsageError(`${option.flag} needs a file path`);
        out[option.target] = path;
      }
      continue;
    }
    if (arg.startsWith("-")) throw new UsageError(`Unknown option "${arg}"`);
    if (out.specPath !== null) {
      throw new UsageError(`Unexpected extra argument "${arg}" (one spec file only)`);
    }
    out.specPath = arg;
  }
  return out;
}

function errLine(io: CLIIO, payload: object): void {
  io.writeErr(JSON.stringify(payload));
}

/** CLI-catalogued error line — code is checked against CLI_DIAGNOSTIC_CATALOG. */
function cliError(io: CLIIO, code: CLIDiagnosticCode, message: string): void {
  errLine(io, { kind: "error", code, message });
}

function parseJSON(io: CLIIO, text: string, what: string): { value: unknown } | null {
  try {
    return { value: JSON.parse(text) as unknown };
  } catch (error) {
    cliError(
      io,
      "invalid-json",
      `${what} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

export interface CLIRunOptions {
  /** Version of the package that owns the installed ggsvelte-render bin. */
  version?: string;
  /** Installed CLI subcommand; check validates the full render and suppresses SVG. */
  command?: "render" | "check";
}

function handleSpecialArgs(args: ParsedArgs, io: CLIIO, options: CLIRunOptions): number | null {
  if (args.version) {
    const hasOtherArguments =
      args.help ||
      args.specPath !== null ||
      args.width !== null ||
      args.height !== null ||
      args.dataPath !== null ||
      args.maxMarks !== null ||
      args.inspectMode !== null;
    if (hasOtherArguments || options.version === undefined) {
      cliError(
        io,
        "usage",
        hasOtherArguments
          ? "--version must be used without a spec or other options"
          : "--version is unavailable from this programmatic runner",
      );
      io.writeErr(cliUsage(options.command));
      return 2;
    }
    io.writeOut(`${options.version}\n`);
    return 0;
  }
  if (args.help) {
    io.writeErr(cliUsage(options.command));
    return 0;
  }
  return null;
}

async function readSpecText(args: ParsedArgs, io: CLIIO): Promise<string | null> {
  try {
    return args.specPath === null ? await io.readStdin() : io.readFile(args.specPath);
  } catch (error) {
    cliError(
      io,
      "unreadable-input",
      `Cannot read ${args.specPath ?? "stdin"}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

function readNamedData(args: ParsedArgs, io: CLIIO): Record<string, NamedData> | undefined | null {
  if (args.dataPath === null) return undefined;
  let dataText: string;
  try {
    dataText = io.readFile(args.dataPath);
  } catch (error) {
    cliError(
      io,
      "unreadable-input",
      `Cannot read ${args.dataPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
  const parsedData = parseJSON(io, dataText, args.dataPath);
  if (parsedData === null) return null;
  const parsed = parsedData.value;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    cliError(
      io,
      "invalid-data-file",
      "--data must be a JSON object mapping dataset names to inline data.",
    );
    return null;
  }
  return parsed as Record<string, NamedData>;
}

function renderCLI(
  spec: unknown,
  args: ParsedArgs,
  data: Record<string, NamedData> | undefined,
  width: number,
  height: number,
  io: CLIIO,
): number {
  try {
    const schema = validate(spec);
    if (!schema.ok) throw new SpecValidationError(schema.errors);
    const model = runPipeline(spec as SpecInput, {
      width,
      height,
      ...(data !== undefined && { data }),
    });
    for (const warning of model.warnings) errLine(io, { kind: "warning", ...warning });
    for (const advisory of model.advisories) errLine(io, { kind: "advisory", ...advisory });
    for (const diagnostic of model.scaleDiagnostics)
      errLine(io, {
        kind: scaleDiagnosticCliKind(diagnostic.severity),
        source: "scale",
        ...diagnostic,
      });
    for (const advisory of lintSpec(spec))
      errLine(io, { kind: "advisory", source: "spec-lint", ...advisory });
    if (args.inspectMode !== null) {
      const layers =
        typeof spec === "object" && spec !== null
          ? (spec as { layers?: unknown }).layers
          : undefined;
      for (const diagnostic of collectInspectIntentDiagnostics(layers, args.inspectMode))
        errLine(io, {
          kind: diagnostic.severity,
          source: "interaction",
          code: diagnostic.code,
          message: diagnostic.message,
          prop: diagnostic.prop,
          suggestions: diagnostic.suggestions,
          docUrl: diagnostic.docUrl,
          ...(diagnostic.actual !== undefined && { actual: diagnostic.actual }),
        });
    }
    const limit = args.maxMarks ?? 100_000;
    const marks = countMarks(model.scene);
    if (marks > limit) {
      cliError(
        io,
        "max-marks-exceeded",
        `The plot renders ${marks} marks, more than --max-marks (${limit}).`,
      );
      return 1;
    }
    io.writeOut(sceneToSVGString(model.scene) + "\n");
    return 0;
  } catch (error) {
    if (error instanceof SpecValidationError) {
      for (const e of error.errors) errLine(io, { kind: "error", ...e });
      return 3;
    }
    if (error instanceof PipelineError) {
      errLine(io, {
        kind: "error",
        code: error.code,
        path: error.path,
        message: error.message,
        ...(error.diagnostic !== undefined && { diagnostic: error.diagnostic }),
      });
      return 1;
    }
    cliError(io, "internal", error instanceof Error ? error.message : String(error));
    return 1;
  }
}

/** Run the CLI. Returns the process exit code (documented in module docs). */
export async function runCLI(
  argv: readonly string[],
  io: CLIIO,
  options: CLIRunOptions = {},
): Promise<number> {
  // The CLI always runs the full grammar (#1420): headless spec rendering has
  // no component layer to self-register specialty geoms/stats.
  registerAll();
  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
  } catch (error) {
    cliError(io, "usage", (error as Error).message);
    io.writeErr(cliUsage(options.command));
    return 2;
  }
  const special = handleSpecialArgs(args, io, options);
  if (special !== null) return special;
  const specText = await readSpecText(args, io);
  if (specText === null) return 2;
  const parsedSpec = parseJSON(io, specText, args.specPath ?? "stdin");
  if (parsedSpec === null) return 2;
  const spec = parsedSpec.value;

  const data = readNamedData(args, io);
  if (data === null) return 2;

  const specRecord =
    typeof spec === "object" && spec !== null ? (spec as Record<string, unknown>) : {};
  const width = args.width ?? (typeof specRecord["width"] === "number" ? specRecord["width"] : 832);
  const height =
    args.height ?? (typeof specRecord["height"] === "number" ? specRecord["height"] : 400);

  return renderCLI(
    spec,
    args,
    data,
    width,
    height,
    options.command === "check" ? { ...io, writeOut: () => {} } : io,
  );
}
