/**
 * SiteSearch Enter-while-loading race (#948 / #991):
 * Enter with a non-empty query while the index is still loading must wait for
 * the index, select the first match, and navigate — not ignore the key.
 */
import { flushSync } from "svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DocsSearchEntry } from "$lib/search-types";

const loadControl = vi.hoisted(() => {
  let resolveEntries!: (entries: readonly DocsSearchEntry[]) => void;
  let pending = new Promise<readonly DocsSearchEntry[]>((resolve) => {
    resolveEntries = resolve;
  });

  return {
    reset(): void {
      pending = new Promise<readonly DocsSearchEntry[]>((resolve) => {
        resolveEntries = resolve;
      });
    },
    resolve(entries: readonly DocsSearchEntry[]): void {
      resolveEntries(entries);
    },
    load(): Promise<readonly DocsSearchEntry[]> {
      return pending;
    },
  };
});

const navigate = vi.hoisted(() => ({
  assign: vi.fn(),
}));

vi.mock("$lib/load-docs-search-index", () => ({
  loadDocsSearchIndex: () => loadControl.load(),
  resetDocsSearchIndexLoaderForTests: () => {
    loadControl.reset();
  },
}));

vi.mock("$lib/site-search-navigate", () => ({
  assignDocsLocation: (href: string): void => {
    navigate.assign(href);
  },
}));

import SiteSearch from "$lib/components/SiteSearch.svelte";

import { render } from "./helpers/render.js";

const FIXTURE_ENTRY: DocsSearchEntry = {
  id: "getting-started",
  kind: "page",
  title: "Getting started",
  summary: "Install @ggts-sh/svelte and render one chart.",
  href: "/guide/getting-started",
  keywords: ["install", "quickstart"],
  exact: ["getting started"],
};

function siteSearchExports(component: unknown): {
  open: (trigger: HTMLElement) => void;
} {
  return component as { open: (trigger: HTMLElement) => void };
}

describe("SiteSearch Enter while index is loading (#948)", () => {
  beforeEach(() => {
    loadControl.reset();
    navigate.assign.mockReset();
  });

  it("waits for the index, selects the first match, and navigates", async () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);

    try {
      const { container, component } = render(SiteSearch, {});

      siteSearchExports(component).open(trigger);
      flushSync();

      const dialog = container.querySelector<HTMLDialogElement>("dialog.site-search");
      expect(dialog?.open).toBe(true);
      expect(container.querySelector(".search-status")?.textContent).toContain(
        "Loading search index",
      );

      const input = container.querySelector<HTMLInputElement>("#docs-search-input");
      expect(input).not.toBeNull();
      input!.value = "getting";
      input!.dispatchEvent(new Event("input", { bubbles: true }));
      flushSync();

      const enter = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      });
      input!.dispatchEvent(enter);
      expect(enter.defaultPrevented).toBe(true);

      // Still loading: navigation must not fire until the index resolves.
      expect(navigate.assign).not.toHaveBeenCalled();

      loadControl.resolve([FIXTURE_ENTRY]);
      await vi.waitFor(() => {
        expect(navigate.assign).toHaveBeenCalledWith("/guide/getting-started");
      });

      expect(dialog?.open).toBe(false);
    } finally {
      trigger.remove();
    }
  });
});
