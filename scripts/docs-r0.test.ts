import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { EXAMPLE_ALIASES, resolveExampleId } from "../apps/docs/src/lib/example-aliases.ts";

describe("R0 documentation journeys", () => {
  it("keeps canonical interaction routes as aliases of the existing stable pages", () => {
    expect(EXAMPLE_ALIASES).toEqual({
      "interactions/inspection": "interaction/tooltip",
      "interactions/interval-selection": "interaction/brush-zoom",
    });
    expect(resolveExampleId("interactions/inspection")).toBe("interaction/tooltip");
    expect(resolveExampleId("interaction/tooltip")).toBe("interaction/tooltip");
  });

  it("renders source, then tags, then secondary references", () => {
    const page = readFileSync(
      join(
        import.meta.dir,
        "..",
        "apps",
        "docs",
        "src",
        "routes",
        "examples",
        "[category]",
        "[name]",
        "+page.svelte",
      ),
      "utf8",
    );
    expect(page).not.toContain("REACT_SPEC_HOST_SOURCE");
    const source = page.indexOf("<CodeTabs {tabs} />");
    const tags = page.indexOf('<p class="tags">');
    const references = page.indexOf('<nav class="references"');
    expect(source).toBeGreaterThan(0);
    expect(source).toBeLessThan(tags);
    expect(tags).toBeLessThan(references);
  });
});
