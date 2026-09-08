import { describe, expect, it } from "vitest";

import BenchmarkTabs from "$lib/components/BenchmarkTabs.svelte";
import { render } from "./helpers/render.js";

describe("benchmark tabs", () => {
  it("defaults to one chart and offers four scenarios without dropdowns", () => {
    const { container } = render(BenchmarkTabs, {});
    expect(container.querySelectorAll("select")).toHaveLength(0);
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual([
      "10k points",
      "1k points",
      "10k update",
      "30k line update",
    ]);
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelectorAll('[role="tabpanel"][data-state="active"]')).toHaveLength(1);
    expect(
      container.querySelectorAll('[role="tabpanel"][data-state="active"] .bench-chart--light'),
    ).toHaveLength(1);
    const image = container.querySelector(
      '[role="tabpanel"][data-state="active"] .bench-chart--light',
    );
    expect(image?.getAttribute("src")?.split("?")[0]).toBe(
      "/benchmarks/bench-core-scatter-10k-mount.svg",
    );
    expect(image?.getAttribute("alt")).toContain("ggts core SVG");
    expect(image?.getAttribute("alt")).not.toContain("D3");
  });
});
