import { runCLI } from "@ggts-sh/core";
import type { CLIIO } from "@ggts-sh/core";

/** Run the installed ggts command with explicit render/check subcommands. */
export function runCommand(
  argv: readonly string[],
  io: CLIIO,
  options: { version?: string } = {},
): Promise<number> {
  const [command, ...args] = argv;
  if (command === "render" || command === "check") {
    return runCLI(args, io, { ...options, command });
  }
  if (command === "--version") return runCLI(argv, io, options);
  const help = command === "--help" || command === "-h";
  if (!help || args.length > 0) {
    io.writeErr(
      JSON.stringify({ kind: "error", code: "usage", message: "Expected render or check." }),
    );
  }
  io.writeErr(
    "Usage: ggts <render|check> [spec.json] [options]\n\nrender  Validate and render SVG to stdout.\ncheck   Run the same checks without SVG output.\n\nDiagnostics are JSON lines on stderr. Use ggts render --help for options.",
  );
  return Promise.resolve(help && args.length === 0 ? 0 : 2);
}
