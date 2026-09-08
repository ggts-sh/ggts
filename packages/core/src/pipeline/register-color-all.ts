import { registerContinuousLegend } from "../legend-register-continuous.js";
import { registerDiscreteLegend } from "../legend-register-discrete.js";
import { resolveBinnedColorScale } from "./scale-color-binned.js";
import { resolveIdentityColorScale } from "./scale-color-identity.js";
import { resolveManualColorScale } from "./scale-color-manual.js";
import { resolveOrdinalColorScale } from "./scale-color-ordinal.js";
import { registerColorScaleResolver } from "./scale-color-registry.js";
import { resolveSequentialColorScale } from "./scale-color-sequential.js";

let registered = false;

/**
 * Register every color/fill scale kind. Idempotent.
 *
 * Imports the resolvers directly so `@ggts-sh/core/render` / `registerBasic()`
 * do not also pull the per-kind `register*Color` wrapper modules.
 */
export function registerAllColorKinds(): void {
  if (registered) return;
  registered = true;
  registerDiscreteLegend();
  registerContinuousLegend();
  registerColorScaleResolver("ordinal", (input) => {
    const domainValues = input.catalogValues.length > 0 ? input.catalogValues : input.values;
    return resolveOrdinalColorScale({
      name: input.name,
      values: domainValues.filter((value) => value !== null),
      config: input.config,
      prevState: input.prevState,
      legendTitle: input.legendTitle,
      warnings: input.warnings,
      advisories: input.advisories,
      editionDefaults: input.editionDefaults,
    });
  });
  registerColorScaleResolver("sequential", (input) =>
    resolveSequentialColorScale({
      name: input.name,
      values: input.values,
      anyDiscreteField: input.anyDiscreteField,
      config: input.config,
      legendTitle: input.legendTitle,
      warnings: input.warnings,
      advisories: input.advisories,
      editionDefaults: input.editionDefaults,
    }),
  );
  registerColorScaleResolver("binned", (input) =>
    resolveBinnedColorScale({
      name: input.name,
      values: input.values,
      config: input.config ?? { type: "binned" },
      legendTitle: input.legendTitle,
      warnings: input.warnings,
      editionDefaults: input.editionDefaults,
    }),
  );
  registerColorScaleResolver("manual", (input) =>
    resolveManualColorScale({
      name: input.name,
      values: input.catalogValues.length > 0 ? input.catalogValues : input.values,
      observedValues: input.values,
      config: input.config ?? { type: "manual", range: [] },
      legendTitle: input.legendTitle,
      warnings: input.warnings,
    }),
  );
  registerColorScaleResolver("identity", (input) =>
    resolveIdentityColorScale({
      name: input.name,
      values: input.values,
      config: input.config ?? { type: "identity" },
      legendTitle: input.legendTitle,
      warnings: input.warnings,
    }),
  );
}
