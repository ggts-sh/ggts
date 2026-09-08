/**
 * Codemod CLI (#659 slice 7, closes #290).
 *
 * ADR 0013's hard rule: "opt-in command, dry-run/diff by default; writes only
 * behind an explicit --write. Checks never rewrite code." Every assertion here
 * exists to keep that true.
 *
 * `runCodemodCLI` is pure — all I/O is injected — so these run in the node
 * lane with an in-memory filesystem and no temp directories.
 */
import { describe, expect, it } from "vitest";

import { runCodemodCLI, type CodemodIO } from "../../src/lib/codemod/cli.js";

const PLOT = [
  '<script lang="ts">',
  '  import { GeomPoint, GGPlot } from "@ggts-sh/svelte";',
  "</script>",
  "",
  '<GGPlot data={rows} theme="dark">',
  "  <GeomPoint />",
  "</GGPlot>",
  "",
].join("\n");

interface Harness {
  readonly io: CodemodIO;
  readonly files: Map<string, string>;
  readonly out: string[];
  readonly err: string[];
}

function harness(files: Record<string, string>): Harness {
  const store = new Map(Object.entries(files));
  const out: string[] = [];
  const err: string[] = [];
  return {
    files: store,
    out,
    err,
    io: {
      listSvelteFiles: (path) =>
        [...store.keys()].filter((name) => name === path || name.startsWith(`${path}/`)),
      readFile: (path) => {
        const content = store.get(path);
        if (content === undefined) throw new Error(`missing ${path}`);
        return content;
      },
      writeFile: (path, content) => {
        store.set(path, content);
      },
      writeOut: (line) => {
        out.push(line);
      },
      writeErr: (line) => {
        err.push(line);
      },
    },
  };
}

describe("runCodemodCLI", () => {
  it("defaults to a dry run: prints a diff and writes nothing", () => {
    const h = harness({ "src/Chart.svelte": PLOT });
    const code = runCodemodCLI(["src/Chart.svelte"], h.io);

    expect(code).toBe(0);
    expect(h.files.get("src/Chart.svelte")).toBe(PLOT);
    const diff = h.out.join("\n");
    expect(diff).toContain("--- src/Chart.svelte");
    expect(diff).toContain('-<GGPlot data={rows} theme="dark">');
    expect(diff).toContain('+  <Theme name="dark" />');
    expect(h.out.join("\n")).toContain("1 file would change");
  });

  it("writes only behind --write", () => {
    const h = harness({ "src/Chart.svelte": PLOT });
    const code = runCodemodCLI(["--write", "src/Chart.svelte"], h.io);

    expect(code).toBe(0);
    expect(h.files.get("src/Chart.svelte")).toContain('<Theme name="dark" />');
    expect(h.files.get("src/Chart.svelte")).not.toContain('theme="dark">');
    expect(h.out.join("\n")).toContain("1 file changed");
  });

  it("reports files it left alone without printing a diff for them", () => {
    const h = harness({ "src/Plain.svelte": "<p>no plot here</p>\n" });
    const code = runCodemodCLI(["src/Plain.svelte"], h.io);

    expect(code).toBe(0);
    expect(h.out.join("\n")).toContain("0 files would change");
    expect(h.out.join("\n")).not.toContain("---");
  });

  it("prints a manual-change pointer for every shape it refuses to guess at", () => {
    const h = harness({
      "src/Dyn.svelte": PLOT.replace('theme="dark"', "theme={currentTheme}"),
    });
    const code = runCodemodCLI(["src/Dyn.svelte"], h.io);

    expect(code).toBe(0);
    const warnings = h.err.join("\n");
    expect(warnings).toContain("manual change required");
    expect(warnings).toContain("src/Dyn.svelte:5");
    expect(warnings).toContain("theme");
    expect(warnings).toContain(
      "https://ggts.sh/guide/upgrading#compose-the-theme-as-a-child-layer",
    );
  });

  it("walks a directory argument", () => {
    const h = harness({ "src/a.svelte": PLOT, "src/b.svelte": PLOT, "src/c.txt": "x" });
    const code = runCodemodCLI(["--write", "src"], h.io);

    expect(code).toBe(0);
    expect(h.out.join("\n")).toContain("2 files changed");
  });

  it("exits 2 on usage errors", () => {
    const h = harness({});
    expect(runCodemodCLI([], h.io)).toBe(2);
    expect(h.err.join("\n")).toContain("usage:");

    const unknown = harness({ "a.svelte": PLOT });
    expect(runCodemodCLI(["--dry-run", "a.svelte"], unknown.io)).toBe(2);
    expect(unknown.err.join("\n")).toContain("--dry-run");
  });

  it("exits 1 when a file cannot be parsed, leaving every file unwritten", () => {
    const h = harness({ "src/ok.svelte": PLOT, "src/broken.svelte": "<GGPlot {{{ />" });
    const code = runCodemodCLI(["--write", "src"], h.io);

    expect(code).toBe(1);
    expect(h.err.join("\n")).toContain("src/broken.svelte");
    // All-or-nothing: a parse failure anywhere must not leave a half-migrated tree.
    expect(h.files.get("src/ok.svelte")).toBe(PLOT);
  });

  it("diffs a file with no trailing newline whose plot gains lines", () => {
    // Regression: the resync scan advanced neither index once `before` was
    // exhausted while `after` still had lines, so the default (diff) mode
    // hung forever. Reachable through the codemod's own self-closing
    // conversion at EOF — every other case has a shared trailing blank line
    // that happens to resync the scan.
    const h = harness({
      "src/Tail.svelte": [
        '<script lang="ts">',
        '  import { GGPlot } from "@ggts-sh/svelte";',
        "</script>",
        "",
        '<GGPlot data={rows} theme="dark" />',
      ].join("\n"),
    });

    const code = runCodemodCLI(["src/Tail.svelte"], h.io);

    expect(code).toBe(0);
    const diff = h.out.join("\n");
    expect(diff).toContain('+  <Theme name="dark" />');
    expect(diff).toContain("+</GGPlot>");
    expect(diff).toContain("1 file would change");
  });

  it("prints help and exits 0", () => {
    const h = harness({});
    expect(runCodemodCLI(["--help"], h.io)).toBe(0);
    expect(h.out.join("\n")).toContain("--write");
  });
});
