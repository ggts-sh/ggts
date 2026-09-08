/**
 * Continuous-legend registration: discrete-color lean charts stay off the
 * ramp/steps builder. Seam A uses preload; Seam B uses a fresh process.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "bun:test";

import { getContinuousLegendBuilders } from "../src/legend-build-registry.ts";
import { registerContinuousLegend } from "../src/legend-register-continuous.ts";
import { registerAll, registerBasic } from "../src/register.ts";

describe("continuous-legend registration (Seam A)", () => {
  it("registerAll and registerBasic install the continuous builders", () => {
    registerBasic();
    registerAll();
    expect(getContinuousLegendBuilders()).toBeDefined();
    expect(() => {
      registerContinuousLegend();
    }).not.toThrow();
  });
});

describe("continuous-legend registration (Seam B)", () => {
  it("sequential color without the continuous legend throws; registerSequentialColor unlocks it", () => {
    const coreRoot = path.resolve(import.meta.dir, "..");
    const script = `
      import { renderToSVGString } from ${JSON.stringify(path.join(coreRoot, "src", "headless-entry.ts"))};
      import { registerBasicPoints, registerOrdinalColor, registerSequentialColor } from ${JSON.stringify(path.join(coreRoot, "src", "headless-register-entry.ts"))};
      import { aes, gg } from "@ggts-sh/spec/portable";

      const discrete = [
        { x: 1, y: 2, g: "a" },
        { x: 2, y: 3, g: "b" },
      ];
      const continuous = [
        { x: 1, y: 2, z: 0.1 },
        { x: 2, y: 3, z: 0.9 },
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
        discrete: attempt(() =>
          renderToSVGString(gg(discrete, aes({ x: "x", y: "y", color: "g" })).geomPoint(), {
            width: 200,
            height: 120,
          }),
        ),
        sequentialFresh: attempt(() =>
          renderToSVGString(gg(continuous, aes({ x: "x", y: "y", color: "z" })).geomPoint(), {
            width: 200,
            height: 120,
          }),
        ),
      };
      registerSequentialColor();
      out.sequentialAfter = attempt(() =>
        renderToSVGString(gg(continuous, aes({ x: "x", y: "y", color: "z" })).geomPoint(), {
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
    expect(out.discrete).toBe("rendered");
    expect(out.sequentialFresh).toContain("not registered");
    expect(out.sequentialAfter).toBe("rendered");
  }, 60_000);
});
