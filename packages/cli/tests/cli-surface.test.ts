/**
 * Programmatic surface of @ggsvelte/cli (`src/index.ts`).
 *
 * Bin smoke tests only spawn `bin/ggsvelte-render.js`, which imports
 * `@ggsvelte/core` directly — so they never load this package's entry and
 * never appear under the Codecov `packages-cli` component. Importing the
 * re-export here is what puts `packages/cli/src/**` into unit lcov.
 */
import { describe, expect, it } from "bun:test";
import type { CLIIO } from "../src/index.ts";
import { runCLI, runCommand } from "../src/index.ts";

const SPEC = {
  data: {
    values: [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ],
  },
  aes: { x: { field: "x" }, y: { field: "y" } },
  layers: [{ geom: "point" }],
};

function makeIO(stdin = ""): { io: CLIIO; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: {
      readStdin: () => Promise.resolve(stdin),
      readFile: (path) => {
        throw new Error(`ENOENT: ${path}`);
      },
      writeOut: (text) => {
        out.push(text);
      },
      writeErr: (line) => {
        err.push(line);
      },
    },
  };
}

describe("@ggsvelte/cli surface (src/index.ts)", () => {
  it("check runs render validation and diagnostics without writing SVG", async () => {
    for (const [input, flags, expected] of [
      [JSON.stringify(SPEC), [], 0],
      [JSON.stringify(SPEC), ["--max-marks", "1"], 1],
      ["{", [], 2],
      [JSON.stringify({ layers: [] }), [], 3],
    ] as const) {
      const render = makeIO(input);
      const check = makeIO(input);
      expect(await runCommand(["render", ...flags], render.io)).toBe(expected);
      expect(await runCommand(["check", ...flags], check.io)).toBe(expected);
      expect(check.out).toEqual([]);
      expect(check.err).toEqual(render.err);
      if (expected === 0) expect(render.out.join("")).toStartWith("<svg ");
    }
  });

  it("requires a subcommand and exposes command-specific help and version", async () => {
    const missing = makeIO();
    expect(await runCommand([], missing.io)).toBe(2);
    const help = makeIO();
    expect(await runCommand(["check", "--help"], help.io)).toBe(0);
    expect(help.err.join("\n")).toContain("ggts check");
    const version = makeIO();
    expect(await runCommand(["--version"], version.io, { version: "1.2.3" })).toBe(0);
    expect(version.out).toEqual(["1.2.3\n"]);
  });
  it("re-exports runCLI that renders a point chart to SVG", async () => {
    expect(typeof runCLI).toBe("function");
    const { io, out } = makeIO(JSON.stringify(SPEC));
    const code = await runCLI([], io);
    expect(code).toBe(0);
    expect(out.join("")).toStartWith("<svg ");
    expect(out.join("").trimEnd()).toEndWith("</svg>");
  });

  it("re-exports runCLI that honors the version option", async () => {
    const { io, out, err } = makeIO();
    const code = await runCLI(["--version"], io, { version: "0.0.0-test" });
    expect(code).toBe(0);
    expect(out).toEqual(["0.0.0-test\n"]);
    expect(err).toEqual([]);
  });

  it("emits percent-labels-out-of-range when labels are % on count-scale data", async () => {
    // Counts (40, 80) with ".0%" would print 4000%/8000% — CLI must disclose.
    const percentSpec = {
      data: {
        values: [
          { x: "a", y: 40 },
          { x: "b", y: 80 },
        ],
      },
      aes: { x: { field: "x" }, y: { field: "y" } },
      layers: [{ geom: "col" }],
      scales: { y: { labels: ".0%" } },
    };
    const { io, err } = makeIO(JSON.stringify(percentSpec));
    const code = await runCLI([], io);
    expect(code).toBe(0);
    const advisories = err
      .map((line) => {
        try {
          return JSON.parse(line) as { kind?: string; code?: string };
        } catch {
          return null;
        }
      })
      .filter((row) => row !== null && row.kind === "advisory");
    expect(advisories.some((row) => row!.code === "percent-labels-out-of-range")).toBe(true);
  });
});
