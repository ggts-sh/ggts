/**
 * Unit tests for the manifest generator (plan: "the manifest generator has
 * its own unit tests"): stable ordering, collision detection, meta
 * validation, and byte-stable emission. Runs under `bun test scripts`.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

import type { DiscoveredExample } from "./gen-manifest.ts";
import {
  buildManifestSource,
  discoverExamples,
  findCollisions,
  ManifestError,
  sortExamples,
  validateMeta,
} from "./gen-manifest.ts";
import { buildReactBacklogMarkdown } from "./react-example-backlog.ts";

function example(overrides: Partial<DiscoveredExample>): DiscoveredExample {
  return {
    id: "cat/name",
    category: "cat",
    name: "name",
    title: "T",
    description: "D",
    tags: ["t"],
    docsSection: "S",
    hasData: false,
    hasReact: false,
    ...overrides,
  };
}

describe("meta validation", () => {
  test("accepts a complete meta", () => {
    expect(
      validateMeta(
        {
          title: "T",
          description: "D",
          tags: ["a"],
          docsSection: "S",
          vrHeight: 400,
        },
        "x/y",
      ),
    ).toEqual([]);
  });

  test("accepts and emits a complete interaction journey", () => {
    const journey = {
      pointer: "Move over a mark, then click to pin.",
      keyboard: "Focus the chart, use Arrow keys, then press Enter.",
      touch: "Tap a mark to pin it.",
      references: [
        { label: "Interactions guide", href: "/guide/interactions" },
        { label: "Upgrade guide", href: "/guide/upgrading" },
      ],
      svelteFirst: true,
      fullWidth: true,
    };
    expect(
      validateMeta(
        {
          title: "T",
          description: "D",
          tags: ["a"],
          docsSection: "S",
          journey,
        },
        "interaction/example",
      ),
    ).toEqual([]);

    const src = buildManifestSource([example({ journey })]);
    expect(src).toContain("readonly journey?: ExampleJourney;");
    expect(src).toContain('href: "/guide/interactions"');
    expect(src).toContain("svelteFirst: true");
    expect(src).toContain("fullWidth: true");
  });

  test("accepts layout-only journey and rejects empty modality strings / unsafe links", () => {
    const base = {
      title: "T",
      description: "D",
      tags: ["a"],
      docsSection: "S",
    };
    expect(
      validateMeta({ ...base, journey: { svelteFirst: true, fullWidth: true } }, "x/y"),
    ).toEqual([]);
    expect(
      validateMeta(
        { ...base, journey: { pointer: " ", svelteFirst: true, fullWidth: true } },
        "x/y",
      ).join("\n"),
    ).toContain("journey.pointer");
    expect(
      validateMeta(
        {
          ...base,
          journey: {
            pointer: "P",
            keyboard: "K",
            touch: "T",
            references: [{ label: "Bad", href: "https://example.com" }],
            svelteFirst: true,
            fullWidth: true,
          },
        },
        "x/y",
      ).join("\n"),
    ).toContain("root-relative");
  });

  test("rejects non-objects, missing fields, empty strings, bad tags, bad vrHeight, unknown keys", () => {
    expect(validateMeta(null, "x/y")).toHaveLength(1);
    expect(validateMeta([], "x/y")).toHaveLength(1);
    const missing = validateMeta({}, "x/y");
    expect(missing.join("\n")).toContain('"title"');
    expect(missing.join("\n")).not.toContain('"description"');
    expect(missing.join("\n")).toContain('"docsSection"');
    expect(missing.join("\n")).toContain('"tags"');
    expect(
      validateMeta({ title: " ", description: "D", tags: ["a"], docsSection: "S" }, "x/y"),
    ).toHaveLength(1);
    expect(
      validateMeta({ title: "T", description: "D", tags: [], docsSection: "S" }, "x/y"),
    ).toHaveLength(1);
    expect(
      validateMeta({ title: "T", description: "D", tags: [1], docsSection: "S" }, "x/y"),
    ).toHaveLength(1);
    // Empty / omitted description is allowed (delete-not-rewrite for page subtitles).
    expect(validateMeta({ title: "T", tags: ["a"], docsSection: "S" }, "x/y")).toHaveLength(0);
    expect(
      validateMeta({ title: "T", description: "", tags: ["a"], docsSection: "S" }, "x/y"),
    ).toHaveLength(0);
    expect(
      validateMeta({ title: "T", description: 1, tags: ["a"], docsSection: "S" }, "x/y"),
    ).toHaveLength(1);
    expect(
      validateMeta(
        {
          title: "T",
          description: "D",
          tags: ["a"],
          docsSection: "S",
          vrHeight: -1,
        },
        "x/y",
      ),
    ).toHaveLength(1);
    expect(
      validateMeta(
        {
          title: "T",
          description: "D",
          tags: ["a"],
          docsSection: "S",
          bogus: 1,
        },
        "x/y",
      ),
    ).toHaveLength(1);
  });
});

describe("ordering", () => {
  test("sorts by category then name, codepoint order, without mutating input", () => {
    const input = [
      example({ id: "line/z", category: "line", name: "z" }),
      example({ id: "bar/b", category: "bar", name: "b" }),
      example({ id: "bar/a", category: "bar", name: "a" }),
      example({ id: "area/x", category: "area", name: "x" }),
    ];
    const snapshot = [...input];
    const sorted = sortExamples(input);
    expect(sorted.map((e) => e.id)).toEqual(["area/x", "bar/a", "bar/b", "line/z"]);
    expect(input).toEqual(snapshot); // no mutation
  });

  test("emission is byte-stable across input permutations", () => {
    const a = example({ id: "bar/a", category: "bar", name: "a" });
    const b = example({ id: "area/x", category: "area", name: "x" });
    expect(buildManifestSource([a, b])).toBe(buildManifestSource([b, a]));
  });
});

describe("collision detection", () => {
  test("flags case-insensitive id collisions", () => {
    const collisions = findCollisions([
      example({ id: "bar/Stacked", category: "bar", name: "Stacked" }),
      example({ id: "bar/stacked", category: "bar", name: "stacked" }),
    ]);
    expect(collisions).toHaveLength(1);
    expect(collisions[0]).toContain("collision");
  });

  test("buildManifestSource throws ManifestError on collisions", () => {
    expect(() => buildManifestSource([example({ id: "a/B" }), example({ id: "A/b" })])).toThrow(
      ManifestError,
    );
  });

  test("distinct ids pass", () => {
    expect(findCollisions([example({ id: "a/b" }), example({ id: "a/c" })])).toEqual([]);
  });
});

describe("emission format", () => {
  test("includes vrHeight only when present and marks hasData and hasReact", () => {
    const src = buildManifestSource([
      example({
        id: "a/tall",
        category: "a",
        name: "tall",
        vrHeight: 520,
        hasData: true,
        hasReact: true,
      }),
      example({ id: "a/plain", category: "a", name: "plain" }),
    ]);
    expect(src).toContain("vrHeight: 520,");
    expect(src).toContain("hasData: true,");
    expect(src).toContain("hasData: false,");
    expect(src).toContain("hasReact: true,");
    expect(src).toContain("hasReact: false,");
    // exactly one entry-level vrHeight (the interface line is "vrHeight?:")
    expect(src.match(/vrHeight: /g) ?? []).toHaveLength(1);
    expect(src).toContain("GENERATED by scripts/gen-manifest.ts");
  });
});

describe("discovery against the real corpus", () => {
  test("the committed examples/ tree discovers cleanly and matches the committed manifest", async () => {
    const examplesDir = join(import.meta.dir, "..", "examples");
    const discovered = discoverExamples(examplesDir);
    expect(discovered.length).toBeGreaterThanOrEqual(14);
    const source = buildManifestSource(discovered);
    const committed = await Bun.file(join(examplesDir, "manifest.ts")).text();
    expect(committed).toBe(source); // staleness guard (mirrors manifest:check)
    const backlog = buildReactBacklogMarkdown(sortExamples(discovered));
    const committedBacklog = await Bun.file(join(examplesDir, "REACT.md")).text();
    expect(committedBacklog).toBe(backlog);
    expect(discovered.filter((ex) => ex.hasReact).map((ex) => ex.id)).toEqual(
      discovered
        .filter((ex) => existsSync(join(examplesDir, ex.id, "Example.tsx")))
        .map((ex) => ex.id),
    );
  });
});
