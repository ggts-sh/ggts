import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runCommand } from "../packages/cli/src/index.ts";
import { SANDBOX_SPEC, SANDBOX_SPEC_JSON } from "./agent-quickstart.ts";
import { codeBlocks } from "./guide-code-contract.ts";

test("the README sandbox chart runs through check and render without a framework", async () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  const example = codeBlocks(readme).find((block) => block.language === "json");
  expect(example).toBeDefined();
  expect(JSON.parse(example!.source)).toEqual(SANDBOX_SPEC);
  for (const command of ["check", "render"] as const) {
    const output: string[] = [];
    const errors: string[] = [];
    expect(
      await runCommand([command], {
        readStdin: () => Promise.resolve(SANDBOX_SPEC_JSON),
        readFile: () => {
          throw new Error("unexpected file read");
        },
        writeOut: (text) => {
          output.push(text);
        },
        writeErr: (text) => {
          errors.push(text);
        },
      }),
    ).toBe(0);
    expect(
      errors.filter((line) => {
        const diagnostic: unknown = JSON.parse(line);
        return (
          typeof diagnostic === "object" &&
          diagnostic !== null &&
          "kind" in diagnostic &&
          diagnostic.kind === "error"
        );
      }),
    ).toEqual([]);
    if (command === "check") expect(output).toEqual([]);
    else expect(output.join("")).toContain("Annual sales");
  }
});
