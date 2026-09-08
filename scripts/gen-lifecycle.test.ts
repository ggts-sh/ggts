/**
 * gen-lifecycle unit tests + the lifecycle.json staleness guard (the CI
 * parity for `bun run lifecycle:check`).
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildLifecycleDocument,
  extractExports,
  LifecycleError,
  lifecycleJSON,
  SURFACES,
} from "./gen-lifecycle.ts";

const HEADER = "// @lifecycle-default experimental\n";

describe("extractExports", () => {
  it("preserves inline type exports on data and adapter entrypoints", () => {
    expect(extractExports(HEADER + 'export { rows, type Row } from "./data.js";', "f.ts")).toEqual([
      { name: "Row", kind: "type", lifecycle: "experimental" },
      { name: "rows", kind: "value", lifecycle: "experimental" },
    ]);
  });
  it("applies the file default, statement JSDoc markers, and name tags", () => {
    const src =
      HEADER +
      `export { a, b } from "./x.js";
/** @lifecycle stable-intent */
export { c } from "./y.js";
export type {
  D,
  E, // @lifecycle stable-intent
} from "./z.js";
`;
    expect(extractExports(src, "f.ts")).toEqual([
      { name: "D", kind: "type", lifecycle: "experimental" },
      { name: "E", kind: "type", lifecycle: "stable-intent" },
      { name: "a", kind: "value", lifecycle: "experimental" },
      { name: "b", kind: "value", lifecycle: "experimental" },
      { name: "c", kind: "value", lifecycle: "stable-intent" },
    ]);
  });

  it("resolves `default as X` and `A as B` aliases", () => {
    const src = HEADER + `export { default as GGPlot } from "./GGPlot.svelte";\n`;
    expect(extractExports(src, "f.ts")).toEqual([
      { name: "GGPlot", kind: "value", lifecycle: "experimental" },
    ]);
  });

  it("prose comments mentioning @lifecycle markers do not swallow statements", () => {
    const src =
      "// header prose: statements use /" +
      "** @lifecycle tag *" +
      "/ markers\n" +
      HEADER +
      `export { early } from "./a.js";
/** @lifecycle stable-intent */
export { late } from "./b.js";
`;
    const names = extractExports(src, "f.ts").map((e) => [e.name, e.lifecycle]);
    expect(names).toEqual([
      ["early", "experimental"],
      ["late", "stable-intent"],
    ]);
  });

  it("rejects missing default, unknown tags, ambiguous multi-name tags, unsupported forms", () => {
    expect(() => extractExports(`export { a } from "./x.js";`, "f.ts")).toThrow(LifecycleError);
    expect(() =>
      extractExports(
        HEADER + `export {\n  a, b, // @lifecycle stable-intent\n} from "./x.js";`,
        "f.ts",
      ),
    ).toThrow(/ambiguous/);
    expect(() => extractExports(HEADER + `export const x = 1;`, "f.ts")).toThrow(
      /unsupported export form/,
    );
    expect(() =>
      extractExports(HEADER + `/** @lifecycle shiny */\nexport { a } from "./x.js";`, "f.ts"),
    ).toThrow(LifecycleError);
  });
});

describe("lifecycle.json", () => {
  const repoRoot = join(import.meta.dir, "..");
  const read = (file: string) => readFileSync(join(repoRoot, file), "utf8");

  it("is current (regenerate with `bun run lifecycle:gen`)", () => {
    expect(readFileSync(join(repoRoot, "lifecycle.json"), "utf8")).toBe(lifecycleJSON(read));
  });

  it("covers every surface and pins the agent core path as stable-intent", () => {
    const doc = buildLifecycleDocument(read) as {
      surfaces: {
        package: string;
        entry: string;
        exports: Record<string, { lifecycle: string }>;
      }[];
    };
    expect(doc.surfaces).toHaveLength(SURFACES.length);
    // Lean subpath entries shipped by package.json exports (#1278).
    for (const entry of [
      { package: "@ggts-sh/core", entry: "./render" },
      { package: "@ggts-sh/core", entry: "./data" },
      { package: "@ggts-sh/react", entry: "." },
      { package: "@ggts-sh/core", entry: "./temporal" },
      { package: "@ggts-sh/spec", entry: "./portable" },
    ] as const) {
      expect(doc.surfaces.some((s) => s.package === entry.package && s.entry === entry.entry)).toBe(
        true,
      );
    }
    const stableIntent = (pkg: string, entry: string) => {
      const s = doc.surfaces.find((x) => x.package === pkg && x.entry === entry)!;
      return Object.keys(s.exports).filter((k) => s.exports[k]!.lifecycle === "stable-intent");
    };
    const spec = stableIntent("@ggts-sh/spec", ".");
    for (const name of ["PortableSpec", "normalize", "validate"]) {
      expect(spec).toContain(name);
    }
    expect(stableIntent("@ggts-sh/core", ".")).toContain("renderToSVGString");
    const svelte = stableIntent("@ggts-sh/svelte", ".");
    for (const name of ["GGPlot", "PortableSpec", "normalize", "validate", "renderToSVGString"]) {
      expect(svelte).toContain(name);
    }
    // #705: declaration-only Geom* shells are the recommended composition path.
    for (const name of ["GeomPoint", "GeomLine", "GeomBar", "GeomAbline"]) {
      expect(svelte).toContain(name);
    }
    // Factory/registry stay experimental (not composition surface).
    const svelteSurface = doc.surfaces.find(
      (x) => x.package === "@ggts-sh/svelte" && x.entry === ".",
    )!;
    for (const name of ["createGeomLayer", "registerLayer", "GeomProps"]) {
      expect(svelteSurface.exports[name]?.lifecycle).toBe("experimental");
      expect(svelte).not.toContain(name);
    }
  });
});
