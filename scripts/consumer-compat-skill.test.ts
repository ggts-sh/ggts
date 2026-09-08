import { describe, expect, test } from "bun:test";
import { assertRecipeImports } from "./consumer-compat-skill.ts";

describe("documented recipe dependencies", () => {
  test("accepts the installed adapter and declared data subpath", () => {
    assertRecipeImports(
      'import { GGPlot } from "@ggsvelte/react";\nimport { mpg } from "@ggsvelte/core/data";',
      ["@ggsvelte/react", "@ggsvelte/core"],
      "React data recipe",
    );
  });

  test("rejects imports that broader consumer fixture dependencies could mask", () => {
    for (const source of [
      'import type { PortableSpec } from "@ggsvelte/spec";',
      'import "@ggsvelte/core/temporal";',
      'const data = await import("@ggsvelte/core/data");',
    ]) {
      expect(() => {
        assertRecipeImports(source, ["@ggsvelte/react"], "React quickstart");
      }).toThrow("install recipe does not declare");
    }
  });
});
