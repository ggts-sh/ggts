import { describe, expect, it, vi } from "vitest";

import type { InteractiveLegendEntry } from "../../src/lib/legend/focus.js";
import LegendTargets from "../../src/lib/legend/LegendTargets.svelte";
import { CLEAR_HIDE_DELAY_MS } from "../../src/lib/assembly/layout.js";
import { render } from "../helpers/render.js";

const webEntry = { value: "web", label: "Web", color: "#123456", y: 18 };
const storeEntry = { value: "store", label: "Store", color: "#654321", y: 42 };

const discreteFill = {
  type: "discrete" as const,
  scale: "fill",
  title: "Channel",
  x: 100,
  y: 12,
  width: 10,
  height: 72,
  swatchSize: 12,
  entries: [webEntry, storeEntry],
};

const entries: InteractiveLegendEntry[] = [
  {
    legend: discreteFill,
    entry: webEntry,
    identity: { scale: "fill", entryIndex: 0 },
  },
  {
    legend: discreteFill,
    entry: storeEntry,
    identity: { scale: "fill", entryIndex: 1 },
  },
];

const noopHandlers = {
  onPreviewIndex: () => {},
  onPreviewClear: () => {},
  onPointerDown: () => {},
  onPointerUp: () => {},
  onPointerCancel: () => {},
  onFocus: () => {},
  onBlur: () => {},
  onClick: () => {},
  onKeyDown: () => {},
  onClearPointerDown: () => {},
  onClearPointerCancel: () => {},
  onClearClick: () => {},
};

const clearLayout = { left: 100, top: 88 };

