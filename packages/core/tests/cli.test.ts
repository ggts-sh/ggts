/**
 * ggts render CLI: runCLI unit tests (exit codes, stdout purity, JSON-line
 * diagnostics). Bin smoke tests spawning the workspace bin live in
 * packages/cli/tests/cli-bin.test.ts.
 */
import { describe, expect, it } from "bun:test";
import type { CLIIO } from "../src/cli.ts";
import { CLI_OPTIONS, runCLI, scaleDiagnosticCliKind } from "../src/cli.ts";

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

interface Captured {
  io: CLIIO;
  out: string[];
  err: string[];
}

function makeIO(stdin = "", files: Record<string, string> = {}): Captured {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: {
      readStdin: () => Promise.resolve(stdin),
      readFile: (path) => {
        const content = files[path];
        if (content === undefined) throw new Error(`ENOENT: ${path}`);
        return content;
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

describe("runCLI", () => {
  it("owns parser, help, and docs option identity in one package-private registry", async () => {
    expect(CLI_OPTIONS.map((option) => option.flag)).toEqual([
      "--width",
      "--height",
      "--data",
      "--max-marks",
      "--inspect",
      "--version",
      "--help",
    ]);
    expect(CLI_OPTIONS.find((option) => option.flag === "--max-marks")?.anchor).toBe("max-marks");
    expect(CLI_OPTIONS.find((option) => option.flag === "--inspect")?.anchor).toBe("inspect");
    const { io, err } = makeIO();
    expect(await runCLI(["--help"], io)).toBe(0);
    for (const option of CLI_OPTIONS) expect(err.join("\n")).toContain(option.flag);
  });

  it("renders a spec from stdin: SVG on stdout, advisories as stderr JSON lines", async () => {
    const { io, out, err } = makeIO(JSON.stringify(SPEC));
    const code = await runCLI([], io);
    expect(code).toBe(0);
    expect(out.join("")).toStartWith("<svg ");
    expect(out.join("").trimEnd()).toEndWith("</svg>");
    const lines = err.map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(lines.some((l) => l["kind"] === "advisory" && l["code"] === "scale-type-inferred")).toBe(
      true,
    );
  });

  it("surfaces fractional-calendar-years on stderr as a spec-lint advisory", async () => {
    // Nightingale-style year + month/12 on a linear scale — silent decimal
    // labels without this lint. Exit stays 0 (advisories never block).
    const months: number[] = [];
    for (let i = 0; i < 24; i++) {
      const monthIndex = 3 + i;
      months.push(1854 + Math.floor(monthIndex / 12) + (monthIndex % 12) / 12);
    }
    const fractionalYearsSpec = {
      data: {
        columns: {
          year: months,
          rate: months.map((_, i) => i + 1),
        },
      },
      aes: { x: { field: "year" }, y: { field: "rate" } },
      layers: [{ geom: "area" }],
      labs: { title: "fractional years trap" },
    };
    const { io, out, err } = makeIO(JSON.stringify(fractionalYearsSpec));
    const code = await runCLI([], io);
    expect(code).toBe(0);
    expect(out.join("")).toStartWith("<svg ");
    const lines = err.map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(
      lines.some(
        (l) =>
          l["kind"] === "advisory" &&
          l["source"] === "spec-lint" &&
          l["code"] === "fractional-calendar-years",
      ),
    ).toBe(true);
  });

  it("maps scale diagnostics onto the documented error|warning|advisory kinds", async () => {
    const temporalSpec = {
      data: {
        values: [
          { when: "1835", value: 1 },
          { when: "2026", value: 2 },
        ],
      },
      aes: { x: { field: "when" }, y: { field: "value" } },
      layers: [{ geom: "point" }],
    };
    const { io, out, err } = makeIO(JSON.stringify(temporalSpec));
    const code = await runCLI([], io);
    expect(code).toBe(0);
    expect(out.join("")).toStartWith("<svg ");
    const lines = err.map((l) => JSON.parse(l) as Record<string, unknown>);
    const kinds = new Set(lines.map((line) => line["kind"]));
    expect(kinds.has("scale-diagnostic")).toBe(false);
    for (const kind of kinds) {
      expect(["error", "warning", "advisory"]).toContain(kind);
    }
    // Temporal inference still surfaces on stderr without inventing a fourth kind.
    expect(
      lines.some(
        (line) =>
          line["source"] === "scale" ||
          (typeof line["code"] === "string" && line["code"].includes("temporal")),
      ) || lines.some((line) => line["kind"] === "advisory"),
    ).toBe(true);
  });

  it("preserves scale diagnostic severity on the documented CLI kind field", () => {
    // Success-path scale diagnostics may carry severity "error" (public ScaleDiagnostic
    // permits it). JSONL consumers gate on kind; kind must match severity, not demote.
    expect(scaleDiagnosticCliKind("error")).toBe("error");
    expect(scaleDiagnosticCliKind("warning")).toBe("warning");
    expect(scaleDiagnosticCliKind("advisory")).toBe("advisory");
  });

  it("renders a spec from a file with --width/--height", async () => {
    const { io, out } = makeIO("", { "spec.json": JSON.stringify(SPEC) });
    const code = await runCLI(["spec.json", "--width", "300", "--height", "200"], io);
    expect(code).toBe(0);
    expect(out.join("")).toContain('width="300" height="200"');
  });

  it("--data resolves named datasets", async () => {
    const spec = { ...SPEC, data: { name: "pts" } };
    const { io, out } = makeIO("", {
      "spec.json": JSON.stringify(spec),
      "data.json": JSON.stringify({ pts: { values: [{ x: 1, y: 2 }] } }),
    });
    const code = await runCLI(["spec.json", "--data", "data.json"], io);
    expect(code).toBe(0);
    expect(out.join("")).toContain("<circle");
  });

  it("exit 3 for invalid specs, with the agent error contract on stderr", async () => {
    const { io, out, err } = makeIO(JSON.stringify({ layers: [{ geom: "poit" }] }));
    const code = await runCLI([], io);
    expect(code).toBe(3);
    expect(out).toHaveLength(0); // stdout stays pure
    const first = JSON.parse(err[0]!) as Record<string, unknown>;
    expect(first["kind"]).toBe("error");
    expect(first["code"]).toBe("unknown-geom");
    expect(String(first["message"])).toContain('Did you mean "point"?');
  });

  it("exit 1 for render failures (unknown dataset)", async () => {
    const { io, err } = makeIO(JSON.stringify({ ...SPEC, data: { name: "nope" } }));
    const code = await runCLI([], io);
    expect(code).toBe(1);
    expect((JSON.parse(err[0]!) as Record<string, unknown>)["code"]).toBe("unknown-dataset");
  });

  it("exit 1 when --max-marks is exceeded", async () => {
    const { io } = makeIO(JSON.stringify(SPEC));
    expect(await runCLI(["--max-marks", "1"], io)).toBe(1);
  });

  it("exit 2 for usage errors and unreadable/invalid input", async () => {
    expect(await runCLI(["--bogus"], makeIO().io)).toBe(2);
    expect(await runCLI(["missing.json"], makeIO().io)).toBe(2);
    expect(await runCLI([], makeIO("not json{").io)).toBe(2);
    expect(await runCLI(["--width", "abc"], makeIO().io)).toBe(2);
  });

  it("--version prints the installed package version without reading stdin", async () => {
    let stdinReads = 0;
    const { io, err, out } = makeIO();
    io.readStdin = () => {
      stdinReads++;
      return Promise.resolve("");
    };

    expect(await runCLI(["--version"], io, { version: "0.3.0" })).toBe(0);
    expect(out).toEqual(["0.3.0\n"]);
    expect(err).toEqual([]);
    expect(stdinReads).toBe(0);
    expect(await runCLI(["--version", "plot.json"], makeIO().io, { version: "0.3.0" })).toBe(2);
    expect(await runCLI(["--version", "--help"], makeIO().io, { version: "0.3.0" })).toBe(2);
  });

  it("--help prints usage to stderr, exit 0", async () => {
    const { io, err, out } = makeIO();
    expect(await runCLI(["--help"], io)).toBe(0);
    expect(out).toHaveLength(0);
    expect(err.join("\n")).toContain("Usage: ggts render");
  });

  it("--help includes --data detail for the named-dataset JSON shape", async () => {
    const { io, err } = makeIO();
    expect(await runCLI(["--help"], io)).toBe(0);
    const help = err.join("\n");
    const dataOption = CLI_OPTIONS.find((option) => option.flag === "--data");
    expect(dataOption && "detail" in dataOption).toBe(true);
    if (dataOption && "detail" in dataOption) {
      expect(help).toContain(dataOption.detail);
    }
  });

  it("emits INTERACTION_INSPECT_X_ON_COL on stderr when --inspect xy meets a col layer", async () => {
    // Host inspect mode is not PortableSpec; agents declare intent so the
    // same pure collectors that feed ondiagnostic reach the CLI JSONL loop.
    const colSpec = {
      data: {
        values: [
          { category: "a", amount: 3 },
          { category: "b", amount: 5 },
        ],
      },
      aes: { x: { field: "category" }, y: { field: "amount" } },
      layers: [{ geom: "col" }],
    };
    const { io, out, err } = makeIO(JSON.stringify(colSpec));
    const code = await runCLI(["--inspect", "xy"], io);
    expect(code).toBe(0);
    expect(out.join("")).toStartWith("<svg ");
    const lines = err.map((l) => JSON.parse(l) as Record<string, unknown>);
    const interaction = lines.find(
      (l) => l["source"] === "interaction" && l["code"] === "INTERACTION_INSPECT_X_ON_COL",
    );
    expect(interaction).toMatchObject({
      kind: "advisory",
      source: "interaction",
      code: "INTERACTION_INSPECT_X_ON_COL",
      prop: "inspect.mode",
      actual: "xy",
    });
    expect(typeof interaction?.["message"]).toBe("string");
  });

  it("does not emit interaction inspect advisories without --inspect", async () => {
    const colSpec = {
      data: {
        values: [
          { category: "a", amount: 3 },
          { category: "b", amount: 5 },
        ],
      },
      aes: { x: { field: "category" }, y: { field: "amount" } },
      layers: [{ geom: "col" }],
    };
    const { io, err } = makeIO(JSON.stringify(colSpec));
    expect(await runCLI([], io)).toBe(0);
    const lines = err.map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(lines.some((l) => l["source"] === "interaction")).toBe(false);
  });

  it("is silent for --inspect exact on col (auto/exact never fire x-guide codes)", async () => {
    const colSpec = {
      data: {
        values: [
          { category: "a", amount: 3 },
          { category: "b", amount: 5 },
        ],
      },
      aes: { x: { field: "category" }, y: { field: "amount" } },
      layers: [{ geom: "col" }],
    };
    const { io, err } = makeIO(JSON.stringify(colSpec));
    expect(await runCLI(["--inspect", "exact"], io)).toBe(0);
    const lines = err.map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(lines.some((l) => l["code"] === "INTERACTION_INSPECT_X_ON_COL")).toBe(false);
  });

  it("still emits X_ON_COL for --inspect x under coord flip (#1409 band guide remains)", async () => {
    // PortableSpec coord is the object form; bare "flip" is a host-prop shorthand.
    const flippedCol = {
      data: {
        values: [
          { category: "a", amount: 3 },
          { category: "b", amount: 5 },
        ],
      },
      aes: { x: { field: "category" }, y: { field: "amount" } },
      layers: [{ geom: "col" }],
      coord: { type: "flip" },
    };
    const { io, err } = makeIO(JSON.stringify(flippedCol));
    expect(await runCLI(["--inspect", "x"], io)).toBe(0);
    const lines = err.map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(
      lines.some(
        (l) => l["source"] === "interaction" && l["code"] === "INTERACTION_INSPECT_X_ON_COL",
      ),
    ).toBe(true);
  });

  it("exit 2 for an unknown --inspect mode", async () => {
    const { io, err } = makeIO(JSON.stringify(SPEC));
    expect(await runCLI(["--inspect", "nearest"], io)).toBe(2);
    expect(err.join("\n")).toContain("--inspect");
  });

  it("rewrites histogram→bar so --inspect xy matches host ondiagnostic", async () => {
    // Host assembled layers run through normalize(); raw CLI JSON does not.
    // Alias rewrite in layerGeomsFromSpecLayers keeps the agent path honest.
    const histogramSpec = {
      data: {
        values: [{ measure: 1 }, { measure: 2 }, { measure: 2 }, { measure: 3 }],
      },
      aes: { x: { field: "measure" } },
      layers: [{ geom: "histogram" }],
    };
    const { io, err } = makeIO(JSON.stringify(histogramSpec));
    expect(await runCLI(["--inspect", "xy"], io)).toBe(0);
    const lines = err.map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(
      lines.some(
        (l) => l["source"] === "interaction" && l["code"] === "INTERACTION_INSPECT_X_ON_BAR",
      ),
    ).toBe(true);
  });

  it("maps bisect severity to kind warning on stderr", async () => {
    const labeledCol = {
      data: {
        values: [
          { category: "a", amount: 3 },
          { category: "b", amount: 5 },
        ],
      },
      aes: { x: { field: "category" }, y: { field: "amount" } },
      layers: [{ geom: "col" }, { geom: "text", aes: { label: { field: "amount" } } }],
    };
    const { io, err } = makeIO(JSON.stringify(labeledCol));
    expect(await runCLI(["--inspect", "xy"], io)).toBe(0);
    const lines = err.map((l) => JSON.parse(l) as Record<string, unknown>);
    const bisect = lines.find(
      (l) =>
        l["source"] === "interaction" && l["code"] === "INTERACTION_INSPECT_X_BISECTS_COL_LABELS",
    );
    expect(bisect).toMatchObject({
      kind: "warning",
      source: "interaction",
      code: "INTERACTION_INSPECT_X_BISECTS_COL_LABELS",
    });
  });
});
