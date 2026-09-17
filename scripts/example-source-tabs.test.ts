import { describe, expect, it } from "bun:test";

import { exampleSourceHeading, exampleSourceTabs } from "./example-source-tabs.ts";

describe("exampleSourceTabs", () => {
  const base = {
    svelteSource: "<GGPlot />",
    specSource: "export default spec;",
    spec: { layers: [] },
  };

  it("puts Svelte first and omits React when the example has no host", () => {
    const tabs = exampleSourceTabs({ ...base, reactSource: null });
    expect(tabs.map((tab) => tab.label)).toEqual(["Svelte", "Builder (TS)", "Spec (JSON)"]);
    expect(tabs[0]?.code).toBe("<GGPlot />");
  });

  it("omits React when the host source is empty", () => {
    const tabs = exampleSourceTabs({ ...base, reactSource: "  \n" });
    expect(tabs.map((tab) => tab.label)).toEqual(["Svelte", "Builder (TS)", "Spec (JSON)"]);
  });

  it("inserts a verified React tab after Svelte", () => {
    const tabs = exampleSourceTabs({
      ...base,
      reactSource: "export default function Chart() { return null; }",
    });
    expect(tabs.map((tab) => tab.label)).toEqual([
      "Svelte",
      "React",
      "Builder (TS)",
      "Spec (JSON)",
    ]);
    expect(tabs[1]?.language).toBe("tsx");
  });
});

describe("exampleSourceHeading", () => {
  it("names only the tabs that exist", () => {
    expect(exampleSourceHeading(false)).toBe("Svelte, builder, JSON");
    expect(exampleSourceHeading(true)).toBe("Svelte, React, builder, JSON");
  });
});
