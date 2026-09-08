export const GUIDE_SECTIONS = [
  "Start",
  "Core grammar",
  "Interaction",
  "Production",
  "Reference",
  "Release",
] as const;
export type GuideSection = (typeof GUIDE_SECTIONS)[number];

/** Stable HTML id / ARIA IDREF token for a guide section heading (no spaces). */
export function guideSectionDomId(section: string): string {
  return `guide-${section
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")}`;
}

/**
 * Catalog sections still order routes, but most labels are decorative chrome.
 * Only "Reference" keeps a visible heading on the docs index and sidebar.
 */
export const GUIDE_VISIBLE_SECTION_HEADINGS = new Set<string>(["Reference"]);

export type GuideNavEntry = { path: string; label: string };

export type GuideNavBlock =
  | { kind: "flat"; key: string; entries: readonly GuideNavEntry[] }
  | { kind: "section"; section: string; entries: readonly GuideNavEntry[] };

/** Collapse decorative section labels into flat lists; keep Reference headed. */
export function guideNavBlocks(
  groups: readonly { section: string; entries: readonly GuideNavEntry[] }[],
): GuideNavBlock[] {
  const blocks: GuideNavBlock[] = [];
  let flat: GuideNavEntry[] = [];
  let flatIndex = 0;

  const flushFlat = (): void => {
    if (flat.length === 0) return;
    blocks.push({ kind: "flat", key: `flat-${String(flatIndex)}`, entries: flat });
    flatIndex += 1;
    flat = [];
  };

  for (const group of groups) {
    if (GUIDE_VISIBLE_SECTION_HEADINGS.has(group.section)) {
      flushFlat();
      blocks.push({ kind: "section", section: group.section, entries: group.entries });
      continue;
    }
    flat.push(...group.entries);
  }
  flushFlat();
  return blocks;
}

interface GuideCatalogEntryBase {
  slug: string;
  title: string;
  description: string;
  primaryNavigationOwner?: "reference";
}

export type GuideCatalogEntry = GuideCatalogEntryBase &
  (
    | { section: GuideSection; navigationOrder: number }
    | { section?: undefined; navigationOrder?: never }
  );

/** User-facing guide identity and ordering. Guide prose remains catalog-generated. */
export const GUIDE_CATALOG = [
  {
    slug: "agents",
    title: "Agent sandboxes",
    description: "Install the skill and CLI, check chart specs, and render SVG in a sandbox.",
    section: "Start",
    navigationOrder: 0.5,
  },
  {
    slug: "getting-started",
    title: "Getting started",
    description: "Render the same chart in an agent sandbox, React, or Svelte.",
    section: "Start",
    navigationOrder: 1,
  },
  {
    slug: "statistics-positions",
    title: "Statistics and positions",
    description:
      "Compute summaries and control how derived marks occupy the same coordinate space.",
    section: "Core grammar",
    navigationOrder: 12,
  },
  {
    slug: "scales-guides",
    title: "Scales and guides",
    description: "Translate data domains into position, color, labels, axes, and legends.",
    section: "Core grammar",
    navigationOrder: 13,
  },
  {
    slug: "facets-coordinates",
    title: "Facets and coordinates",
    description: "Repeat one grammar across panels and choose how axes compose the view.",
    section: "Core grammar",
    navigationOrder: 15,
  },
  {
    slug: "temporal-scales",
    title: "Dates without preprocessing",
    description: "Value-driven date inference, strict parsers, overrides, and diagnostics.",
    section: "Core grammar",
    navigationOrder: 14,
  },
  {
    slug: "interactions",
    title: "Interactions",
    description: "Inspection, selection, zoom, keyboard behavior, identity, and event contracts.",
    section: "Interaction",
    navigationOrder: 20,
  },
  {
    slug: "production",
    title: "Production",
    description:
      "Responsive sizing, SVG/canvas rendering, SSR and export, and tested runtime support.",
    section: "Production",
    navigationOrder: 30,
  },
  {
    slug: "interaction-reference",
    title: "Interaction reference",
    description: "Search interaction props, callbacks, event phases, and diagnostic codes.",
    primaryNavigationOwner: "reference",
  },
  {
    slug: "errors",
    title: "Errors reference",
    description:
      "Understand validation, render, interaction, and CLI diagnostics and recover safely.",
    section: "Reference",
    // After /reference/* pages (50–63: overview through CLI, including coords + labs/axes/labels).
    navigationOrder: 64,
  },
  {
    slug: "advisories",
    title: "Advisories",
    description: "Spec-lint advisories and the pipeline's disclosed heuristics.",
    section: "Reference",
    navigationOrder: 65,
  },
  {
    slug: "lifecycle",
    title: "Lifecycle & editions",
    description: "API stability tags per export, and the defaults-edition mechanism.",
    section: "Reference",
    navigationOrder: 66,
  },
  {
    slug: "upgrading",
    title: "Upgrade guide",
    description: "Check versions, apply fixture-backed changes, and verify each 0.x transition.",
    section: "Release",
    navigationOrder: 70,
  },
] as const satisfies readonly GuideCatalogEntry[];

export type GuideSlug = (typeof GUIDE_CATALOG)[number]["slug"];
