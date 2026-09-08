#!/usr/bin/env node
// ggts — check and render portable chart specs.
//
// Thin wrapper: all logic lives in @ggsvelte/core's runCLI (pure entry,
// tested there). This file only wires process streams and the exit code.
//
// Exit codes: 0 rendered · 1 render failed · 2 usage error · 3 invalid spec.
import { readFileSync } from "node:fs";
import process from "node:process";

import { runCommand } from "../dist/index.js";

/** @returns {Promise<string>} */
function readStdin() {
  return new Promise((resolve, reject) => {
    let text = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      text += String(chunk);
    });
    process.stdin.on("end", () => {
      resolve(text);
    });
    process.stdin.on("error", reject);
  });
}

const packageJson = /** @type {unknown} */ (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
);
if (
  typeof packageJson !== "object" ||
  packageJson === null ||
  !("version" in packageJson) ||
  typeof packageJson.version !== "string"
) {
  throw new Error("@ggsvelte/cli package.json has no string version");
}
const packageVersion = packageJson.version;

const code = await runCommand(
  process.argv.slice(2),
  {
    readStdin,
    readFile: (path) => readFileSync(path, "utf8"),
    writeOut: (text) => {
      process.stdout.write(text);
    },
    writeErr: (line) => {
      process.stderr.write(line + "\n");
    },
  },
  { version: packageVersion },
);
process.exit(code);
