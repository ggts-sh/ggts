/**
 * Sequential color range resolution (config vs edition defaults).
 *
 * Configured domain is resolved inline in trainSequentialColorScale via the
 * color value view (`semanticOf`) so parser + transform validity stay one path.
 */
import type { ColorScaleSpec } from "@ggts-sh/spec";

import type { EditionDefaults } from "../editions.js";
import { resolveSequentialPipelineRange } from "../scales/engine.js";

/**
 * Edition-keyed default ramp: identical to trainSequential built-in for
 * edition 1 (undefined — keeps behavior byte-stable); other editions pass
 * their ramp. Explicit config always wins at the call site.
 */
export function resolveSequentialRange(
  config: ColorScaleSpec | undefined,
  editionDefaults: EditionDefaults,
): readonly string[] | undefined {
  return resolveSequentialPipelineRange(config, editionDefaults.sequentialRamp);
}