describe("LegendTargets", () => {
  it("renders one hit target per entry and hides clear when clearLayout is null", () => {
    const { container } = render(LegendTargets, {
      entries,
      sceneWidth: 400,
      sceneHeight: 300,
      clearLayout: null,
      ...noopHandlers,
    });
    expect(container.querySelectorAll("[data-gg-legend-target]")).toHaveLength(2);
    expect(container.querySelector(".gg-legend-clear")).toBeNull();
  });

  it("places clear at the resolved legend-relative layout (not scene top-right)", () => {
    const { container } = render(LegendTargets, {
      entries,
      sceneWidth: 400,
      sceneHeight: 300,
      clearLayout: { left: 112, top: 96 },
      pressedIdentity: { scale: "fill", entryIndex: 0 },
      ...noopHandlers,
    });
    const clear = container.querySelector<HTMLButtonElement>(".gg-legend-clear");
    expect(clear).not.toBeNull();
    expect(clear?.style.left).toBe("112px");
    expect(clear?.style.top).toBe("96px");
    // Must not hardcode the old scene-corner park (sceneWidth-52, top 4).
    expect(clear?.style.left).not.toBe("348px");
    expect(clear?.style.top).not.toBe("4px");
  });

  it("keeps clear compact (legend-row height, not a 44×44 slab)", () => {
    const { container } = render(LegendTargets, {
      entries,
      sceneWidth: 400,
      sceneHeight: 300,
      clearLayout,
      pressedIdentity: { scale: "fill", entryIndex: 0 },
      ...noopHandlers,
    });
    const clear = container.querySelector<HTMLButtonElement>(".gg-legend-clear")!;
    const style = getComputedStyle(clear);
    expect(Number(style.minHeight.replace("px", ""))).toBeLessThanOrEqual(24);
    expect(Number(style.height.replace("px", ""))).toBeLessThanOrEqual(28);
    expect(Number(style.minWidth.replace("px", ""))).toBeLessThanOrEqual(24);
  });

  it("honors kebab-case tooltip background/foreground aliases on clear control", () => {
    // Same chrome family as filter chips (#207): kebab-only theme path must
    // not fall through to a white surface under light text.
    const { container } = render(LegendTargets, {
      entries,
      sceneWidth: 400,
      sceneHeight: 300,
      clearLayout,
      pressedIdentity: { scale: "fill", entryIndex: 0 },
      ...noopHandlers,
    });
    container.style.setProperty("--gg-tooltip-background", "#111111");
    container.style.setProperty("--gg-tooltip-foreground", "#ffffff");

    const clear = container.querySelector<HTMLButtonElement>(".gg-legend-clear")!;
    expect(getComputedStyle(clear).backgroundColor).toBe("rgb(17, 17, 17)");
    expect(getComputedStyle(clear).color).toBe("rgb(255, 255, 255)");
  });

  it("prefers camelCase tooltip tokens over kebab-case aliases on clear control", () => {
    const { container } = render(LegendTargets, {
      entries,
      sceneWidth: 400,
      sceneHeight: 300,
      clearLayout,
      pressedIdentity: { scale: "fill", entryIndex: 0 },
      ...noopHandlers,
    });
    container.style.setProperty("--gg-tooltipPaper", "#ffffff");
    container.style.setProperty("--gg-tooltipInk", "#262626");
    container.style.setProperty("--gg-tooltip-background", "#111111");
    container.style.setProperty("--gg-tooltip-foreground", "#ffffff");

    const clear = container.querySelector<HTMLButtonElement>(".gg-legend-clear")!;
    expect(getComputedStyle(clear).backgroundColor).toBe("rgb(255, 255, 255)");
    expect(getComputedStyle(clear).color).toBe("rgb(38, 38, 38)");
  });

  it("fades clear after idle leave so committed screenshots stay clean", async () => {
    vi.useFakeTimers();
    try {
      const { container } = render(LegendTargets, {
        entries,
        sceneWidth: 400,
        sceneHeight: 300,
        clearLayout,
        pressedIdentity: { scale: "fill", entryIndex: 0 },
        ...noopHandlers,
      });
      // Chrome wrapper is pointer-events:none; enter/leave fire on children.
      const target = container.querySelector<HTMLButtonElement>("[data-gg-legend-target]")!;
      const clear = container.querySelector<HTMLButtonElement>(".gg-legend-clear")!;

      // Mount schedules the hide clock; pin cancels it while the pointer is over chrome.
      target.dispatchEvent(
        new PointerEvent("pointerenter", { bubbles: true, pointerType: "mouse" }),
      );
      expect(clear.classList.contains("gg-legend-clear-faded")).toBe(false);

      target.dispatchEvent(
        new PointerEvent("pointerleave", { bubbles: true, pointerType: "mouse" }),
      );
      expect(clear.classList.contains("gg-legend-clear-faded")).toBe(false);
      await vi.advanceTimersByTimeAsync(CLEAR_HIDE_DELAY_MS);
      expect(clear.classList.contains("gg-legend-clear-faded")).toBe(true);
      expect(clear.getAttribute("aria-hidden")).toBe("true");

      // Re-enter via a legend target (Clear itself is pointer-events:none when faded).
      target.dispatchEvent(
        new PointerEvent("pointerenter", { bubbles: true, pointerType: "mouse" }),
      );
      // Force a microtask flush so Svelte applies the pin state to the class.
      await Promise.resolve();
      expect(clear.classList.contains("gg-legend-clear-faded")).toBe(false);
      expect(clear.getAttribute("aria-hidden")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("applies min target width of 24 when legend width is smaller", () => {
    const { container } = render(LegendTargets, {
      entries,
      sceneWidth: 400,
      sceneHeight: 300,
      clearLayout: null,
      ...noopHandlers,
    });
    const targets = container.querySelectorAll<HTMLButtonElement>("[data-gg-legend-target]");
    expect(targets.length).toBeGreaterThan(0);
    // legend width is 10 → max(24, 10) = 24
    expect(targets.item(0)?.style.width).toBe("24px");
  });

  it("extends a row-ending horizontal target to the legend edge", () => {
    const horizontal = {
      ...discreteFill,
      direction: "horizontal" as const,
      width: 180,
      entries: [
        { ...webEntry, x: 0, y: 18 },
        { ...storeEntry, x: 80, y: 18 },
        { value: "partner", label: "Partner", color: "#abcdef", x: 0, y: 42 },
      ],
    };
    const horizontalEntries: InteractiveLegendEntry[] = horizontal.entries.map((entry, index) => ({
      legend: horizontal,
      entry,
      identity: { scale: "fill", entryIndex: index },
    }));
    const { container } = render(LegendTargets, {
      entries: horizontalEntries,
      sceneWidth: 400,
      sceneHeight: 300,
      clearLayout: null,
      ...noopHandlers,
    });
    const targets = container.querySelectorAll<HTMLButtonElement>("[data-gg-legend-target]");
    expect(targets.item(1)?.style.width).toBe("100px");
  });

  it("starts a left-title target at the key, leaving the title outside", () => {
    const leftTitle = {
      ...discreteFill,
      titleHeight: 0,
      titleX: 4,
      width: 180,
      entries: [{ ...webEntry, x: 60, y: 4, height: 24 }],
    };
    const leftEntries: InteractiveLegendEntry[] = [
      {
        legend: leftTitle,
        entry: leftTitle.entries[0],
        identity: { scale: "fill", entryIndex: 0 },
      },
    ];
    const { container } = render(LegendTargets, {
      entries: leftEntries,
      sceneWidth: 400,
      sceneHeight: 300,
      clearLayout: null,
      ...noopHandlers,
    });
    const target = container.querySelector<HTMLButtonElement>("[data-gg-legend-target]")!;
    const left = target.offsetLeft;
    const width = target.offsetWidth;
    // Scene draws the side-title key glyph starting at entry.x + 4.
    const keyLeft = leftTitle.x + leftTitle.entries[0].x + 4;
    const keyRight = keyLeft + leftTitle.swatchSize;
    // The whole key is hit-testable...
    expect(left).toBeLessThanOrEqual(keyLeft);
    expect(left + width).toBeGreaterThanOrEqual(keyRight);
    // ...while the title column and the shifted title text stay outside.
    expect(left).toBeGreaterThan(leftTitle.x + leftTitle.titleX);
    expect(left).toBeGreaterThanOrEqual(leftTitle.x + leftTitle.entries[0].x);
    // Clipping at the key shifts the left edge only: the right edge stays put.
    expect(left + width).toBeCloseTo(leftTitle.x + leftTitle.width);
  });

  it("butts adjacent horizontal left-title targets together at the key glyphs", () => {
    const horizontal = {
      ...discreteFill,
      direction: "horizontal" as const,
      titleHeight: 0,
      titleX: 4,
      width: 240,
      entries: [
        { ...webEntry, x: 60, y: 4 },
        { ...storeEntry, x: 140, y: 4 },
      ],
    };
    const horizontalEntries: InteractiveLegendEntry[] = horizontal.entries.map((entry, index) => ({
      legend: horizontal,
      entry,
      identity: { scale: "fill", entryIndex: index },
    }));
    const { container } = render(LegendTargets, {
      entries: horizontalEntries,
      sceneWidth: 400,
      sceneHeight: 300,
      clearLayout: null,
      ...noopHandlers,
    });
    const targets = container.querySelectorAll<HTMLButtonElement>("[data-gg-legend-target]");
    const first = targets.item(0);
    const second = targets.item(1);
    const firstLeft = first.offsetLeft;
    const firstRight = firstLeft + first.offsetWidth;
    const secondLeft = second.offsetLeft;
    // No dead strip between neighbouring keys in a row.
    expect(firstRight).toBeCloseTo(secondLeft);
    // Both keys stay inside their own target.
    expect(firstLeft).toBeLessThanOrEqual(horizontal.x + horizontal.entries[0].x + 4);
    expect(secondLeft).toBeLessThanOrEqual(horizontal.x + horizontal.entries[1].x + 4);
    expect(secondLeft + second.offsetWidth).toBeCloseTo(horizontal.x + horizontal.width);
  });

  it("stops vertical hit targets before a right-hand title", () => {
    const rightTitle = {
      ...discreteFill,
      titleHeight: 0,
      titleX: 120,
      width: 180,
      entries: [{ ...webEntry, x: 0, y: 4, height: 24 }],
    };
    const rightEntries: InteractiveLegendEntry[] = [
      {
        legend: rightTitle,
        entry: rightTitle.entries[0],
        identity: { scale: "fill", entryIndex: 0 },
      },
    ];
    const { container } = render(LegendTargets, {
      entries: rightEntries,
      sceneWidth: 400,
      sceneHeight: 300,
      clearLayout: null,
      ...noopHandlers,
    });
    const target = container.querySelector<HTMLButtonElement>("[data-gg-legend-target]")!;
    expect(target.style.left).toBe("100px");
    expect(target.style.width).toBe("120px");
  });

  it("stops a row-ending horizontal target at a right-hand title", () => {
    const horizontal = {
      ...discreteFill,
      direction: "horizontal" as const,
      titleHeight: 0,
      titleX: 150,
      width: 180,
      entries: [
        { ...webEntry, x: 0, y: 18 },
        { ...storeEntry, x: 80, y: 18 },
      ],
    };
    const horizontalEntries: InteractiveLegendEntry[] = horizontal.entries.map((entry, index) => ({
      legend: horizontal,
      entry,
      identity: { scale: "fill", entryIndex: index },
    }));
    const { container } = render(LegendTargets, {
      entries: horizontalEntries,
      sceneWidth: 400,
      sceneHeight: 300,
      clearLayout: null,
      ...noopHandlers,
    });
    const targets = container.querySelectorAll<HTMLButtonElement>("[data-gg-legend-target]");
    expect(targets.item(1)?.style.left).toBe("180px");
    expect(targets.item(1)?.style.width).toBe("70px");
  });

  it("wires preview enter for non-touch pointers", () => {
    const onPreviewIndex = vi.fn();
    const { container } = render(LegendTargets, {
      entries,
      sceneWidth: 400,
      sceneHeight: 300,
      clearLayout: null,
      ...noopHandlers,
      onPreviewIndex,
    });
    const targets = container.querySelectorAll<HTMLButtonElement>("[data-gg-legend-target]");
    const first = targets.item(0);
    expect(first).not.toBeNull();
    first?.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true, pointerType: "mouse" }));
    expect(onPreviewIndex).toHaveBeenCalledWith(0, "pointer");
  });
});
