/**
 * Slim theme table: default + void resolve; named catalog themes do not.
 */
import { aes, gg } from "@ggts-sh/spec";
import { describe, expect, it } from "bun:test";

import { EDITION_DEFAULTS } from "../src/editions.ts";
import { EDITION_DEFAULTS_SLIM } from "../src/editions-slim.ts";
import { runPipeline as runPipelineHeadless } from "../src/pipeline/run-pipeline.ts";
import { runPipeline } from "../src/pipeline.ts";
import { SLIM_THEMES } from "../src/theme-slim.ts";
import { resolveTheme as resolveThemeAgainst, UnknownThemeError } from "../src/theme-resolve.ts";
import { BUILTIN_THEMES, resolveTheme } from "../src/theme.ts";

const size = { width: 240, height: 160 };
const rows = [
  { x: 1, y: 2 },
  { x: 2, y: 3 },
];

describe("slim theme resolve", () => {
  it("resolves default and void from the slim table", () => {
    expect(resolveThemeAgainst(undefined, SLIM_THEMES)).toBe(SLIM_THEMES.default);
    expect(resolveThemeAgainst("void", SLIM_THEMES)).toBe(SLIM_THEMES.void);
    expect(resolveThemeAgainst("void", SLIM_THEMES).labelsX).toBe(false);
  });

  it("throws UnknownThemeError for a named catalog theme on the slim table", () => {
    expect(() => resolveThemeAgainst("dark", SLIM_THEMES)).toThrow(UnknownThemeError);
  });

  it("resolves an object theme over void without the catalog", () => {
    const tokens = resolveThemeAgainst({ name: "void", ink: "#111111" }, SLIM_THEMES);
    expect(tokens.ink).toBe("#111111");
    expect(tokens.paper).toBe("none");
  });

  it("public resolveTheme still resolves named catalog themes", () => {
    expect(resolveTheme("dark")).toBe(BUILTIN_THEMES.dark);
    expect(resolveTheme("void")).toBe(BUILTIN_THEMES.void);
  });
});

describe("headless vs full runPipeline theme tables", () => {
  it("headless runPipeline accepts void and default", () => {
    const spec = gg(rows, aes({ x: "x", y: "y" }))
      .geomPoint()
      .theme("void")
      .spec();
    const model = runPipelineHeadless(spec, size);
    expect(model.scene.theme.paper).toBe("none");
  });

  it("headless runPipeline rejects named catalog themes", () => {
    const spec = gg(rows, aes({ x: "x", y: "y" }))
      .geomPoint()
      .theme("dark")
      .spec();
    expect(() => runPipelineHeadless(spec, size)).toThrow(/unknown-theme|Unknown theme/);
  });

  it("headless accepts a named theme when the full editions table is passed", () => {
    const spec = gg(rows, aes({ x: "x", y: "y" }))
      .geomPoint()
      .theme("dark")
      .spec();
    const model = runPipelineHeadless(spec, { ...size, editions: EDITION_DEFAULTS });
    expect(model.scene.theme.paper).toBe("#16181d");
  });

  it("full-barrel runPipeline resolves a named theme with no editions option", () => {
    const spec = gg(rows, aes({ x: "x", y: "y" }))
      .geomPoint()
      .theme("dark")
      .spec();
    const model = runPipeline(spec, size);
    expect(model.scene.theme.paper).toBe("#16181d");
  });

  it("slim edition-2 table has default and void only", () => {
    const names = Object.keys(EDITION_DEFAULTS_SLIM[2]!.themes).toSorted();
    expect(names).toEqual(["default", "void"]);
  });
});
