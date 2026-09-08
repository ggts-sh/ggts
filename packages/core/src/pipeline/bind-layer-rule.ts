/**
 * Rule-layer form resolution (annotation vs data-driven vertical/horizontal).
 */
import type { Aes, LayerSpec } from "@ggts-sh/spec";

import type { RuleForm } from "./types.js";
import { PipelineError } from "./types.js";

export function resolveRuleForm(layer: LayerSpec, index: number): RuleForm | null {
  if (layer.geom !== "rule") return null;
  const aes: Aes = layer.aes ?? {};
  const params = layer.params ?? {};
  const p = params as { xintercept?: unknown; yintercept?: unknown };
  const hasIntercepts = p.xintercept !== undefined || p.yintercept !== undefined;
  const xMapped = aes.x !== undefined && aes.x !== null;
  const yMapped = aes.y !== undefined && aes.y !== null;
  if (hasIntercepts && (xMapped || yMapped)) {
    throw new PipelineError(
      "rule-form-ambiguous",
      `/layers/${index}`,
      "This rule layer mixes the annotation form (params.xintercept/yintercept) with mapped aes.x/aes.y. Use fixed intercepts OR a data mapping, never both.",
    );
  }
  if (!hasIntercepts && !xMapped && !yMapped) {
    throw new PipelineError(
      "rule-form-missing",
      `/layers/${index}`,
      "This rule layer has neither fixed intercepts (params.xintercept/yintercept) nor a mapped aes.x/aes.y — nothing to draw.",
    );
  }
  if (!hasIntercepts && xMapped && yMapped) {
    throw new PipelineError(
      "rule-both-axes",
      `/layers/${index}`,
      "This rule layer maps BOTH aes.x and aes.y; a data-driven rule is either vertical (map x) or horizontal (map y). Unset the other channel with null.",
    );
  }
  return hasIntercepts ? "annotation" : xMapped ? "vertical" : "horizontal";
}
