#!/usr/bin/env node
// ggts-codemod — migrate deprecated <GGPlot> grammar props to child layers.
//
// Thin wrapper: all logic lives in runCodemodCLI (pure entry, tested in
// tests/codemod/), mirroring @ggts-sh/cli's bin/ggsvelte-render.js. This file only wires the
// filesystem, process streams, and the exit code.
//
// Dry-run by default (ADR 0013) — writes only with --write.
//
// Exit codes: 0 ok · 1 a file failed to parse · 2 usage error.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

import { runCodemodCLI } from "../dist/codemod/index.js";

/**
 * @param {string} path
 * @returns {string[]}
 */
function listSvelteFiles(path) {
  if (!statSync(path).isDirectory()) return [path];
  /** @type {string[]} */
  const found = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const child = join(path, entry.name);
    if (entry.isDirectory()) found.push(...listSvelteFiles(child));
    else if (entry.name.endsWith(".svelte")) found.push(child);
  }
  return found;
}

const code = runCodemodCLI(process.argv.slice(2), {
  listSvelteFiles,
  readFile: (path) => readFileSync(path, "utf8"),
  writeFile: (path, content) => {
    writeFileSync(path, content);
  },
  writeOut: (line) => {
    process.stdout.write(line + "\n");
  },
  writeErr: (line) => {
    process.stderr.write(line + "\n");
  },
});
process.exit(code);
