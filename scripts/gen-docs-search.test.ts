import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  createDocsSearchEntries,
  generateDocsSearchProjection,
  validateDocsSearchEntries,
  type DocsSearchEntry,
} from "./gen-docs-search.ts";

const generatedPath = join(
  import.meta.dir,
  "..",
  "apps",
  "docs",
  "src",
  "lib",
  "generated",
  "search-index.ts",
);

describe("generated Docs search index", () => {
  it("contains every approved source family with literal exact winners", () => {
    const entries = createDocsSearchEntries();
    expect(new Set(entries.map((entry) => entry.kind))).toEqual(
      new Set(["page", "heading", "example", "api", "diagnostic", "cli", "lifecycle"]),
    );
    expect(
      entries.find((entry) => entry.id === "diagnostic:validation:scale-scheme-type")?.href,
    ).toBe("/guide/errors#scale-scheme-type");
    expect(entries.find((entry) => entry.id === "api:ggts-sh-svelte:GGPlot")?.href).toBe(
      "/guide/lifecycle#ggts-sh-svelte",
    );
    expect(entries.find((entry) => entry.id === "cli:max-marks")?.href).toBe(
      "/reference/cli#max-marks",
    );
    expect(
      entries.find((entry) => entry.id === "heading:guide-scales-guides:date-and-time-axes")?.href,
    ).toBe("/guide/scales-guides#date-and-time-axes");
  });

  it("excludes aliases, performance fixtures, component loaders, and chart payloads", () => {
    const entries = createDocsSearchEntries();
    expect(entries.some((entry) => entry.href.includes("/examples/interactions/inspection"))).toBe(
      false,
    );
    expect(entries.some((entry) => entry.href.startsWith("/__perf/"))).toBe(false);
    const serialized = JSON.stringify(entries);
    expect(serialized).not.toContain("import.meta.glob");
    expect(serialized).not.toContain('"data":{"values"');
  });

  it("rejects duplicate IDs, duplicate href/title pairs, and private hrefs", () => {
    const entry: DocsSearchEntry = {
      id: "one",
      kind: "page",
      title: "One",
      summary: "A useful public result.",
      href: "/docs",
      keywords: [],
      exact: [],
    };
    expect(() => validateDocsSearchEntries([entry, entry])).toThrow("duplicate id");
    expect(() => validateDocsSearchEntries([entry, { ...entry, id: "two" }])).toThrow(
      "duplicate href/title",
    );
    expect(() => validateDocsSearchEntries([{ ...entry, href: "/__perf/private" }])).toThrow(
      "public",
    );
    expect(() => validateDocsSearchEntries([{ ...entry, href: "/guide/errors#not-real" }])).toThrow(
      "missing anchor",
    );
    expect(() =>
      validateDocsSearchEntries([{ ...entry, href: "/guide/errors#Bad Anchor" }]),
    ).toThrow("malformed anchor");
  });

  it("is current and contains only a serializable generated projection", async () => {
    const generated = await generateDocsSearchProjection(createDocsSearchEntries());
    expect(readFileSync(generatedPath, "utf8")).toBe(generated);
    expect(generated).not.toContain("node:");
    expect(generated).not.toContain("$scripts");
  });
});
