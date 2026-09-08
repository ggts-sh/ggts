/**
 * Guards: reference detail routes must not ship catalog barrels to the client.
 *
 * Universal +page.ts load re-ran on SPA nav and pulled GEOM_REFERENCE /
 * EXAMPLES / @ggts-sh/spec into every detail client node. Server loads
 * serialize entry data; the client only renders it.
 */
import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const docsSrc = path.join(root, "apps/docs/src");

function read(rel: string): string {
  return readFileSync(path.join(docsSrc, rel), "utf8");
}

const DETAIL_DIRS = [
  "routes/reference/geoms/[name]",
  "routes/reference/stats/[name]",
  "routes/reference/positions/[name]",
  "routes/reference/scales/[name]",
  "routes/reference/coords/[name]",
  "routes/reference/guides/[name]",
] as const;

describe("docs reference detail client thin", () => {
  it("loads detail entries and catalogs only from +page.server.ts", () => {
    for (const dir of DETAIL_DIRS) {
      const server = path.join(docsSrc, dir, "+page.server.ts");
      const universal = path.join(docsSrc, dir, "+page.ts");
      expect(existsSync(server), `${dir} has +page.server.ts`).toBe(true);
      expect(existsSync(universal), `${dir} has no universal +page.ts`).toBe(false);
      const source = readFileSync(server, "utf8");
      expect(source, dir).toMatch(/export const (?:load|entries)/);
      expect(source, dir).toMatch(/PageServerLoad|EntryGenerator/);
    }
  });

  it("keeps detail .svelte free of @ggts-sh/spec value imports", () => {
    for (const dir of DETAIL_DIRS) {
      const rel = `${dir}/+page.svelte`;
      const source = read(rel);
      // Type-only imports are fine; value imports pull the package graph.
      expect(source, rel).not.toMatch(
        /(?:^|\n)\s*import\s+(?!type\b)[^;]*\s+from\s*["']@ggts-sh\/spec["']/,
      );
    }
  });

  it("keeps detail .svelte free of catalog barrels (EXAMPLES / thumbnails)", () => {
    for (const dir of DETAIL_DIRS) {
      const rel = `${dir}/+page.svelte`;
      const source = read(rel);
      expect(source, rel).not.toMatch(
        /from\s*["']\$lib\/(?:examples-manifest|examples|geom-thumbnails|generated\/gallery-previews)["']/,
      );
    }
  });

  it("keeps ReferenceLede on the thin known-names catalog", () => {
    const lede = read("lib/components/ReferenceLede.svelte");
    expect(lede).toContain("known-names");
    expect(lede).not.toMatch(/from\s*["']@ggts-sh\/spec["']/);
  });

  it("documents a pure componentNameForGeom helper outside the spec barrel", () => {
    const helper = read("lib/component-name-for-geom.ts");
    expect(helper).toContain("export function componentNameForGeom");
    expect(helper).not.toMatch(/from\s*["']@ggts-sh\/spec["']/);
  });
});
