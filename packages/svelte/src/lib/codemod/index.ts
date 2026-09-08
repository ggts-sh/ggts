/**
 * Codemod entry point (#659 slice 7, closes #290).
 *
 * Consumed by bin/ggts-codemod.js. Not re-exported from the package root:
 * a one-shot migration tool is not part of the charting API, and pulling
 * `svelte/compiler` into the main entry would drag the compiler into every
 * consumer bundle that imports a component.
 */
export { runCodemodCLI, type CodemodIO } from "./cli.js";
export {
  migratePlotProps,
  PACKAGE_SPECIFIER,
  type MigrateOptions,
  type MigrationResult,
  type PropChange,
  type PropSkip,
} from "./migrate-plot-props.js";
