/**
 * Pipeline run setup: normalize + validate, edition defaults, theme, coord flip.
 */
import type { NormalizedSpec, PortableSpec, SpecInput } from "@ggts-sh/spec";

import type { EditionDefaults } from "../editions.js";
import type { ThemeTokens } from "../theme.js";

import { resolvePipelineEditionDefaults } from "./setup-run-edition.js";
import { normalizeAndValidateSpec } from "./setup-run-normalize.js";
import { resolvePipelineTheme } from "./setup-run-theme.js";
import type { PipelineWarning, RunOptions } from "./types.js";

export interface PipelineRunSetup {
  normalized: NormalizedSpec;
  editionDefaults: EditionDefaults;
  theme: ThemeTokens;
  flip: boolean;
}

export function setupPipelineRun(
  spec: SpecInput | PortableSpec,
  editions: RunOptions["editions"],
  warnings: PipelineWarning[],
): PipelineRunSetup {
  const normalized = normalizeAndValidateSpec(spec);
  const editionDefaults = resolvePipelineEditionDefaults(normalized.edition, editions, warnings);
  const theme = resolvePipelineTheme(normalized.theme, editionDefaults);

  return {
    normalized,
    editionDefaults,
    theme,
    flip: normalized.coord?.type === "flip",
  };
}
