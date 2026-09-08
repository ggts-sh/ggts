import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "bun:test";

describe("granular headless registration", () => {
  it("registers point without pulling in line until requested", () => {
    const coreRoot = path.resolve(import.meta.dir, "..");
    const script = `
      import { renderToSVGString } from ${JSON.stringify(path.join(coreRoot, "src", "headless-entry.ts"))};
      import { registerBasicLines, registerBasicPoints } from ${JSON.stringify(path.join(coreRoot, "src", "headless-register-entry.ts"))};
      import { aes, gg } from "@ggts-sh/spec/portable";
      const rows = [{ x: 1, y: 2 }, { x: 2, y: 3 }];
      const render = (kind) => {
        const plot = gg(rows, aes({ x: "x", y: "y" }));
        return renderToSVGString(kind === "point" ? plot.geomPoint() : plot.geomLine(), { width: 200, height: 120 });
      };
      const attempt = (kind) => {
        try { render(kind); return "rendered"; }
        catch (error) { return String(error instanceof Error ? error.message : error); }
      };
      const out = { pointFresh: attempt("point"), lineFresh: attempt("line") };
      registerBasicPoints();
      out.pointAfterPoint = attempt("point");
      out.lineAfterPoint = attempt("line");
      registerBasicLines();
      out.lineAfterLine = attempt("line");
      console.log(JSON.stringify(out));
    `;
    const proc = spawnSync(process.execPath, ["-e", script], {
      cwd: coreRoot,
      encoding: "utf8",
    });
    expect(proc.status).toBe(0);
    const out = JSON.parse(proc.stdout.trim().split("\n").at(-1) ?? "{}") as Record<string, string>;
    expect(out.pointFresh).toContain("not registered");
    expect(out.lineFresh).toContain("not registered");
    expect(out.pointAfterPoint).toBe("rendered");
    expect(out.lineAfterPoint).toContain("not registered");
    expect(out.lineAfterLine).toBe("rendered");
  });

  it("upgrades default ordinal color registration when named schemes are requested", () => {
    const coreRoot = path.resolve(import.meta.dir, "..");
    const script = `
      import { renderToSVGString } from ${JSON.stringify(path.join(coreRoot, "src", "headless-entry.ts"))};
      import { registerBasicPoints, registerDefaultOrdinalColor, registerOrdinalColor } from ${JSON.stringify(path.join(coreRoot, "src", "headless-register-entry.ts"))};
      registerBasicPoints();
      registerDefaultOrdinalColor();
      const rows = [{ x: 1, y: 2, group: "a" }, { x: 2, y: 3, group: "b" }];
      const spec = (color) => ({
        data: { values: rows },
        layers: [{ geom: "point", aes: { x: { field: "x" }, y: { field: "y" }, color: { field: "group" } } }],
        ...(color === undefined ? {} : { scales: { color } }),
      });
      const attempt = (color) => {
        try { return renderToSVGString(spec(color), { width: 200, height: 120 }); }
        catch (error) { return String(error instanceof Error ? error.message : error); }
      };
      const out = {
        defaultSvg: attempt(undefined),
        explicitSvg: attempt({ type: "ordinal", range: ["#112233", "#445566"] }),
        namedBeforeFull: attempt({ type: "ordinal", scheme: "Dark2" }),
      };
      registerOrdinalColor();
      out.namedAfterFull = attempt({ type: "ordinal", scheme: "Dark2" });
      console.log(JSON.stringify(out));
    `;
    const proc = spawnSync(process.execPath, ["-e", script], {
      cwd: coreRoot,
      encoding: "utf8",
    });
    expect(proc.status).toBe(0);
    const out = JSON.parse(proc.stdout.trim().split("\n").at(-1) ?? "{}") as Record<string, string>;
    expect(out.defaultSvg).toContain("gg-points");
    expect(out.explicitSvg).toContain("#112233");
    expect(out.namedBeforeFull).toContain("Call registerOrdinalColor()");
    expect(out.namedAfterFull).toContain("gg-points");
  });

  it("registers the default count stat with the bar family", () => {
    const coreRoot = path.resolve(import.meta.dir, "..");
    const script = `
      import { renderToSVGString } from ${JSON.stringify(path.join(coreRoot, "src", "headless-entry.ts"))};
      import { registerBasicBars } from ${JSON.stringify(path.join(coreRoot, "src", "headless-register-entry.ts"))};
      import { aes, gg } from "@ggts-sh/spec/portable";
      registerBasicBars();
      const svg = renderToSVGString(
        gg([{ x: "a" }, { x: "a" }, { x: "b" }], aes({ x: "x" })).geomBar(),
        { width: 200, height: 120 },
      );
      console.log(svg.includes("gg-rects") ? "rendered" : "missing");
    `;
    const proc = spawnSync(process.execPath, ["-e", script], {
      cwd: coreRoot,
      encoding: "utf8",
    });
    expect(proc.status).toBe(0);
    expect(proc.stdout.trim().split("\n").at(-1)).toBe("rendered");
  });
});
