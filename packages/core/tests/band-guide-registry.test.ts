/**
 * Band-guide registration: continuous axes stay off the planner module.
 *
 * Seam A (in-process) cannot assert a missing planner because bunfig preload
 * calls registerAll(). Seam B uses a fresh process.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "bun:test";

import { getBandAxisPlanner } from "../src/layout/band-guide-registry.ts";
import { registerBandGuide } from "../src/layout/register-band-guide.ts";
import { registerAll, registerBasic } from "../src/register.ts";

describe("band-guide registration (Seam A)", () => {
  it("registerAll and registerBasic install the band planner", () => {
    registerBasic();
    registerAll();
    expect(getBandAxisPlanner()).toBeDefined();
    expect(() => {
      registerBandGuide();
    }).not.toThrow();
  });
});

describe("band-guide registration (Seam B)", () => {
  it("unregistered band-x throws; registerBandGuide unlocks it", () => {
    const coreRoot = path.resolve(import.meta.dir, "..");
    const script = `
      import { renderToSVGString } from ${JSON.stringify(path.join(coreRoot, "src", "headless-entry.ts"))};
      import { registerBasicPoints, registerOrdinalColor } from ${JSON.stringify(path.join(coreRoot, "src", "headless-register-entry.ts"))};
      import { registerBandGuide } from ${JSON.stringify(path.join(coreRoot, "src", "layout", "register-band-guide.ts"))};
      import { aes, gg } from "@ggts-sh/spec/portable";

      const continuous = [
        { x: 1, y: 2, g: "a" },
        { x: 2, y: 3, g: "b" },
      ];
      const band = [
        { x: "a", y: 1 },
        { x: "b", y: 2 },
      ];
      const attempt = (fn) => {
        try {
          fn();
          return "rendered";
        } catch (error) {
          return String(error instanceof Error ? error.message : error);
        }
      };
      registerBasicPoints();
      registerOrdinalColor();
      const out = {
        continuous: attempt(() =>
          renderToSVGString(gg(continuous, aes({ x: "x", y: "y", color: "g" })).geomPoint(), {
            width: 200,
            height: 120,
          }),
        ),
        bandFresh: attempt(() =>
          renderToSVGString(gg(band, aes({ x: "x", y: "y" })).geomPoint(), {
            width: 200,
            height: 120,
          }),
        ),
      };
      registerBandGuide();
      out.bandAfter = attempt(() =>
        renderToSVGString(gg(band, aes({ x: "x", y: "y" })).geomPoint(), {
          width: 200,
          height: 120,
        }),
      );
      console.log(JSON.stringify(out));
    `;
    const proc = spawnSync(process.execPath, ["-e", script], {
      cwd: coreRoot,
      encoding: "utf8",
    });
    expect(proc.status).toBe(0, proc.stderr || proc.stdout);
    const out = JSON.parse(proc.stdout.trim().split("\n").at(-1) ?? "{}") as Record<string, string>;
    expect(out.continuous).toBe("rendered");
    expect(out.bandFresh).toContain("not registered");
    expect(out.bandFresh).toContain("registerBandGuide");
    expect(out.bandAfter).toBe("rendered");
  }, 60_000);
});
