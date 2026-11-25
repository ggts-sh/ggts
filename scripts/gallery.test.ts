import { describe, expect, test } from "bun:test";

import { EXAMPLES } from "../examples/manifest.js";
import {
  FEATURED_EXAMPLES,
  galleryCatalog,
  galleryEntryFor,
  type GalleryEntry,
} from "../apps/docs/src/lib/catalog/gallery.js";
import {
  GALLERY_FILTER_JOURNEY_CATEGORY,
  GALLERY_FILTER_JOURNEY_QUERY,
} from "../tests/fixtures/gallery-filter-journey.js";
import {
  filterGallery,
  parseGalleryFilter,
  rankRelatedExamples,
  serializeGalleryFilter,
} from "../apps/docs/src/lib/gallery-filter.js";

describe("gallery editorial catalog", () => {
  test("curates exactly six unique real examples in the approved order", () => {
    expect(FEATURED_EXAMPLES.map((entry) => entry.id)).toEqual([
      "line/multi-series",
      "path/trajectory",
      "density/kde-2d-filled",
      "density/overlay",
      "path/ellipse-rings",
      "color/binned",
    ]);
    expect(new Set(FEATURED_EXAMPLES.map((entry) => entry.id)).size).toBe(6);
    const ids = new Set(EXAMPLES.map((entry) => entry.id));
    expect(FEATURED_EXAMPLES.every((entry) => ids.has(entry.id))).toBe(true);
    expect(FEATURED_EXAMPLES.every((entry) => entry.id.includes("/"))).toBe(true);
  });

  test("projects every gallery catalog entry without changing canonical identity", () => {
    const projected = galleryCatalog(EXAMPLES);
    expect(projected.length).toBe(EXAMPLES.length - 3);
    expect(projected.some((entry) => entry.id === "interaction/linked-views")).toBe(false);
    expect(projected.filter((entry) => entry.featured)).toHaveLength(6);
  });

  test("projects every manifest entry when asked explicitly", () => {
    const projected = EXAMPLES.map((entry) => galleryEntryFor(entry));
    expect(projected).toHaveLength(EXAMPLES.length);
    expect(projected.map((entry) => entry.id)).toEqual(EXAMPLES.map((entry) => entry.id));
  });
});

