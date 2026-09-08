import type { PositionScaleSpec } from "@ggts-sh/spec";

import type { DiagnosticCode } from "../diagnostics.js";

export interface ScaleDiagnosticFix {
  description: string;
  portable?: unknown;
  typescript?: string;
}

export interface ScaleDiagnostic {
  /** Catalogued code (any channel; dual-channel codes are legal). */
  code: DiagnosticCode;
  severity: "advisory" | "warning" | "error";
  path: string;
  problem: string;
  cause: string;
  fixes: readonly ScaleDiagnosticFix[];
  evidence?: Readonly<{
    values?: readonly (string | number | boolean | null)[];
    failedCount?: number;
    candidates?: readonly string[];
  }>;
  documentationUrl: string;
}

export interface ScaleDecision {
  aesthetic: "x" | "y";
  field: string;
  status: "temporal" | "nominal";
  parser: string | null;
  kind: "date" | "datetime" | "time" | null;
  precision: "year" | "quarter" | "month" | "date" | "minute" | "second" | "millisecond" | null;
  evidence: readonly (string | number | boolean | null)[];
  validatedCount: number;
  ambiguity: readonly string[];
  domain?: readonly (string | number | boolean | null)[];
  guidePlanIds?: readonly string[];
  portableOverride: Readonly<PositionScaleSpec>;
}
