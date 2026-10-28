import { describe, expect, it } from "vitest";

import GGPlot from "../../src/lib/GGPlot.svelte";
import "../../src/lib/host-init.js";
import { render } from "../helpers/render.js";
import { until } from "../helpers/until.js";
import { rows, size } from "./interaction-harness.js";

describe("accessible keyboard instructions", () => {
  it("describes inspect, select-area, and zoom-area truthfully", async () => {
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "x",
      inspect: true,
      select: { type: "interval" },
      zoom: true,
      ...size,
    });
    const capture = container.querySelector<HTMLElement>(".gg-capture")!;
    const description = () => {
      const id = capture.getAttribute("aria-describedby")?.split(" ")[0];
      return id === undefined
        ? ""
        : (container.querySelector<HTMLElement>(`#${CSS.escape(id)}`)?.textContent ?? "");
    };
    expect(description()).toContain("Use Arrow keys to inspect data");
    expect(description()).toContain("Enter or Space to pin");

    const tool = (label: string) =>
      [...container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button")].find(
        (button) => button.textContent?.trim() === label,
      )!;
    tool("Select area").click();
    await until(() => description().includes("selection corner"));
    expect(description()).toContain("Enter or Space");
    expect(description()).toContain("Arrow keys");
    expect(description()).toContain("Shift");
    expect(description()).toContain("Escape to cancel");

    tool("Zoom area").click();
    await until(() => description().includes("zoom corner"));
    expect(description()).toContain("Enter or Space");
    expect(description()).toContain("Arrow keys");
    expect(description()).toContain("Shift");
    expect(description()).toContain("Escape to cancel");
  });
});
