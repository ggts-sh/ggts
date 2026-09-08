/**
 * `ggts-codemod` — opt-in migration of deprecated <GGPlot> grammar props
 * to child layers (#659 slice 7, closes #290).
 *
 * Pure entry point: all I/O is injected through {@link CodemodIO}, so the whole
 * command is testable without touching a disk. bin/ggts-codemod.js wires
 * process streams and the exit code, exactly as @ggts-sh/cli's
 * bin/ggts.js does.
 *
 * ADR 0013: dry-run by default, writes only behind an explicit `--write`, and
 * anything the transform refuses to guess at is reported with the guide anchor
 * for the manual change rather than half-migrated.
 *
 * Exit codes: 0 ok · 1 a file failed to parse · 2 usage error.
 */
import { migratePlotProps, type PropSkip } from "./migrate-plot-props.js";

/** Filesystem and streams, injected so the command stays pure. */
export interface CodemodIO {
  /** Every .svelte file at `path`, which may be a file or a directory. */
  listSvelteFiles: (path: string) => string[];
  readFile: (path: string) => string;
  writeFile: (path: string, content: string) => void;
  writeOut: (line: string) => void;
  writeErr: (line: string) => void;
}

const USAGE = [
  "usage: ggts-codemod [--write] <path…>",
  "",
  "Migrate deprecated <GGPlot> grammar props (facet, coord, scales, guides,",
  "legend, theme, labs) to declaration-only child layers.",
  "",
  "  --write     apply the changes (default: print a diff and write nothing)",
  "  --source=S  also treat module specifier S as ggts (repeatable)",
  "  --help      show this message",
  "",
  "Shapes the codemod will not guess at are reported with the guide anchor",
  "for the manual change: https://ggts.sh/guide/upgrading",
].join("\n");

interface Options {
  readonly write: boolean;
  readonly sources: string[];
  readonly paths: string[];
}

function parseArgs(argv: readonly string[]): Options | { error: string } {
  const sources: string[] = [];
  const paths: string[] = [];
  let write = false;

  for (const arg of argv) {
    if (arg === "--write") write = true;
    else if (arg.startsWith("--source=")) sources.push(arg.slice("--source=".length));
    else if (arg.startsWith("-")) return { error: `unknown option: ${arg}` };
    else paths.push(arg);
  }

  if (paths.length === 0) return { error: "no paths given" };
  return { write, sources, paths };
}

/**
 * A unified-ish diff of the changed lines.
 *
 * Deliberately line-based and dependency-free: the point is to let a human see
 * what `--write` would do, not to produce a patch another tool can apply.
 */
function diff(path: string, before: string, after: string): string[] {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const lines = [`--- ${path}`, `+++ ${path}`];

  let b = 0;
  let a = 0;
  while (b < beforeLines.length || a < afterLines.length) {
    if (b < beforeLines.length && a < afterLines.length && beforeLines[b] === afterLines[a]) {
      b += 1;
      a += 1;
      continue;
    }
    // `before` exhausted: everything left is appended. Handled ahead of the
    // resync scan because that scan can only advance `a` as far as a line the
    // two sides still share, and there is none left — which advanced neither
    // index and spun forever on a file with no trailing newline.
    if (b >= beforeLines.length) {
      lines.push(`+${afterLines[a]!}`);
      a += 1;
      continue;
    }
    // Resynchronize on the next line the two sides share, so an insertion
    // shows as added lines rather than rewriting the whole tail. indexOf
    // searches from `a` and an exact hit at `a` was consumed above, so a
    // successful resync always sits strictly ahead and always advances `a`.
    const resync = afterLines.indexOf(beforeLines[b]!, a);
    if (resync === -1) {
      lines.push(`-${beforeLines[b]!}`);
      b += 1;
      continue;
    }
    while (a < resync) {
      lines.push(`+${afterLines[a]!}`);
      a += 1;
    }
  }
  return lines;
}

function reportSkips(io: CodemodIO, path: string, skips: readonly PropSkip[]): void {
  for (const skip of skips) {
    io.writeErr(
      `manual change required: ${path}:${String(skip.line)} — ${skip.prop} (${skip.reason})`,
    );
    io.writeErr(`  see ${skip.docUrl}`);
  }
}

/**
 * Run the codemod.
 *
 * Parses every file before writing any of them: a parse failure halfway
 * through a directory must not leave a half-migrated tree behind.
 */
export function runCodemodCLI(argv: readonly string[], io: CodemodIO): number {
  if (argv.includes("--help") || argv.includes("-h")) {
    io.writeOut(USAGE);
    return 0;
  }

  const options = parseArgs(argv);
  if ("error" in options) {
    io.writeErr(options.error);
    io.writeErr(USAGE);
    return 2;
  }

  const files = options.paths.flatMap((path) => io.listSvelteFiles(path));
  const pending: { path: string; before: string; after: string }[] = [];
  let failed = false;

  for (const path of files) {
    if (!path.endsWith(".svelte")) continue;
    const before = io.readFile(path);
    let result;
    try {
      result = migratePlotProps(before, { sources: options.sources });
    } catch (error) {
      io.writeErr(`${path}: ${error instanceof Error ? error.message : String(error)}`);
      failed = true;
      continue;
    }
    reportSkips(io, path, result.skipped);
    if (result.changes.length > 0) pending.push({ path, before, after: result.code });
  }

  if (failed) return 1;

  for (const change of pending) {
    if (options.write) io.writeFile(change.path, change.after);
    else for (const line of diff(change.path, change.before, change.after)) io.writeOut(line);
  }

  const count = pending.length;
  const noun = count === 1 ? "file" : "files";
  io.writeOut(
    options.write
      ? `${String(count)} ${noun} changed`
      : `${String(count)} ${noun} would change (run again with --write to apply)`,
  );
  return 0;
}
