/**
 * Post-build guard: render vs validate package groups stay separate after a
 * docs production build. Skips when build output is absent (unit CI without
 * docs build).
 */
import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const serverChunks = path.join(root, "apps/docs/.svelte-kit/output/server/chunks");
const renderChunk = path.join(serverChunks, "ggsvelte-spec.js");
const validateChunk = path.join(serverChunks, "ggsvelte-spec-validate.js");

const hasBuild = existsSync(renderChunk) && existsSync(validateChunk);

describe.skipIf(!hasBuild)("docs ggsvelte-spec render/validate chunk split", () => {
  it("emits separate validate and render named chunks", () => {
    expect(existsSync(validateChunk)).toBe(true);
    expect(existsSync(renderChunk)).toBe(true);
  });

  it("keeps TypeBox compile weight out of the render chunk", () => {
    const render = readFileSync(renderChunk, "utf8");
    const validate = readFileSync(validateChunk, "utf8");
    // Compiled TypeBox validators ship long check templates; render must not.
    const renderCompileHits = (render.match(/Number\.isInteger/g) ?? []).length;
    const validateCompileHits = (validate.match(/Number\.isInteger/g) ?? []).length;
    expect(renderCompileHits).toBeLessThan(5);
    expect(validateCompileHits).toBeGreaterThan(10);
    // Validate path is the heavier of the two (schema graph + compile).
    expect(statSync(validateChunk).size).toBeGreaterThan(statSync(renderChunk).size);
    // Reference catalogs (GEOM_REFERENCE / SCALE_REFERENCE / …) are precomputed
    // plain data and must not force the validate chunk. Chart decode only needs
    // TypeBox compile templates out of the render body (asserted above).
  });

  it("keeps reference catalogs and the served JSON schema out of render code", () => {
    const render = readFileSync(renderChunk, "utf8");
    expect(render.includes("GEOM_REFERENCE_DATA")).toBe(false);
    expect(render.includes("SCALE_REFERENCE")).toBe(false);
    expect(render.includes("json-schema.org/draft/2020-12/schema")).toBe(false);
  });

  it("does not pull reference catalogs through shared capability tables", () => {
    for (const name of ["ggsvelte-core.js", "ggsvelte-spec.js", "ggsvelte-spec-validate.js"]) {
      const source = readFileSync(path.join(serverChunks, name), "utf8");
      expect(source.includes('from "./ggsvelte-spec-reference.js"'), name).toBe(false);
    }
  });

  it("keeps reference catalogs outside the client chart dependency graph", () => {
    const manifest = JSON.parse(
      readFileSync(
        path.join(root, "apps/docs/.svelte-kit/output/client/.vite/manifest.json"),
        "utf8",
      ),
    ) as Record<string, { name?: string; imports?: string[] }>;
    const reference = Object.keys(manifest).find(
      (key) => manifest[key]?.name === "ggsvelte-spec-reference",
    );
    expect(reference).toBeDefined();
    for (const name of [
      "ggsvelte-core",
      "ggsvelte-svelte",
      "ggsvelte-spec",
      "ggsvelte-spec-validate",
    ]) {
      const entry = Object.keys(manifest).find((key) => manifest[key]?.name === name);
      if (entry === undefined) throw new Error(`missing client chunk ${name}`);
      const seen = new Set<string>();
      const pending = [entry];
      while (pending.length > 0) {
        const key = pending.pop()!;
        if (seen.has(key)) continue;
        seen.add(key);
        pending.push(...(manifest[key]?.imports ?? []));
      }
      expect(seen.has(reference!), name).toBe(false);
    }
  });

  it("keeps the render chunk well under the pre-split ~1MB client bill", () => {
    const renderBytes = statSync(renderChunk).size;
    const validateBytes = statSync(validateChunk).size;
    // Pre-split client ggsvelte-spec was ~1.05MB; render should stay much smaller.
    expect(renderBytes).toBeLessThan(400_000);
    // Validate path still carries the schema graph (expected).
    expect(validateBytes).toBeGreaterThan(400_000);
  });
});
