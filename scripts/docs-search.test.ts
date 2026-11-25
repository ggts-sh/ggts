import { describe, expect, it } from "bun:test";

import { DOCS_SEARCH_INDEX } from "../apps/docs/src/lib/generated/search-index.ts";
import { searchDocs } from "../apps/docs/src/lib/search.ts";
import type { DocsSearchEntry } from "../apps/docs/src/lib/search-types.ts";

const winners = [
  ["scale-scheme-type", "/guide/errors#scale-scheme-type"],
  ["GGPlot", "/guide/lifecycle#ggts-sh-svelte"],
  ["--max-marks", "/reference/cli#max-marks"],
  ["date axis", "/guide/scales-guides#date-and-time-axes"],
  ["tooltip", "/guide/interactions#inspection"],
  ["server render", "/guide/production#server-and-export"],
  ["canvas selection", "/guide/production#rendering"],
] as const;

function searchEntry(id: string, kind: DocsSearchEntry["kind"], href = `/${id}`): DocsSearchEntry {
  return { id, kind, title: "mark", summary: "", href, exact: [], keywords: [] };
}

describe("Docs search ranking", () => {
  for (const [query, href] of winners) {
    it(`ranks ${query} to its literal focused destination`, () => {
      expect(searchDocs(query, DOCS_SEARCH_INDEX)[0]?.href).toBe(href);
    });
  }

  it("returns no fake results for empty input and applies a deterministic bound", () => {
    expect(searchDocs("", DOCS_SEARCH_INDEX)).toEqual([]);
    expect(searchDocs("   ", DOCS_SEARCH_INDEX)).toEqual([]);
    expect(searchDocs("chart", DOCS_SEARCH_INDEX, 4)).toHaveLength(4);
    expect(searchDocs("chart", DOCS_SEARCH_INDEX, 4)).toEqual(
      searchDocs(" CHART ", DOCS_SEARCH_INDEX, 4),
    );
  });

  it("requires every query token and suppresses duplicate destinations", () => {
    const results = searchDocs("canvas selection", DOCS_SEARCH_INDEX);
    expect(results.length).toBeGreaterThan(0);
    expect(new Set(results.map((result) => result.href)).size).toBe(results.length);
  });

  it("ranks before deduplicating and fills the result limit with unique destinations", () => {
    const earlierDuplicate = searchEntry("earlier", "example", "/shared");
    const exact = { ...searchEntry("exact", "example"), title: "Mark reference", exact: ["mark"] };
    const first = searchEntry("first", "diagnostic", "/shared");
    const tiedDuplicate = searchEntry("tied", "api", "/shared");
    const second = searchEntry("second", "cli");
    const page = searchEntry("page", "page");
    const summary = { ...searchEntry("summary", "api"), title: "Reference", summary: "mark" };
    const index = [earlierDuplicate, page, first, tiedDuplicate, second, exact, summary];
    const ordered = [exact, first, second, page, summary];

    for (const [limit, count] of [
      [undefined, 5],
      [3, 3],
      [1.5, 5],
      [NaN, 5],
      [Infinity, 5],
      [0, 0],
      [-1, 0],
    ] as const) {
      const results = searchDocs("mark", index, limit);
      expect(results).toHaveLength(count);
      for (let i = 0; i < count; i += 1) expect(results[i]).toBe(ordered[i]);
    }
  });

  it("keeps ranking stable across many queries on the same frozen index", () => {
    // SiteSearch reuses one entries reference after load; prepare-once must not
    // change winners when the same array is scored repeatedly.
    const first = winners.map(([query]) => searchDocs(query, DOCS_SEARCH_INDEX)[0]?.href);
    for (let i = 0; i < 20; i += 1) {
      for (const [query] of winners) {
        void searchDocs(query, DOCS_SEARCH_INDEX);
      }
    }
    const again = winners.map(([query]) => searchDocs(query, DOCS_SEARCH_INDEX)[0]?.href);
    expect(again).toEqual(first);
    expect(first).toEqual(winners.map(([, href]) => href));
  });

  it("matches accented queries via the same normalize path as entry text", () => {
    const withAccent = {
      id: "fixture:cafe",
      kind: "page" as const,
      title: "Café scales",
      summary: "Accented title fixture",
      href: "/fixture/cafe",
      keywords: ["café"],
      exact: ["Café scales"],
    };
    const plain = {
      id: "fixture:plain",
      kind: "page" as const,
      title: "Other page",
      summary: "No accent",
      href: "/fixture/plain",
      keywords: [],
      exact: ["Other page"],
    };
    const index = [withAccent, plain] as const;
    expect(searchDocs("cafe", index)[0]?.href).toBe("/fixture/cafe");
    expect(searchDocs("CAFÉ", index)[0]?.href).toBe("/fixture/cafe");
  });
});
