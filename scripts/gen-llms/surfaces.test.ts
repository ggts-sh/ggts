/**
 * The llms.txt / llms-full.txt builders, exercised with the real manifest —
 * zero-manual-upkeep proof: every example the manifest knows appears, and the
 * release facts come from the code, not hand-edited prose.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { EXAMPLES } from "../../examples/manifest.ts";
import { buildLlmsFull, buildLlmsIndex, guidePages, type LifecycleDoc } from "../gen-llms.ts";

const lifecycle = JSON.parse(
  readFileSync(join(import.meta.dir, "..", "..", "lifecycle.json"), "utf8"),
) as LifecycleDoc;

describe("llms surfaces", () => {
  const pages = guidePages(lifecycle);

  it("publishes absolute canonical links and implementation-derived release facts", () => {
    const txt = buildLlmsIndex(pages.slice(0, 1), EXAMPLES.slice(0, 1), {
      canonicalBase: "https://ggts.sh",
      packageVersion: "0.4.0",
      currentEdition: 2,
      themeNames: ["light", "dark"],
    });

    expect(txt).toContain("Package version: 0.4.0");
    expect(txt).toContain("Defaults edition: 2");
    expect(txt).toContain("Registered chart themes (2): light, dark");
    expect(txt).toContain("(https://ggts.sh/guide/agents)");
    expect(txt).toContain("(https://ggts.sh/examples/");
    expect(txt).not.toMatch(/\]\(\//);
  });

  it("llms.txt lists every guide page and every manifest example", () => {
    const txt = buildLlmsIndex(pages, EXAMPLES);
    expect(txt.startsWith("# ggts\n")).toBe(true);
    for (const page of pages) expect(txt).toContain(`(https://ggts.sh/guide/${page.slug})`);
    expect(txt).toContain("(https://ggts.sh/schema/v0.json)");
    expect(txt).not.toContain("(https://ggts.sh/playground)");
    expect(txt).toContain("(https://ggts.sh/reference/interactions)");
    for (const ex of EXAMPLES) {
      expect(txt).toContain(`(https://ggts.sh/examples/${ex.id})`);
    }
    expect(pages.map((page) => page.slug)).toContain("interactions");
    expect(pages.map((page) => page.slug)).toContain("interaction-reference");
    expect(pages.map((page) => page.slug)).not.toContain("migrating-pre-0-1");
    expect(pages.map((page) => page.slug)).toContain("upgrading");
    expect(pages.map((page) => page.slug)).toContain("production");
    expect(pages.map((page) => page.slug)).not.toContain("compatibility");
    expect(pages.map((page) => page.slug)).not.toContain("themes-color");
    expect(pages.map((page) => page.slug)).not.toContain("data-mappings");
  });

  it("keeps first-party interaction examples focused on the current API", () => {
    const inspection = EXAMPLES.find((example) => example.id === "interaction/tooltip");
    const selection = EXAMPLES.find((example) => example.id === "interaction/brush-zoom");
    const linked = EXAMPLES.find((example) => example.id === "interaction/linked-views");
    expect(inspection?.title).toBe("Inspect and pin data");
    expect(inspection?.tags).toContain("inspect");
    // #1010: every shipped example carries a written gallery description. The
    // rule this replaces was "deleted, not rewritten" — which was right about
    // AI slop and wrong as a permanent state.
    expect(inspection?.description.length).toBeGreaterThan(0);
    expect(selection?.title).toBe("Interval selection and zoom");
    expect(selection?.tags).toContain("select");
    expect(linked?.title).toBe("Link plots, controls, and a table");
    expect(linked?.tags).toContain("controller");
    expect(linked?.tags).toContain("linked-views");
  });

  it("llms-full.txt carries the same canonical origin and release facts", () => {
    const txt = buildLlmsFull(
      [
        {
          slug: "start",
          title: "Start",
          description: "Start here.",
          markdown:
            '# Start\n\n[Errors](/guide/errors)\n\n[Legacy](https://ljodea.github.io/ggsvelte/guide/errors)\n\n```ts fragment\nconst preserved = "https://ljodea.github.io/ggsvelte/guide/errors";\n```',
        },
      ],
      [],
      {
        canonicalBase: "https://preview.example",
        packageVersion: "0.4.0",
        currentEdition: 2,
        themeNames: ["light", "dark"],
      },
    );

    expect(txt).toContain("Package version: 0.4.0");
    expect(txt).toContain("Defaults edition: 2");
    expect(txt).toContain("Registered chart themes (2): light, dark");
    expect(txt).toContain("[Errors](https://preview.example/guide/errors)");
    expect(txt).toContain("[Legacy](https://preview.example/guide/errors)");
    expect(txt).not.toContain("[Legacy](https://ljodea.github.io/ggsvelte");
    expect(txt).toContain('const preserved = "https://ljodea.github.io/ggsvelte/guide/errors";');
    expect(txt).not.toMatch(/\]\(\//);
  });

  it("llms-full.txt embeds guide prose + valid spec JSON + React and Svelte source per example", () => {
    const examples = EXAMPLES.slice(0, 2).map((e) => ({
      ...e,
      specJSON: `{\n  "marker": "spec-${e.id}"\n}`,
      svelteSource: `<!-- svelte-${e.id} -->`,
      reactSource: `// react-${e.id}`,
      prunedRows: 10,
    }));
    const txt = buildLlmsFull(pages, examples);
    const exampleText = txt.slice(txt.indexOf("# Examples\n"));
    const specs = [...exampleText.matchAll(/```json\n([\s\S]*?)\n```/g)].map((match): unknown =>
      JSON.parse(match[1]!),
    );
    expect(specs).toEqual(examples.map((ex) => ({ marker: `spec-${ex.id}` })));
    for (const page of pages) expect(txt).toContain(page.markdown.trim().split("\n")[0]!);
    for (const ex of examples) {
      expect(txt).toContain(`## ${ex.title} (${ex.id})`);
      expect(txt).toContain(`spec-${ex.id}`);
      expect(txt).toContain(`svelte-${ex.id}`);
      expect(txt).toContain(`react-${ex.id}`);
      expect(txt).toContain("Data sample: 10 rows omitted.");
    }
  });
});
