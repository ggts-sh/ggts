/**
 * Style-kind registration: unused numeric/finite resolvers stay off the
 * headless graph. Seam A uses preload; Seam B uses a fresh process.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "bun:test";

import { getStyleScaleResolver } from "../src/pipeline/scale-style-registry.ts";
import { registerAll, registerBasic } from "../src/register.ts";
import { registerNumericStyle } from "../src/pipeline/register-style-numeric.ts";

describe("style-kind registration (Seam A)", () => {
  it("registerAll and registerBasic install every style family", () => {
    registerBasic();
    registerAll();
    expect(getStyleScaleResolver("finite")).toBeDefined();
    expect(getStyleScaleResolver("numeric")).toBeDefined();
    expect(() => {
      registerNumericStyle();
    }).not.toThrow();
  });
});

describe("style-kind registration (Seam B)", () => {
  it("unregistered size throws; registerNumericStyle unlocks it", () => {
    const coreRoot = path.resolve(import.meta.dir, "..");
    const script = `
      import { renderToSVGString } from ${JSON.stringify(path.join(coreRoot, "src", "headless-entry.ts"))};
      import { registerBasicPoints, registerOrdinalColor } from ${JSON.stringify(path.join(coreRoot, "src", "headless-register-entry.ts"))};
      import { registerNumericStyle } from ${JSON.stringify(path.join(coreRoot, "src", "pipeline", "register-style-numeric.ts"))};
      import { aes, gg } from "@ggts-sh/spec/portable";

      const colorOnly = [
        { x: 1, y: 2, g: "a" },
        { x: 2, y: 3, g: "b" },
      ];
      const sized = [
        { x: 1, y: 2, z: 1 },
        { x: 2, y: 3, z: 4 },
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
        colorOnly: attempt(() =>
          renderToSVGString(gg(colorOnly, aes({ x: "x", y: "y", color: "g" })).geomPoint(), {
            width: 200,
            height: 120,
          }),
        ),
        sizeFresh: attempt(() =>
          renderToSVGString(gg(sized, aes({ x: "x", y: "y", size: "z" })).geomPoint(), {
            width: 200,
            height: 120,
          }),
        ),
      };
      registerNumericStyle();
      out.sizeAfter = attempt(() =>
        renderToSVGString(gg(sized, aes({ x: "x", y: "y", size: "z" })).geomPoint(), {
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
    expect(out.colorOnly).toBe("rendered");
    expect(out.sizeFresh).toContain("not registered");
    expect(out.sizeFresh).toContain("registerNumericStyle");
    expect(out.sizeAfter).toBe("rendered");
  }, 60_000);
});
