/**
 * Opt-in registration footguns. New register* / install* surfaces that fail at
 * render when omitted must appear in SKILL.md Registration so agents do not
 * ship "not registered in this build" charts.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  GEOM_REGISTER_HINTS,
  STAT_REGISTER_HINTS,
} from "../../packages/core/src/pipeline/register-hints.ts";
import { ROOT, SKILL_DIR } from "./test-helpers.ts";

describe("skill teaches the opt-in registration contract", () => {
  const skill = readFileSync(join(SKILL_DIR, "SKILL.md"), "utf8");
  const registration = readFileSync(join(SKILL_DIR, "references", "registration.md"), "utf8");
  const section = registration.match(/## Registration \(call these\)[\s\S]*?(?=\n## |$)/)?.[0];
  const scales = readFileSync(join(SKILL_DIR, "references", "scales-and-palettes.md"), "utf8");
  const themes = readFileSync(join(SKILL_DIR, "references", "themes.md"), "utf8");
  const geoms = readFileSync(join(SKILL_DIR, "references", "geoms-and-stats.md"), "utf8");

  it("SKILL.md has a Registration section agents see without opening references", () => {
    expect(section).toBeDefined();
    expect(skill).toContain("## Registration (call these)");
    expect(skill).toContain("references/registration.md");
  });

  it("defaults spec-driven surfaces to registerAll() and names the loud failure", () => {
    expect(section).toBeDefined();
    expect(section!).toMatch(/registerAll\(\)/);
    expect(section!).toMatch(/not registered in this build/);
    expect(section!).toMatch(/ggts render/);
    expect(section!).toMatch(/full grammar/);
  });

  it("names every public geom/stat register family from the hint maps", () => {
    expect(section).toBeDefined();
    const families = [
      ...new Set([...Object.values(STAT_REGISTER_HINTS), ...Object.values(GEOM_REGISTER_HINTS)]),
    ].toSorted();
    const missing = families.filter((name) => !section!.includes(`${name}()`));
    expect(missing).toEqual([]);
  });

  it("names every lean headless register export plus Temporal / umbrella calls", () => {
    expect(section).toBeDefined();
    const headless = readFileSync(
      join(ROOT, "packages", "core", "src", "headless-register-entry.ts"),
      "utf8",
    );
    const headlessRegisters = [...headless.matchAll(/export \{ (\w+) \}/g)]
      .map((match) => match[1]!)
      .filter(
        (name) =>
          name.startsWith("register") &&
          name !== "registerGeomBatch" &&
          name !== "registerStatFrame",
      );
    const extras = [
      "registerAll",
      "registerBasic",
      "installTemporal",
      "installCandidates",
      ...headlessRegisters,
    ];
    const missing = extras.filter((name) => !section!.includes(`${name}()`));
    expect(missing).toEqual([]);
    expect(section!).toContain("@ggsvelte/core/headless/register");
  });

  it("splits categorical vs sequential named-scheme registration", () => {
    expect(section).toBeDefined();
    expect(section!).toMatch(/registerDefaultOrdinalColor\(\)/);
    expect(section!).toMatch(/categorical[\s\S]*registerOrdinalColor\(\)/i);
    expect(section!).toMatch(/sequential[\s\S]*registerSequentialColor\(\)/i);
    expect(section!).toMatch(/infers sequential/);
  });

  it("teaches spec-driven Temporal without a scale child", () => {
    expect(section).toBeDefined();
    expect(section!).toMatch(/installTemporal\(\)/);
    expect(section!).toMatch(/no Temporal child|have no Temporal child/);
    expect(section!).toMatch(/type: "time"/);
  });

  it("teaches that headless named themes are not a register call", () => {
    expect(section).toBeDefined();
    expect(section!).toMatch(/Named themes/);
    expect(section!).toMatch(/`default` and `void`/);
    expect(section!).toMatch(/@ggsvelte\/core\/headless/);
  });

  it("references restate the family that belongs on that page", () => {
    expect(geoms).toMatch(/registerAll\(\)/);
    expect(geoms).toMatch(/registerBasicPoints\(\)/);
    expect(scales).toMatch(/registerDefaultOrdinalColor\(\)/);
    expect(scales).toMatch(/registerOrdinalColor\(\)/);
    expect(scales).toMatch(/registerNumericStyle\(\)/);
    expect(scales).toMatch(/registerBandGuide\(\)/);
    expect(scales).toMatch(/installTemporal\(\)/);
    expect(themes).toMatch(/@ggsvelte\/core\/headless/);
    expect(themes).toMatch(/`default`[\s\S]*`void`|only `default` and `void`/);
  });
});
