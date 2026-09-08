/** Shared temporal preflight helpers (docs + config assert). */
import { temporalParserConfigurationError } from "@ggts-sh/spec";

import { getTemporalRuntime } from "../temporal-runtime.js";

import type { PositionConversionContext } from "./temporal-position.js";
import { PipelineError } from "./types.js";

export function temporalPreflightDocs(code: string): string {
  return `https://ggts.sh/guide/errors#${code}`;
}

export function assertTemporalConfiguration(
  axis: "x" | "y",
  conversion: PositionConversionContext,
): void {
  if (conversion.forcedDiscrete) return;
  // Explicit parsers need the Temporal polyfill; auto + lean ISO does not.
  // Timezone (and other config) validation still runs for auto — otherwise a
  // mistyped zone surfaces only as a confusing per-cell parse failure later.
  if (conversion.parser !== "auto" && getTemporalRuntime() === null) {
    throw new PipelineError(
      "temporal-parse-failed",
      `/scales/${axis}`,
      `The ${axis} scale uses an explicit temporal parser and requires @ggts-sh/core (full) or @ggts-sh/core/temporal.`,
      {
        code: "temporal-parse-failed",
        severity: "error",
        path: `/scales/${axis}`,
        problem: "Temporal parser configuration requires the temporal runtime.",
        cause: "Lean render entry does not load the Temporal polyfill.",
        fixes: [
          { description: "Import @ggts-sh/core or @ggts-sh/core/temporal before rendering." },
        ],
        documentationUrl: temporalPreflightDocs("temporal-parse-failed"),
      },
    );
  }
  const configurationError = temporalParserConfigurationError(
    conversion.parser,
    conversion.options,
  );
  if (configurationError === null) return;
  const message = `The ${axis} scale has invalid temporal parser configuration: ${configurationError}.`;
  throw new PipelineError("temporal-parse-failed", `/scales/${axis}`, message, {
    code: "temporal-parse-failed",
    severity: "error",
    path: `/scales/${axis}`,
    problem: "Temporal parser configuration is invalid.",
    cause: message,
    fixes: [{ description: "Correct the parser format or timezone configuration." }],
    documentationUrl: temporalPreflightDocs("temporal-parse-failed"),
  });
}
