/**
 * Optional temporal runtime hooks.
 *
 * The lean `@ggts-sh/core/render` entry leaves these unset so chart bundles
 * that only need numeric axes never load `@js-temporal/polyfill` or the full
 * temporal guide planner. The full package entry (and `@ggts-sh/core/temporal`)
 * call {@link installTemporalRuntime}.
 */
import type { TemporalParserSpec } from "@ggts-sh/spec";

import type { AxisGuidePlan } from "./layout/temporal-guide.js";
import type { TemporalAxisPlanInput } from "./layout/temporal-axis-types.js";
import type { CellValue, ParsedColumnOptions, ParsedColumnView } from "./table-types.js";

export interface TemporalRuntime {
  readonly parseColumn: (
    raw: readonly CellValue[],
    parser: TemporalParserSpec | "auto",
    options: ParsedColumnOptions,
  ) => {
    readonly decision: ParsedColumnView["decision"];
    readonly semantic: Float64Array;
    readonly valid: Uint8Array;
    readonly kind: ParsedColumnView["temporalKind"];
    readonly precision: ParsedColumnView["temporalPrecision"];
  };
  readonly planAxis: (input: TemporalAxisPlanInput) => AxisGuidePlan;
  readonly parserKey: (parser: TemporalParserSpec) => string;
  readonly compileLabelFormat: (
    pattern: string,
    options: { kind: string; locale?: string; timezone?: string },
  ) => (value: number) => string;
}

let runtime: TemporalRuntime | null = null;
/** Bumps when the runtime is installed so parse caches can invalidate. */
let runtimeGeneration = 0;

/** Install full temporal semantics (polyfill + guide planner). Idempotent. */
export function installTemporalRuntime(next: TemporalRuntime): void {
  if (runtime === null) runtimeGeneration += 1;
  runtime = next;
}

export function getTemporalRuntime(): TemporalRuntime | null {
  return runtime;
}

/**
 * Test-only: clear the optional runtime so the lean parse path is exercised.
 * Callers must re-install via {@link installTemporalRuntime} (or the package
 * install side effect) before other suites that need full temporal semantics.
 */
export function resetTemporalRuntimeForTests(): void {
  if (runtime === null) return;
  runtime = null;
  runtimeGeneration += 1;
}

/** Cache-key fragment: changes when temporal install status changes. */
export function temporalRuntimeGeneration(): number {
  return runtimeGeneration;
}
