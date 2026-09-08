import { describe, expect, it } from "vitest";

import BenchmarkHighlights from "$lib/components/BenchmarkHighlights.svelte";
import { render } from "./helpers/render.js";

describe("benchmark highlights", () => {
  it("renders all four comparisons without dropdowns or tabs", () => {
    const { container } = render(BenchmarkHighlights, {});
    expect(container.querySelectorAll("select, [role=tab]")).toHaveLength(0);
    expect(container.querySelectorAll(".benchmark-highlight")).toHaveLength(4);
    const images = [...container.querySelectorAll(".bench-chart--light")];
    expect(images.map((image) => image.getAttribute("src")?.split("?")[0])).toEqual([
      "/benchmarks/bench-core-scatter-10k-mount.svg",
      "/benchmarks/bench-core-scatter-1k-mount.svg",
      "/benchmarks/bench-core-scatter-10k-update.svg",
      "/benchmarks/bench-core-line-30k-update.svg",
    ]);
    for (const image of images) {
      expect(image.getAttribute("alt")).toContain("ggts core SVG");
      expect(image.getAttribute("alt")).not.toContain("D3");
    }
  });
});
