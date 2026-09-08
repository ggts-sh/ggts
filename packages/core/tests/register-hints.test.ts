/**
 * Error-hint contract for "not registered in this build" messages (#1420
 * follow-up): when a specialty stat/geom is missing, the error must name
 * the precise family register function (`registerSummary()`, …) — not just
 * registerAll/registerBasic — because that is the minimal fix for a svelte
 * app user, and registerBasic() never covers specialty stats/geoms.
 *
 * The hint maps in src/pipeline/register-hints.ts are pure strings (the
 * lean render graph must not import the registration modules); the drift
 * guards here keep them in sync with the register-*.ts family modules and
 * the core barrel's actual exports.
 */
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import * as coreBarrel from "../src/index.js";
import {
  GEOM_REGISTER_HINTS,
  geomRegisterHint,
  STAT_REGISTER_HINTS,
  statRegisterHint,
} from "../src/pipeline/register-hints.js";

describe("register hints: lookup", () => {
  it("maps specialty stats to their family register function", () => {
    expect(statRegisterHint("summary")).toBe("registerSummary");
    expect(statRegisterHint("summary_bin")).toBe("registerSummaryBin");
    expect(statRegisterHint("ecdf")).toBe("registerEcdf");
    expect(statRegisterHint("manual")).toBe("registerManual");
    // Non-obvious families: the hint names the FUNCTION, not the stat.
    expect(statRegisterHint("bin_hex")).toBe("registerHex");
    expect(statRegisterHint("ydensity")).toBe("registerViolin");
    expect(statRegisterHint("bindot")).toBe("registerDotplot");
    expect(statRegisterHint("sf_coordinates")).toBe("registerSfText");
  });

  it("maps specialty geoms to their family register function", () => {
    expect(geomRegisterHint("violin")).toBe("registerViolin");
    expect(geomRegisterHint("hex")).toBe("registerHex");
    expect(geomRegisterHint("errorbar")).toBe("registerErrorbar");
    expect(geomRegisterHint("smooth")).toBe("registerSmooth");
  });

  it("maps basic-tier names to granular headless families", () => {
    expect(statRegisterHint("count")).toBe("registerBasicPoints");
    expect(statRegisterHint("sum")).toBe("registerBasicBars");
    expect(geomRegisterHint("bar")).toBe("registerBasicBars");
    expect(geomRegisterHint("point")).toBe("registerBasicPoints");
  });
});

describe("register hints: drift guards", () => {
  it("every hint names a real exported function on the core barrel", () => {
    const names = new Set([
      ...Object.values(STAT_REGISTER_HINTS),
      ...Object.values(GEOM_REGISTER_HINTS),
    ]);
    expect(names.size).toBeGreaterThanOrEqual(38);
    for (const fn of names) {
      expect(
        typeof (coreBarrel as Record<string, unknown>)[fn],
        `${fn} must be exported from @ggts-sh/core`,
      ).toBe("function");
    }
  });

  it("every stat/geom registered by a register-*.ts family module has a hint", () => {
    const pipelineDir = path.resolve(import.meta.dir, "..", "src", "pipeline");
    const missing: string[] = [];
    for (const file of readdirSync(pipelineDir)) {
      if (!/^register-[a-z0-9-]+\.ts$/.test(file)) continue;
      const src = readFileSync(path.join(pipelineDir, file), "utf8");
      for (const match of src.matchAll(/registerStatFrame\("([a-z_0-9]+)"/g)) {
        if (!(match[1] in STAT_REGISTER_HINTS)) missing.push(`${file}: stat "${match[1]}"`);
      }
      for (const match of src.matchAll(/registerGeomBatch\("([a-z_0-9]+)"/g)) {
        if (!(match[1] in GEOM_REGISTER_HINTS)) missing.push(`${file}: geom "${match[1]}"`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("register hints: error messages (fresh process)", () => {
  it("missing-registration errors name the family register function", () => {
    const coreRoot = path.resolve(import.meta.dir, "..");
    const script = `
      import { renderToSVGString } from ${JSON.stringify(path.join(coreRoot, "src", "index.ts"))};
      import { registerBandGuide } from ${JSON.stringify(path.join(coreRoot, "src", "layout", "register-band-guide.ts"))};
      registerBandGuide();

      const rows = [
        { x: 1, y: 10 }, { x: 2, y: 20 }, { x: 3, y: 15 }, { x: 4, y: 25 }, { x: 5, y: 22 },
      ];
      const spec = (layer) => ({
        data: { values: rows },
        aes: { x: { field: "x" }, y: { field: "y" } },
        layers: [layer],
      });
      const attempt = (layer) => {
        try {
          renderToSVGString(spec(layer), { width: 400, height: 300 });
          return "rendered";
        } catch (err) {
          return String(err instanceof Error ? err.message : err);
        }
      };

      console.log(JSON.stringify({
        summaryStat: attempt({ geom: "point", stat: "summary" }),
        summaryBinStat: attempt({ geom: "point", stat: "summary_bin" }),
        violinStat: attempt({ geom: "violin" }),
        dotplotStat: attempt({ geom: "dotplot", aes: { y: null } }),
        hexStat: attempt({ geom: "hex" }),
        sfTextStat: attempt({ geom: "sf_text", aes: { label: { field: "y" } } }),
        polygonGeom: attempt({ geom: "polygon" }),
        colGeom: attempt({ geom: "col" }),
        countStat: attempt({ geom: "bar", aes: { y: null } }),
      }));
    `;
    const proc = spawnSync(process.execPath, ["-e", script], {
      cwd: coreRoot,
      encoding: "utf8",
    });
    expect(proc.status).toBe(0);
    const out = JSON.parse(proc.stdout.trim().split("\n").at(-1) ?? "{}") as Record<string, string>;

    // Specialty stat overrides: name the family function, never registerBasic.
    expect(out.summaryStat).toContain("not registered in this build");
    expect(out.summaryStat).toContain("registerSummary()");
    expect(out.summaryStat).toContain("@ggts-sh/svelte");
    expect(out.summaryStat).not.toContain("registerBasic()");
    expect(out.summaryBinStat).toContain("registerSummaryBin()");
    expect(out.violinStat).toContain("registerViolin()");
    expect(out.dotplotStat).toContain("registerDotplot()");
    expect(out.hexStat).toContain("registerHex()");
    expect(out.sfTextStat).toContain("registerSfText()");

    // Specialty geom: name the family function.
    expect(out.polygonGeom).toContain("not registered in this build");
    expect(out.polygonGeom).toContain("registerPolygon()");
    expect(out.polygonGeom).not.toContain("registerBasic()");

    // Basic tier: name the granular headless family.
    expect(out.colGeom).toContain("not registered in this build");
    expect(out.colGeom).toContain("registerBasicBars()");
    expect(out.countStat).toContain("not registered in this build");
    expect(out.countStat).toContain("registerBasicPoints()");
  }, 60_000);
});
