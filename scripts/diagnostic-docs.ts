import { CLI_DIAGNOSTIC_CATALOG, PIPELINE_WARNING_CATALOG } from "@ggsvelte/core";
import { ERROR_CATALOG, PIPELINE_ERROR_CATALOG } from "@ggsvelte/spec";
import { INTERACTION_DIAGNOSTIC_CATALOG } from "../packages/svelte/src/lib/interaction/interaction.js";

export type DiagnosticDocSource = "validation" | "pipeline" | "warning" | "interaction" | "cli";

export interface DiagnosticDocEntry {
  source: DiagnosticDocSource;
  code: string;
  anchor: string;
  severity: "error" | "warning" | "advisory";
  whatFailed: string;
  why: string;
  fix: string;
  consequence: "blocked" | "degraded" | "advisory";
  consequenceText: string;
  recipe?: { language: "json" | "svelte" | "sh"; code: string };
}

const sourceOrder: readonly DiagnosticDocSource[] = [
  "validation",
  "pipeline",
  "warning",
  "interaction",
  "cli",
];

function slug(code: string): string {
  return code
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

function cliFix(code: string): string {
  switch (code) {
    case "usage":
      return "Run ggts render --help, then remove unsupported or conflicting arguments.";
    case "unreadable-input":
      return "Check the file path and permissions, or pipe readable JSON on stdin.";
    case "invalid-json":
      return "Correct the JSON syntax before running the command again.";
    case "invalid-data-file":
      return "Make --data point to a JSON object whose keys are dataset names.";
    case "max-marks-exceeded":
      return "Reduce the data or deliberately raise --max-marks after checking output cost.";
    default:
      return "Capture stderr and report the reproducible command, versions, and input shape.";
  }
}

const recipes = new Map<string, DiagnosticDocEntry["recipe"]>([
  [
    "validation:unknown-field",
    {
      language: "json",
      code: `{
  "aes": {
    "x": { "field": "weight" },
    "y": { "field": "economy" }
  }
}`,
    },
  ],
  [
    "interaction:INTERACTION_TOOL_UNAVAILABLE",
    {
      language: "svelte",
      code: `<GGPlot
  data={rows}
  aes={{ x: "weight", y: "economy" }}
  tool="inspect"
>
  <Inspect />
</GGPlot>`,
    },
  ],
  [
    "interaction:INTERACTION_INSPECT_X_ON_COL",
    {
      language: "svelte",
      code: `<GGPlot data={rows} aes={{ x: "group", y: "amount" }}>
  <GeomCol />
  <Inspect mode="exact" />
</GGPlot>`,
    },
  ],
  [
    "interaction:INTERACTION_INSPECT_AXIS_ON_VIOLIN",
    {
      language: "svelte",
      code: `<GGPlot data={rows} aes={{ x: "run", y: "value" }}>
  <GeomViolin />
  <Inspect mode="exact" />
</GGPlot>`,
    },
  ],
  [
    "interaction:INTERACTION_INSPECT_X_BISECTS_COL_LABELS",
    {
      language: "svelte",
      code: `<GGPlot data={rows} aes={{ x: "group", y: "amount" }}>
  <GeomCol />
  <GeomText aes={{ label: "label" }} dy={-8} />
  <Inspect mode="exact" />
</GGPlot>`,
    },
  ],
  [
    "interaction:INTERACTION_DUPLICATE_INSPECT_CAPABILITY",
    {
      language: "svelte",
      code: `<GGPlot data={rows} aes={{ x: "x", y: "y" }}>
  <GeomPoint />
  <Inspect mode="xy" />
</GGPlot>`,
    },
  ],
  [
    "cli:invalid-json",
    {
      language: "sh",
      code: `printf '%s\\n' '{"data":{"values":[{"x":1,"y":2}]},"layers":[{"geom":"point","aes":{"x":{"field":"x"},"y":{"field":"y"}}}]}' \\
  | ggts render > chart.svg`,
    },
  ],
]);

export function buildDiagnosticDocs(): DiagnosticDocEntry[] {
  const entries: Omit<DiagnosticDocEntry, "anchor">[] = [];

  for (const [code, entry] of Object.entries(ERROR_CATALOG)) {
    entries.push({
      source: "validation",
      code,
      severity: "error",
      whatFailed: `Spec validation rejected the value at its reported path (${entry.tier === 1 ? "schema shape" : "grammar or data-aware check"}).`,
      why: entry.summary,
      fix: entry.fix,
      consequence: "blocked",
      consequenceText: "Validation failed; no chart should be rendered from this spec.",
      ...(recipes.has(`validation:${code}`) && { recipe: recipes.get(`validation:${code}`)! }),
    });
  }
  for (const [code, entry] of Object.entries(PIPELINE_ERROR_CATALOG)) {
    entries.push({
      source: "pipeline",
      code,
      severity: "error",
      whatFailed: "The render pipeline stopped at the path reported by PipelineError.",
      why: entry.summary,
      fix: entry.fix,
      consequence: "blocked",
      consequenceText: "Rendering stopped; ggsvelte does not substitute blank or partial output.",
    });
  }
  for (const [code, entry] of Object.entries(PIPELINE_WARNING_CATALOG)) {
    entries.push({
      source: "warning",
      code,
      severity: "warning",
      whatFailed:
        "A render step could not use every requested row, value, or default exactly as supplied.",
      why: entry.summary,
      fix: "Inspect the warning message for its path and count, then correct the named data, scale, or option.",
      consequence: "degraded",
      consequenceText:
        "The chart rendered, but the warning identifies dropped, cycled, or fallback output.",
    });
  }
  for (const [code, entry] of Object.entries(INTERACTION_DIAGNOSTIC_CATALOG)) {
    const consequence = entry.severity === "advisory" ? "advisory" : "degraded";
    entries.push({
      source: "interaction",
      code,
      severity: entry.severity,
      whatFailed: `The ${entry.prop} interaction contract could not be applied as requested.`,
      why: entry.message,
      fix: entry.suggestions.join("; "),
      consequence,
      consequenceText:
        consequence === "advisory"
          ? "The chart remains available; review the ignored or inferred interaction behavior."
          : "The chart remains rendered, but the affected interaction is disabled or reduced.",
      ...(recipes.has(`interaction:${code}`) && { recipe: recipes.get(`interaction:${code}`)! }),
    });
  }
  for (const [code, entry] of Object.entries(CLI_DIAGNOSTIC_CATALOG)) {
    const exitCode = ["usage", "unreadable-input", "invalid-json", "invalid-data-file"].includes(
      code,
    )
      ? 2
      : 1;
    entries.push({
      source: "cli",
      code,
      severity: "error",
      whatFailed: `ggts stopped with exit ${String(exitCode)} and wrote this JSON Line to stderr.`,
      why: entry.summary,
      fix: cliFix(code),
      consequence: "blocked",
      consequenceText: "No successful SVG is available on stdout for this invocation.",
      ...(recipes.has(`cli:${code}`) && { recipe: recipes.get(`cli:${code}`)! }),
    });
  }

  const sourcesByCode = new Map<string, DiagnosticDocSource[]>();
  for (const entry of entries) {
    const sources = sourcesByCode.get(entry.code) ?? [];
    sources.push(entry.source);
    sourcesByCode.set(entry.code, sources);
  }

  return entries.map((entry) => {
    const sources = sourcesByCode.get(entry.code)!;
    const primary = sourceOrder.find((source) => sources.includes(source))!;
    return {
      ...entry,
      anchor:
        sources.length === 1 || entry.source === primary
          ? slug(entry.code)
          : `${slug(entry.code)}-${entry.source}`,
    };
  });
}
