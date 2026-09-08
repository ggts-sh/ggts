import { describe, expect, test } from "bun:test";
import { assertRecipeImports } from "./consumer-compat-skill.ts";

describe("documented recipe dependencies", () => {
  test("accepts the installed adapter and declared data subpath", () => {
    assertRecipeImports(
      'import { GGPlot } from "@ggts-sh/react";\nimport { mpg } from "@ggts-sh/core/data";',
      ["@ggts-sh/react", "@ggts-sh/core"],
      "React data recipe",
    );
  });

  test("rejects imports that broader consumer fixture dependencies could mask", () => {
    for (const source of [
      'import type { PortableSpec } from "@ggts-sh/spec";',
      'import "@ggts-sh/core/temporal";',
      'const data = await import("@ggts-sh/core/data");',
    ]) {
      expect(() => {
        assertRecipeImports(source, ["@ggts-sh/react"], "React quickstart");
      }).toThrow("install recipe does not declare");
    }
  });
});