describe("gallery filter URL contract", () => {
  const entries = EXAMPLES.map((entry) => galleryEntryFor(entry));

  test("empty state returns all examples in manifest order", () => {
    expect(filterGallery(entries, { query: "", categories: [], tags: [] })).toEqual(entries);
  });

  test("searches manifest id, title, tags, and docsSection (not Labs copy)", () => {
    // Descriptions were emptied corpus-wide (#765); filter still accepts the
    // field but journey terms must match non-description haystack.
    const curated = filterGallery(entries, {
      query: "multi-series line",
      categories: [],
      tags: [],
    });
    expect(curated.some((entry) => entry.id === "line/multi-series")).toBe(true);
  });

  test("composes category, tag, and text with AND semantics", () => {
    const result = filterGallery(entries, {
      query: "legend",
      categories: ["bar"],
      tags: ["fill"],
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((entry) => entry.category === "bar" && entry.tags.includes("fill"))).toBe(
      true,
    );
  });

  test("keeps results ordered across filter changes and refreshed catalog entries", () => {
    const bar = {
      ...entries[0]!,
      id: "fixture/bar",
      category: "bar",
      title: "Palette",
      description: "A clue",
      tags: ["legend", "fill"],
    };
    const area = { ...bar, id: "fixture/area", category: "area" };
    const otherCategory = { ...bar, id: "fixture/line", category: "line" };
    const singleTag = { ...bar, id: "fixture/one-tag", tags: ["legend"] };
    const partialText = { ...bar, id: "fixture/partial", description: "" };
    const catalog = [bar, otherCategory, singleTag, area, partialText];
    const filters = { categories: ["bar", "area"], tags: ["legend", "fill"] };

    const matched = filterGallery(catalog, { ...filters, query: " PALETTE\t\u00A0clue " });
    expect(matched).toHaveLength(2);
    expect(matched[0]).toBe(bar);
    expect(matched[1]).toBe(area);
    expect(filterGallery(catalog, { ...filters, query: " \t " })).toEqual([bar, area, partialText]);

    const refreshed = { ...bar, description: "A new hint" };
    expect(filterGallery([refreshed], { ...filters, query: "clue" })).toEqual([]);
    expect(filterGallery([refreshed], { ...filters, query: "hint" })[0]).toBe(refreshed);
  });

  test("URL-filter journey query and category stay findable on the public gallery", () => {
    // Shared with docs-home-gallery.spec.ts so a #765-style content deletion
    // fails here instead of only on the required component-journeys job (#773).
    const catalog = galleryCatalog(EXAMPLES);
    const byQuery = filterGallery(catalog, {
      query: GALLERY_FILTER_JOURNEY_QUERY,
      categories: [],
      tags: [],
    });
    expect(byQuery.length).toBeGreaterThan(0);
    expect(catalog.some((entry) => entry.category === GALLERY_FILTER_JOURNEY_CATEGORY)).toBe(true);
  });

  test("every gallery entry is reachable via its own name fragment", () => {
    const catalog = galleryCatalog(EXAMPLES);
    for (const entry of catalog) {
      const hits = filterGallery(catalog, {
        query: entry.name,
        categories: [],
        tags: [],
      });
      expect(hits.some((hit) => hit.id === entry.id)).toBe(true);
    }
  });

  test("round-trips deterministic gallery keys while preserving unrelated query params", () => {
    const available = {
      categories: new Set(entries.map((entry) => entry.category)),
      tags: new Set(entries.flatMap((entry) => [...entry.tags])),
    };
    const parsed = parseGalleryFilter(
      new URLSearchParams("theme=dark&q=  legend  &category=bar&category=bar&tag=fill&tag=nope"),
      available,
    );
    expect(parsed).toEqual({
      state: { query: "legend", categories: ["bar"], tags: ["fill"] },
      reset: true,
    });
    const serialized = serializeGalleryFilter(
      parsed.state,
      new URLSearchParams("theme=dark&vr=1&q=old&category=point"),
    );
    expect(serialized.toString()).toBe("theme=dark&vr=1&q=legend&category=bar&tag=fill");
  });
});

describe("related example ranking", () => {
  const entries: GalleryEntry[] = EXAMPLES.map((entry) => galleryEntryFor(entry));
  const catalog = galleryCatalog(EXAMPLES);

  test("excludes self, ranks overlap, uses manifest ties, and caps output", () => {
    const related = rankRelatedExamples("bar/stacked", entries, 3);
    expect(related).toHaveLength(3);
    expect(related.some((entry) => entry.id === "bar/stacked")).toBe(false);
    expect(related[0]?.category).toBe("bar");
  });

  test("falls back to manifest order when no tags overlap", () => {
    const synthetic: GalleryEntry[] = entries.map((entry, index) => ({
      ...entry,
      tags: [`unique-${String(index)}`],
    }));
    expect(
      rankRelatedExamples(synthetic.at(-1)!.id, synthetic, 2).map((entry) => entry.id),
    ).toEqual([synthetic[0]!.id, synthetic[1]!.id]);
  });

  test("ranks repeated tags and category ties in catalog order with an explicit seed", () => {
    const base = entries[0]!;
    const unrelated = { ...base, id: "unrelated", category: "point", tags: [] };
    const category = { ...base, id: "category", category: "bar", tags: [] };
    const two = { ...unrelated, id: "two", tags: ["repeat", "repeat"] };
    const three = { ...unrelated, id: "three", tags: ["repeat", "repeat", "repeat"] };
    const seed = { ...category, id: "seed", tags: ["repeat", "repeat"] };
    const candidates: GalleryEntry[] = [unrelated, category];
    candidates[3] = two;
    candidates.push(three, seed);
    const ordered = [three, category, two, unrelated];

    for (const [limit, count] of [
      [3, 3],
      [Infinity, 4],
      [1.5, 1],
      [0.5, 0],
      [NaN, 0],
      [-1, 0],
    ] as const) {
      const result = rankRelatedExamples(category.id, candidates, limit, seed);
      expect(result).toHaveLength(count);
      for (const [index, entry] of ordered.slice(0, count).entries())
        expect(result[index]).toBe(entry);
    }
  });

  test("without a seed, id outside the candidate catalog returns empty", () => {
    // Exposition aliases use galleryCatalog (excludes expositions) as candidates.
    expect(rankRelatedExamples("interaction/linked-views", catalog, 3)).toEqual([]);
  });

  test("with a seed outside the catalog, ranks gallery neighbours by category/tags", () => {
    // Old /examples/interaction/* alias pages still render the shared template;
    // their id is not in galleryCatalog, so ranking needs the manifest seed.
    const seed = EXAMPLES.find((entry) => entry.id === "interaction/linked-views");
    expect(seed).toBeDefined();
    const related = rankRelatedExamples(seed!.id, catalog, 3, seed);
    expect(related).toHaveLength(3);
    expect(related.every((entry) => entry.id !== seed!.id)).toBe(true);
    expect(related.every((entry) => catalog.some((c) => c.id === entry.id))).toBe(true);
    // Prefer remaining gallery interaction examples over unrelated families.
    expect(related[0]?.category).toBe("interaction");
  });
});
