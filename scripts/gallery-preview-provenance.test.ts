import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  PROVENANCE_VERSION,
  assertPreviewProvenance,
  emptyProvenance,
  exampleSourceDigest,
  listSourceFiles,
  loadProvenance,
  packageDataSourcePaths,
  provenanceEntryFor,
  provenancePath,
  pruneProvenanceToIds,
  serializeProvenance,
  sharedExampleSourcePaths,
  upsertProvenanceEntry,
  writeProvenance,
} from "./gallery-preview-provenance.js";
import { canonicalPreviewFilename } from "./gen-gallery-previews.js";

function writeExample(examplesRoot: string, id: string, files: Record<string, string>): void {
  const dir = join(examplesRoot, ...id.split("/"));
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), body);
  }
}

describe("exampleSourceDigest", () => {
  test("is stable for identical trees and changes when any source file mutates", () => {
    const root = mkdtempSync(join(tmpdir(), "ggsvelte-prov-digest-"));
    try {
      writeExample(root, "point/scatter", {
        "Example.svelte": "<script></script>",
        "spec.ts": "export default {}",
        "meta.json": '{"title":"a"}',
        "data.ts": "export const rows = []",
      });
      const a = exampleSourceDigest(root, "point/scatter");
      const b = exampleSourceDigest(root, "point/scatter");
      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]{64}$/);

      writeFileSync(join(root, "point/scatter/Example.svelte"), "<script>/* changed */</script>");
      expect(exampleSourceDigest(root, "point/scatter")).not.toBe(a);

      writeExample(root, "point/scatter", {
        "Example.svelte": "<script></script>",
        "spec.ts": "export default { changed: true }",
        "meta.json": '{"title":"a"}',
        "data.ts": "export const rows = []",
      });
      // Reset Example, mutate spec
      writeFileSync(join(root, "point/scatter/Example.svelte"), "<script></script>");
      writeFileSync(join(root, "point/scatter/spec.ts"), "export default { changed: true }");
      expect(exampleSourceDigest(root, "point/scatter")).not.toBe(a);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("hashes the whole directory including nested helpers, not a four-file allowlist", () => {
    const root = mkdtempSync(join(tmpdir(), "ggsvelte-prov-tree-"));
    try {
      writeExample(root, "demo/x", {
        "Example.svelte": "import './helper.js'",
        "spec.ts": "export default {}",
        "meta.json": "{}",
        "helper.ts": "export const k = 1",
      });
      const before = exampleSourceDigest(root, "demo/x");
      writeFileSync(join(root, "demo/x/helper.ts"), "export const k = 2");
      expect(exampleSourceDigest(root, "demo/x")).not.toBe(before);
      expect(listSourceFiles(join(root, "demo/x"))).toEqual([
        "Example.svelte",
        "helper.ts",
        "meta.json",
        "spec.ts",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("includes shared examples/rng when data.ts imports it, excludes define", () => {
    const root = mkdtempSync(join(tmpdir(), "ggsvelte-prov-shared-"));
    try {
      writeFileSync(join(root, "rng.ts"), "export function mulberry32() {}");
      writeFileSync(join(root, "define.ts"), "export function defineExample() {}");
      writeExample(root, "point/canvas", {
        "Example.svelte": "x",
        "spec.ts": 'import { defineExample } from "../../define.js";\nexport default {}',
        "meta.json": "{}",
        "data.ts": 'import { mulberry32 } from "../../rng.js";\nexport const rows = []',
      });
      expect(sharedExampleSourcePaths(join(root, "point/canvas"), root)).toEqual(["rng.ts"]);
      const before = exampleSourceDigest(root, "point/canvas");
      writeFileSync(join(root, "rng.ts"), "export function mulberry32() { return 1 }");
      expect(exampleSourceDigest(root, "point/canvas")).not.toBe(before);
      writeFileSync(join(root, "define.ts"), "export function defineExample() { /* v2 */ }");
      // define still excluded — digest matches after rng restore
      writeFileSync(join(root, "rng.ts"), "export function mulberry32() {}");
      expect(exampleSourceDigest(root, "point/canvas")).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("hashes packages/svelte teaching-data imports so package edits invalidate previews (#1359)", () => {
    // Monorepo layout: <tmp>/examples + <tmp>/packages/core/src/data
    const monorepo = mkdtempSync(join(tmpdir(), "ggsvelte-prov-pkg-"));
    const examples = join(monorepo, "examples");
    const dataDir = join(monorepo, "packages/core/src/data");
    mkdirSync(dataDir, { recursive: true });
    try {
      writeFileSync(join(dataDir, "chocolate-bars.ts"), "export const chocolateBars = [{ n: 1 }]");
      writeExample(examples, "smooth/loess", {
        "Example.svelte": "x",
        "spec.ts": "export default {}",
        "meta.json": "{}",
        "data.ts":
          'import { chocolateBars } from "../../../packages/core/src/data/chocolate-bars.js";\nexport const sample = chocolateBars',
      });
      expect(packageDataSourcePaths(join(examples, "smooth/loess"), examples)).toEqual([
        "packages/core/src/data/chocolate-bars.ts",
      ]);
      const before = exampleSourceDigest(examples, "smooth/loess");
      writeFileSync(join(dataDir, "chocolate-bars.ts"), "export const chocolateBars = [{ n: 2 }]");
      expect(exampleSourceDigest(examples, "smooth/loess")).not.toBe(before);
    } finally {
      rmSync(monorepo, { recursive: true, force: true });
    }
  });
});

describe("assertPreviewProvenance", () => {
  test("passes when source and png digests match; aggregates multiple drifts", () => {
    const root = mkdtempSync(join(tmpdir(), "ggsvelte-prov-assert-"));
    const examples = join(root, "examples");
    const previews = join(root, "previews");
    mkdirSync(previews, { recursive: true });
    try {
      for (const id of ["a/one", "b/two"] as const) {
        writeExample(examples, id, {
          "Example.svelte": id,
          "spec.ts": id,
          "meta.json": "{}",
        });
        writeFileSync(join(previews, canonicalPreviewFilename(id)), `png-bytes-${id}`);
      }
      const entries = [
        {
          id: "a/one",
          category: "a",
          name: "one",
          title: "",
          description: "",
          tags: [],
          docsSection: "",
          hasData: false,
        },
        {
          id: "b/two",
          category: "b",
          name: "two",
          title: "",
          description: "",
          tags: [],
          docsSection: "",
          hasData: false,
        },
      ] as const;
      let provenance = emptyProvenance();
      for (const entry of entries) {
        provenance = upsertProvenanceEntry(
          provenance,
          entry.id,
          provenanceEntryFor(examples, previews, entry.id),
        );
      }
      expect(() => {
        assertPreviewProvenance({
          examplesRoot: examples,
          previewsDir: previews,
          entries,
          provenance,
        });
      }).not.toThrow();

      // Mutate both sources — single error must name both ids
      writeFileSync(join(examples, "a/one/Example.svelte"), "stale-a");
      writeFileSync(join(examples, "b/two/spec.ts"), "stale-b");
      let error: unknown;
      try {
        assertPreviewProvenance({
          examplesRoot: examples,
          previewsDir: previews,
          entries,
          provenance,
        });
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(Error);
      if (!(error instanceof Error)) throw new Error("expected Error");
      expect(error.message).toContain("a/one");
      expect(error.message).toContain("b/two");
      expect(error.message).toContain("source files changed");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("fails when png bytes diverge from recorded pngSha256", () => {
    const root = mkdtempSync(join(tmpdir(), "ggsvelte-prov-png-"));
    const examples = join(root, "examples");
    const previews = join(root, "previews");
    mkdirSync(previews, { recursive: true });
    try {
      writeExample(examples, "x/y", {
        "Example.svelte": "e",
        "spec.ts": "s",
        "meta.json": "{}",
      });
      const filename = canonicalPreviewFilename("x/y");
      writeFileSync(join(previews, filename), "png-v1");
      const entry = provenanceEntryFor(examples, previews, "x/y");
      writeFileSync(join(previews, filename), "png-v2");
      let error: unknown;
      try {
        assertPreviewProvenance({
          examplesRoot: examples,
          previewsDir: previews,
          entries: [
            {
              id: "x/y",
              category: "x",
              name: "y",
              title: "",
              description: "",
              tags: [],
              docsSection: "",
              hasData: false,
            },
          ],
          provenance: upsertProvenanceEntry(emptyProvenance(), "x/y", entry),
        });
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(Error);
      if (!(error instanceof Error)) throw new Error("expected Error");
      expect(error.message).toContain("x/y");
      expect(error.message).toContain("PNG bytes");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("rejects missing/unknown version and incomplete closed set", () => {
    const path = join(mkdtempSync(join(tmpdir(), "ggsvelte-prov-load-")), "provenance.json");
    try {
      writeFileSync(path, JSON.stringify({ version: 99, entries: {} }));
      expect(() => loadProvenance(path)).toThrow(/version/);
      writeFileSync(
        path,
        serializeProvenance(
          upsertProvenanceEntry(emptyProvenance(), "orphan/id", {
            filename: "orphan-id-light.png",
            sourceSha256: "a".repeat(64),
            pngSha256: "b".repeat(64),
          }),
        ),
      );
      const provenance = loadProvenance(path);
      expect(provenance.version).toBe(PROVENANCE_VERSION);
      expect(() => {
        assertPreviewProvenance({
          examplesRoot: join(path, "..", "examples"),
          previewsDir: join(path, ".."),
          entries: [],
          provenance,
        });
      }).toThrow(/orphan\/id/);
    } finally {
      rmSync(dirnameSafe(path), { recursive: true, force: true });
    }
  });
});

describe("pruneProvenanceToIds", () => {
  test("drops deleted example ids without rewriting remaining digests", () => {
    let p = emptyProvenance();
    p = upsertProvenanceEntry(p, "keep/me", {
      filename: "keep-me-light.png",
      sourceSha256: "a".repeat(64),
      pngSha256: "b".repeat(64),
    });
    p = upsertProvenanceEntry(p, "gone/example", {
      filename: "gone-example-light.png",
      sourceSha256: "c".repeat(64),
      pngSha256: "d".repeat(64),
    });
    const pruned = pruneProvenanceToIds(p, new Set(["keep/me"]));
    expect(pruned.entries["gone/example"]).toBeUndefined();
    expect(pruned.entries["keep/me"]?.sourceSha256).toBe("a".repeat(64));
    expect(pruned.entries["keep/me"]?.pngSha256).toBe("b".repeat(64));
  });
});

describe("upsertProvenanceEntry merge", () => {
  test("updates one id without clobbering others", () => {
    let p = emptyProvenance();
    p = upsertProvenanceEntry(p, "a/one", {
      filename: "a-one-light.png",
      sourceSha256: "1".repeat(64),
      pngSha256: "2".repeat(64),
    });
    p = upsertProvenanceEntry(p, "b/two", {
      filename: "b-two-light.png",
      sourceSha256: "3".repeat(64),
      pngSha256: "4".repeat(64),
    });
    p = upsertProvenanceEntry(p, "a/one", {
      filename: "a-one-light.png",
      sourceSha256: "5".repeat(64),
      pngSha256: "6".repeat(64),
    });
    expect(p.entries["b/two"]?.sourceSha256).toBe("3".repeat(64));
    expect(p.entries["a/one"]?.sourceSha256).toBe("5".repeat(64));
    const path = join(mkdtempSync(join(tmpdir(), "ggsvelte-prov-write-")), "provenance.json");
    try {
      writeProvenance(path, p);
      expect(provenancePath(join(path, ".."))).toBe(path);
      const reloaded = loadProvenance(path);
      expect(reloaded.entries["a/one"]?.pngSha256).toBe("6".repeat(64));
      expect(readFileSync(path, "utf8").endsWith("\n")).toBe(true);
    } finally {
      rmSync(dirnameSafe(path), { recursive: true, force: true });
    }
  });
});

function dirnameSafe(path: string): string {
  return join(path, "..");
}
