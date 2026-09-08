/**
 * @ggts-sh/cli — programmatic surface of the `ggts render` bin.
 *
 * The bin (bin/ggts.js) wires process streams around
 * `runCLI`, which lives in @ggts-sh/core so the pipeline and the CLI
 * share one tested implementation. This entry re-exports that surface so
 * hosts embedding the CLI (test harnesses, sandbox runners) can call it
 * without spawning a process.
 */
// Every export needs a lifecycle tag; the header default is read
// into lifecycle.json by scripts/gen-lifecycle.ts.
// @lifecycle-default experimental
export { runCLI } from "@ggts-sh/core";
export type { CLIIO } from "@ggts-sh/core";

export { runCommand } from "./command.js";
