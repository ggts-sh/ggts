import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

import BenchmarkTabs from "$lib/components/BenchmarkTabs.svelte";
import { render } from "./helpers/render.js";

describe("benchmark surface navigation", () => {
  it("opens core SVG mount results and keeps both framework hosts reachable", () => {
    const { container } = render(BenchmarkTabs, {});
    flushSync();
    const [surface, operation] = container.querySelectorAll("select");
    expect(surface.value).toBe("core");
    expect(operation.value).toBe("mount");
    expect([...surface.options].map((option) => option.value)).toEqual(["core", "svelte", "react"]);
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(6);
    expect(container.querySelector("img")?.getAttribute("src")).toContain(
      "bench-core-scatter-10k-mount",
    );

    for (const framework of ["svelte", "react"]) {
      surface.value = framework;
      surface.dispatchEvent(new Event("change", { bubbles: true }));
      flushSync();
      expect(container.querySelectorAll('[role="tab"]')).toHaveLength(2);
      expect(container.querySelector("img")?.getAttribute("src")).toContain(
        `bench-${framework}-scatter-10k-mount`,
      );
    }
    operation.value = "update";
    operation.dispatchEvent(new Event("change", { bubbles: true }));
    flushSync();
    expect(container.querySelector("img")?.getAttribute("src")).toContain(
      "bench-react-scatter-10k-update",
    );
  });
});
