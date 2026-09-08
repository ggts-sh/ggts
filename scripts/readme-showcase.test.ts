import { describe, expect, it } from "bun:test";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const readme = readFileSync(join(root, "README.md"), "utf8");
const svelteReadme = readFileSync(join(root, "packages/svelte/README.md"), "utf8");

describe("README front door", () => {
  it("stays short: no embedded gallery examples or theme image grid", () => {
    // Full examples and theme previews live on ggsvelte.sh. Copying them into
    // the root README drifts from the API and is a liability — link out only.
    expect(readme).not.toContain("## Examples");
    expect(readme).not.toContain("## Themes");
    expect(readme).not.toContain("<!-- example-source:");
    expect(readme).not.toContain("apps/docs/static/previews/");
    expect(readme).not.toContain("artifacts/theme-equivalence/");
    expect(readme).toContain("https://ggsvelte.sh/examples");
    expect(readme).toContain("https://ggsvelte.sh/themes");
  });

  it("starts with a runnable JSON and CLI sandbox workflow", () => {
    const fenceLanguages = [...readme.matchAll(/^```([^\n]*)$/gm)].map(([, language]) => language);

    expect(
      fenceLanguages.every(
        (language) => language === "" || language === "sh" || language === "json",
      ),
    ).toBe(true);
    expect(readme).not.toContain("```ts");
    expect(readme).toContain("```json");
    expect(readme).toContain("ggts check chart.json");
    expect(readme).toContain("ggts render chart.json");
    expect(readme).not.toContain("```svelte");
    expect(readme).not.toContain("https://ljodea.github.io/ggsvelte");
  });

  it("keeps the primary package README on the Svelte component path", () => {
    const fenceLanguages = [...svelteReadme.matchAll(/^```([^\n]*)$/gm)].map(
      ([, language]) => language,
    );

    expect(
      fenceLanguages.every(
        (language) => language === "" || language === "svelte" || language === "sh",
      ),
    ).toBe(true);
    expect(svelteReadme).toContain('from "@ggsvelte/svelte"');
    expect(svelteReadme).toContain("<GGPlot");
    expect(svelteReadme).not.toContain("const spec =");
    expect(svelteReadme).not.toContain("const built =");
    expect(svelteReadme).not.toContain("```ts");
    expect(svelteReadme).not.toContain("createPlotInteraction");
    expect(svelteReadme).not.toContain("interactionScope");
  });
});
