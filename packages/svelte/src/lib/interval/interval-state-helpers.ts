/**
 * Pure helpers extracted from interval-state for S5.
 *
 * No factory capture: every function takes its inputs as arguments and reads
 * no reactive state. Consumed by interval-state.svelte.ts.
 */
import { decodeKey, type SemanticViewportSelection } from "@ggts-sh/core";

import type { ReadonlyIntervalDomains, SemanticIntervalAxis } from "../interaction/interaction.js";

export function facetIdentityValueLabel(encodedValue: string): string {
  const value = decodeKey(encodedValue);
  const kind =
    value instanceof Date
      ? "date"
      : value === null
        ? "null"
        : typeof value === "string"
          ? "text"
          : typeof value;
  const display = value instanceof Date ? value.toISOString() : String(value);
  return `${kind} ${display}`;
}

function semanticViewportAxisSelection(
  semantic: SemanticIntervalAxis | undefined,
): SemanticViewportSelection["x"] {
  return semantic === undefined
    ? undefined
    : semantic.kind === "band"
      ? { kind: "band", keys: semantic.values }
      : { kind: "continuous", domain: semantic.domain };
}

export function viewportSelection(domains: ReadonlyIntervalDomains): SemanticViewportSelection {
  const x = semanticViewportAxisSelection(domains.x);
  const y = semanticViewportAxisSelection(domains.y);
  return {
    ...(x !== undefined && { x }),
    ...(y !== undefined && { y }),
  };
}
