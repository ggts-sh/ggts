/**
 * Source guards: chart render path must not static-import TypeBox schema
 * validation. Complements docs chunk isolation (docs-chart-stack-isolation).
 */
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const specSrc = path.join(root, "packages/spec/src");

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

/** Value-import of ./schema.js (not import type). */
function valueImportsSchemaJs(source: string): boolean {
  // Strip block comments and line comments so docs don't false-positive.
  const stripped = source.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/(^|[^:])\/\/.*$/gm, "$1");
  // Walk back from each `from "./schema.js"` to the nearest `import` so a
  // preceding multi-line import cannot swallow the schema clause.
  const fromRe = /from\s+["']\.\/schema\.js["']/g;
  let fromMatch: RegExpExecArray | null;
  while ((fromMatch = fromRe.exec(stripped)) !== null) {
    const before = stripped.slice(0, fromMatch.index);
    const importAt = before.lastIndexOf("import");
    if (importAt < 0) continue;
    const clause = before.slice(importAt, fromMatch.index);
    // `import type … from` is erased; value imports load schema.js.
    if (/^import\s+type\b/.test(clause.trimStart())) continue;
    return true;
  }
  return false;
}

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listTsFiles(full));
    else if (name.endsWith(".ts")) out.push(full);
  }
  return out;
}

/** Modules allowed to value-import the TypeBox schema facade. */
const SCHEMA_JS_VALUE_IMPORT_ALLOWLIST = new Set([
  "validate.ts",
  "validate-schema-shape.ts",
  "artifact.ts",
  "index.ts", // public barrel re-exports schemas
  "schema.ts", // the facade itself may re-export
]);

describe("spec render path isolation", () => {
  it("bans value imports of ./schema.js outside TypeBox schema consumers", () => {
    const offenders: string[] = [];
    for (const file of listTsFiles(specSrc)) {
      const base = path.basename(file);
      if (SCHEMA_JS_VALUE_IMPORT_ALLOWLIST.has(base)) continue;
      const source = readFileSync(file, "utf8");
      if (valueImportsSchemaJs(source)) {
        offenders.push(path.relative(root, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps pipeline setup off TypeBox validate()", () => {
    const source = read("packages/core/src/pipeline/setup-run-normalize.ts");
    expect(source).not.toMatch(
      /import\s*\{[^}]*\bvalidate\b[^}]*\}\s*from\s*["']@ggts-sh\/spec["']/,
    );
    // Must keep a TypeBox-free structural gate (not silent skip).
    expect(source).toMatch(/structuralGate|structural-gate|assertStructural/);
  });

  it("keeps assemblePortableSpec off the fluent builder validate path", () => {
    const assemble = read("packages/compose/src/assemble.ts");
    const code = assemble.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).not.toMatch(/import\s*\{[^}]*\bgg\b/);
    // No builder.spec() call (comments already stripped).
    expect(code).not.toMatch(/\bgg\s*\(/);
    expect(code).not.toMatch(/\.spec\s*\(/);
    expect(code).toMatch(/\bnormalize\b/);
  });

  it("keeps foldPlotLayer off the fluent builder", () => {
    const fold = read("packages/compose/src/fold.ts");
    expect(fold).not.toMatch(/import\s*\{[^}]*\bgg\b/);
    expect(fold).not.toMatch(/from\s*["']@ggts-sh\/spec["'][^;\n]*\bgg\b/);
  });

  it("keeps schema-names and temporal runtime free of typebox imports", () => {
    for (const rel of [
      "packages/spec/src/schema-names.ts",
      "packages/spec/src/temporal-parse-core.ts",
      "packages/spec/src/temporal-interval.ts",
      "packages/spec/src/normalize.ts",
    ] as const) {
      const source = read(rel);
      expect(source, rel).not.toMatch(/from\s*["']typebox["']/);
      expect(source, rel).not.toMatch(/from\s*["']typebox\//);
    }
  });
});
