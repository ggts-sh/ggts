/**
 * Catalog-driven errors and advisories guide markdown for gen-llms.
 * Lifecycle guide markdown lives in llms-lifecycle-docs.ts.
 */
import { ADVISORY_CATALOG } from "@ggts-sh/core";
import { LINT_CATALOG } from "@ggts-sh/spec";
import {
  buildDiagnosticDocs,
  type DiagnosticDocEntry,
  type DiagnosticDocSource,
} from "./diagnostic-docs";

function catalogSection(
  title: string,
  intro: string,
  catalog: Record<string, { summary: string; fix?: string }>,
  opts: { tierOf?: (code: string) => string } = {},
): string {
  const lines = [`## ${title}`, "", intro, ""];
  for (const [code, entry] of Object.entries(catalog)) {
    const tier = opts.tierOf === undefined ? "" : ` (${opts.tierOf(code)})`;
    lines.push(`### \`${code}\`${tier}`, "", entry.summary, "");
    if (entry.fix !== undefined) lines.push(`**Fix:** ${entry.fix}`, "");
  }
  return lines.join("\n");
}

const diagnosticSectionTitles: Record<DiagnosticDocSource, string> = {
  validation: "Validation errors (@ggts-sh/spec)",
  pipeline: "Render-time errors (@ggts-sh/core)",
  warning: "Render warnings",
  interaction: "Interaction diagnostics (@ggts-sh/svelte)",
  cli: "CLI diagnostics (ggts)",
};

function diagnosticHeading(entry: DiagnosticDocEntry): string {
  const primaryAnchor = entry.code
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
  return entry.anchor === primaryAnchor
    ? `### \`${entry.code}\``
    : `### \`${entry.code}\` — ${entry.source}`;
}

function renderDiagnosticEntry(entry: DiagnosticDocEntry): string {
  const lines = [
    diagnosticHeading(entry),
    "",
    `**Code + severity:** \`${entry.code}\` · ${entry.severity}`,
    "",
    `**What failed:** ${entry.whatFailed}`,
    "",
    `**Why:** ${entry.why}`,
    "",
    `**Fix:** ${entry.fix}`,
    "",
    `**Consequence (${entry.consequence}):** ${entry.consequenceText}`,
    "",
    `**Stable link:** [/guide/errors#${entry.anchor}](/guide/errors#${entry.anchor})`,
    "",
  ];
  if (entry.recipe !== undefined) {
    lines.push(
      "**Minimal illustration — copy only the relevant fragment:**",
      "",
      `\`\`\`${entry.recipe.language} fragment copy`,
      entry.recipe.code,
      "```",
      "",
    );
  }
  return lines.join("\n");
}

export function buildErrorsMd(): string {
  const entries = buildDiagnosticDocs();
  const sections = (Object.keys(diagnosticSectionTitles) as DiagnosticDocSource[]).map((source) => {
    const intro =
      source === "cli"
        ? "SVG is written only to stdout; JSON Lines diagnostics are written only to stderr. Exit 1 means rendering failed, exit 2 means usage/input failed, and exit 3 means spec validation failed."
        : "Each entry answers what failed, why, how to recover safely, and whether output was blocked or degraded.";
    return [
      `## ${diagnosticSectionTitles[source]}`,
      "",
      intro,
      "",
      ...entries
        .filter((entry) => entry.source === source)
        .map((entry) => renderDiagnosticEntry(entry)),
    ].join("\n");
  });

  return `# Errors reference

Diagnostics are generated from the catalogs used by validation, rendering,
interaction, and the CLI. Identity is the pair \`(source, code)\`: a bare code
can intentionally exist in more than one source with a different consequence.

## Quickstart troubleshooting

- **Collapsed or zero-width container:** the responsive plot remains
  \`data-gg-ready="false"\` until ResizeObserver reports a positive width.
  Give the parent a real grid/flex track width; no fixed chart width is needed.
- **SSR and hydration:** omitted width server-renders at 832 × 400, stays
  not-ready on the server, then measures its real container after hydration.
- **Unexpected height:** omitted height is 400px unless the spec supplies one.
- **TypeScript or linked-package mismatch:** install one compatible
  \`@ggts-sh/svelte\` version and let it resolve matching core/spec packages;
  remove stale lockfile overrides that mix versions.
- **CLI input failure:** run \`ggts --help\`; keep SVG stdout
  separate from JSON Lines stderr while correcting the reported input.

${sections.join("\n\n")}
`;
}

export function buildAdvisoriesMd(): string {
  const lint = catalogSection(
    "Spec-lint advisories (@ggts-sh/spec lintSpec)",
    'Valid-but-questionable specs (Hadley: "we can produce many plots that don\'t make sense, yet are grammatically valid"). Run `lintSpec(spec, { profile? })` directly, pass `{ lint: true }` to `validate()`, or read the CLI\'s stderr advisories (source "spec-lint"). Data-dependent rules skip silently without evidence.',
    LINT_CATALOG,
    {
      tierOf: (code) => `needs: ${LINT_CATALOG[code as keyof typeof LINT_CATALOG].needs}`,
    },
  );
  const heuristics = catalogSection(
    "Pipeline heuristic advisories (@ggts-sh/core)",
    "Every heuristic decision the pipeline takes is disclosed as `{ code, path, chosen, howToOverride }` on `RenderModel.advisories` — agents see the guess and can correct it.",
    ADVISORY_CATALOG,
  );
  return `# Advisories

Advisories never block a render. Two distinct kinds, two sources:

${lint}

${heuristics}
`;
}
