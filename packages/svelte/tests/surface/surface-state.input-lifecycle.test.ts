/**
 * createSurfaceState pointer/keyboard/touch input lifecycle.
 */
import { flushSync } from "svelte";
import { describe, expect, it, vi } from "vitest";

import type { CandidateFacts } from "@ggts-sh/core";

import { TOUCH_INSPECT_CLICK_SUPPRESS_MS } from "../../src/lib/surface/pointer.js";
import {
  firstCandidate,
  secondCandidate,
  pointerEvent,
  panelCenterClient,
  mountSurfaceComposite,
  normalizeInteractionConfig,
} from "./surface-state.harness.js";

describe("createSurfaceState onPointerLeave", () => {
  it("leave clears transient inspection and queues via the deferred microtask", async () => {
    const h = mountSurfaceComposite({ registerEffects: false });
    const candidate = firstCandidate(h.model);
    h.inspection.setInspection(candidate, "pointer", "transient", "xy");
    flushSync();
    expect(h.inspection.inspection).not.toBeNull();

    h.surface.onPointerLeave();
    // The clear is microtask-deferred (evaluates post-flush state).
    await Promise.resolve();
    flushSync();
    expect(h.inspection.inspection).toBeNull();

    h.destroy();
  });

  it("leave while brushing keeps the draft and inspection teardown does not run", async () => {
    const h = mountSurfaceComposite();
    h.surface.chooseTool("select-area");
    flushSync();
    const start = panelCenterClient(h.model);
    h.surface.onPointerDown(
      pointerEvent("pointerdown", h.capture, { clientX: start.x, clientY: start.y }),
    );
    flushSync();
    expect(h.surface.brushRect).not.toBeNull();

    h.surface.onPointerLeave();
    await Promise.resolve();
    flushSync();
    // Brushing gates the leave-clear: draft survives.
    expect(h.surface.brushRect).not.toBeNull();

    h.destroy();
  });
});

describe("createSurfaceState keyboard surface", () => {
  it("ArrowRight moves the inspection anchor to a candidate with greater x", () => {
    const h = mountSurfaceComposite({ registerEffects: false });
    // Seed on the LEFTMOST candidate so a +x directional pick must move.
    let leftmost: CandidateFacts | null = null;
    for (let id = 0; id < h.model.candidates.size; id++) {
      const c = h.model.candidates.candidate(id);
      if (c !== null && (leftmost === null || c.x < leftmost.x)) leftmost = c;
    }
    if (leftmost === null) throw new Error("expected candidates");
    h.inspection.setInspection(leftmost, "keyboard", "transient", "xy");
    flushSync();
    const before = h.inspection.inspection?.focus.anchor;
    expect(before).toBeDefined();

    h.surface.onSurfaceKeyDown(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    flushSync();
    const after = h.inspection.inspection?.focus.anchor;
    expect(after).toBeDefined();
    // Discriminating: dropping the navigate-direction route would leave the
    // anchor unchanged; the directional pick from the leftmost point must
    // land on a strictly greater x.
    expect(after!.x).toBeGreaterThan(before!.x);
    h.destroy();
  });

  it("Enter/Space pin when inspect tool has pin; Escape dismisses and clears brush draft", () => {
    const h = mountSurfaceComposite({ registerEffects: false });
    const candidate = firstCandidate(h.model);
    h.inspection.setInspection(candidate, "keyboard", "transient", "xy");
    flushSync();

    h.surface.onSurfaceKeyDown(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    flushSync();
    expect(h.inspection.inspection?.state).toBe("pinned");

    // Brush draft + Escape while select-area clears draft via dismiss path.
    h.surface.chooseTool("select-area");
    flushSync();
    h.surface.onSurfaceKeyDown(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    flushSync();
    expect(h.surface.brushRect).not.toBeNull();

    h.surface.onSurfaceKeyDown(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    flushSync();
    expect(h.surface.brushRect).toBeNull();
    h.destroy();
  });

  it("point tool Enter toggles point keys via sink", () => {
    const config = normalizeInteractionConfig({
      inspect: { pin: true },
      select: { type: "point" },
    });
    const h = mountSurfaceComposite({
      interactionConfig: config,
      registerEffects: false,
    });
    h.surface.chooseTool("point");
    flushSync();
    const candidate = firstCandidate(h.model);
    h.inspection.setInspection(candidate, "keyboard", "transient", "xy");
    flushSync();
    h.toggleCalls.length = 0;
    h.surface.onSurfaceKeyDown(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    flushSync();
    expect(h.toggleCalls.length).toBeGreaterThan(0);
    expect(h.toggleCalls[0]?.source).toBe("keyboard");
    h.destroy();
  });
});

describe("createSurfaceState onSurfaceBlur", () => {
  it("inside-root refocus keeps inspection; genuine blur splits pinned vs transient", () => {
    const h = mountSurfaceComposite({ registerEffects: false });
    const candidate = firstCandidate(h.model);

    // Transient inspection
    h.inspection.setInspection(candidate, "pointer", "transient", "xy");
    flushSync();
    expect(h.inspection.inspection?.state).toBe("transient");

    // Inside-root relatedTarget → ignore
    const inside = document.createElement("button");
    h.root.append(inside);
    const keepEvent = new FocusEvent("blur", {
      bubbles: true,
      relatedTarget: inside,
    });
    h.surface.onSurfaceBlur(keepEvent);
    flushSync();
    expect(h.inspection.inspection?.state).toBe("transient");

    // Genuine blur + transient → clear
    h.surface.onSurfaceBlur(new FocusEvent("blur", { bubbles: true, relatedTarget: null }));
    flushSync();
    expect(h.inspection.inspection).toBeNull();

    // Pinned survives genuine blur
    h.inspection.setInspection(candidate, "pointer", "transient", "xy");
    flushSync();
    h.inspection.toggleInspectionPin("keyboard");
    flushSync();
    expect(h.inspection.inspection?.state).toBe("pinned");
    h.surface.onSurfaceBlur(new FocusEvent("blur", { bubbles: true, relatedTarget: null }));
    flushSync();
    expect(h.inspection.inspection?.state).toBe("pinned");

    h.destroy();
  });
});

describe("createSurfaceState touch inspect path", () => {
  it("touch tap pins/inspects and suppressClickUntil gates capture click", () => {
    const h = mountSurfaceComposite({ registerEffects: false });
    const candidate = firstCandidate(h.model);
    const point = { x: candidate.x, y: candidate.y };

    vi.spyOn(performance, "now").mockReturnValue(1000);

    h.surface.onPointerDown(
      pointerEvent("pointerdown", h.capture, {
        clientX: point.x,
        clientY: point.y,
        pointerType: "touch",
      }),
    );
    flushSync();
    h.surface.onPointerUp(
      pointerEvent("pointerup", h.capture, {
        clientX: point.x,
        clientY: point.y,
        pointerType: "touch",
      }),
    );
    flushSync();
    expect(h.inspection.inspection).not.toBeNull();
    const stateBefore = h.inspection.inspection?.state;

    // Within suppress window → capture click is suppressed (no pin toggle flip).
    // Single call: a prior suppress branch zeros suppressClickUntil.
    vi.spyOn(performance, "now").mockReturnValue(1000 + TOUCH_INSPECT_CLICK_SUPPRESS_MS - 1);
    const click = new MouseEvent("click", {
      bubbles: true,
      clientX: point.x,
      clientY: point.y,
    });
    Object.defineProperty(click, "currentTarget", { value: h.capture });
    h.surface.onCaptureClick(click);
    flushSync();
    expect(h.inspection.inspection?.state).toBe(stateBefore);

    vi.restoreAllMocks();
    h.destroy();
  });

  it("touch drag past the sticky threshold cancels the tap-inspect (drag-ignore)", () => {
    const h = mountSurfaceComposite({ registerEffects: false });
    const candidate = firstCandidate(h.model);
    const start = { x: candidate.x, y: candidate.y };

    h.surface.onPointerDown(
      pointerEvent("pointerdown", h.capture, {
        clientX: start.x,
        clientY: start.y,
        pointerType: "touch",
      }),
    );
    flushSync();
    // Drag far beyond any sticky threshold before lifting.
    h.surface.onPointerMove(
      pointerEvent("pointermove", h.capture, {
        clientX: start.x + 60,
        clientY: start.y + 60,
        pointerType: "touch",
      }),
    );
    flushSync();
    h.surface.onPointerUp(
      pointerEvent("pointerup", h.capture, {
        clientX: start.x + 60,
        clientY: start.y + 60,
        pointerType: "touch",
      }),
    );
    flushSync();
    // Drag-ignore: the moved touch must NOT commit an inspection.
    expect(h.inspection.inspection).toBeNull();

    h.destroy();
  });
});

describe("createSurfaceState pointer cancel vs lost capture", () => {
  it("cancel clears queued inspection + brush draft but preserves pending pinned stash", () => {
    const h = mountSurfaceComposite({ registerEffects: false });
    const first = firstCandidate(h.model);
    const second = secondCandidate(h.model, first.id);

    h.inspection.setInspection(first, "pointer", "transient", "xy");
    flushSync();
    h.inspection.toggleInspectionPin("pointer");
    flushSync();
    expect(h.inspection.inspection?.state).toBe("pinned");

    // Stash pending via intentful schedule while pinned.
    h.inspection.schedulePointerInspect({
      point: { x: second.x, y: second.y },
      source: "pointer",
      mode: "xy",
      maxDistance: 1e6,
    });
    h.flushFrames();
    flushSync();
    expect(h.inspection.inspection?.state).toBe("pinned");

    // Begin a brush draft, then cancel.
    h.surface.chooseTool("select-area");
    flushSync();
    const start = panelCenterClient(h.model);
    h.surface.onPointerDown(
      pointerEvent("pointerdown", h.capture, { clientX: start.x, clientY: start.y }),
    );
    flushSync();
    expect(h.surface.brushRect).not.toBeNull();

    h.surface.onPointerCancel();
    flushSync();
    expect(h.surface.brushRect).toBeNull();
    // Pending survives cancel: restore-pending discriminator on unpin.
    h.inspection.toggleInspectionPin("keyboard");
    flushSync();
    expect(h.inspection.inspection?.state).toBe("transient");
    expect(h.inspection.inspection?.focus.anchor).toEqual({
      x: second.x,
      y: second.y,
    });

    h.destroy();
  });

  it("lost capture cancels area/draft plan only — does not clear inspection queues", () => {
    const h = mountSurfaceComposite({ registerEffects: false });
    const first = firstCandidate(h.model);
    const second = secondCandidate(h.model, first.id);

    h.inspection.setInspection(first, "pointer", "transient", "xy");
    flushSync();
    h.inspection.toggleInspectionPin("pointer");
    flushSync();

    h.inspection.schedulePointerInspect({
      point: { x: second.x, y: second.y },
      source: "pointer",
      mode: "xy",
      maxDistance: 1e6,
    });
    h.flushFrames();
    flushSync();

    h.surface.chooseTool("select-area");
    flushSync();
    const start = panelCenterClient(h.model);
    h.surface.onPointerDown(
      pointerEvent("pointerdown", h.capture, { clientX: start.x, clientY: start.y }),
    );
    flushSync();
    expect(h.surface.brushRect).not.toBeNull();
    // Advance to dragging so lost-capture takes cancel-clear-draft (first-corner keeps draft).
    h.surface.onPointerMove(
      pointerEvent("pointermove", h.capture, {
        clientX: start.x + 20,
        clientY: start.y + 15,
      }),
    );
    h.flushFrames();
    flushSync();
    expect(h.surface.reducer.state.area.kind).toBe("dragging");

    h.surface.onLostPointerCapture();
    flushSync();
    // Draft cleared (dragging → cancel-clear-draft).
    expect(h.surface.brushRect).toBeNull();
    // Pending still restorable (queues untouched by lost capture).
    h.inspection.toggleInspectionPin("keyboard");
    flushSync();
    expect(h.inspection.inspection?.state).toBe("transient");
    expect(h.inspection.inspection?.focus.anchor).toEqual({
      x: second.x,
      y: second.y,
    });

    h.destroy();
  });

  it("lost capture while idle is a no-op (ignore branch)", () => {
    const h = mountSurfaceComposite({ registerEffects: false });
    expect(h.surface.reducer.state.area.kind).toBe("idle");
    expect(h.surface.brushRect).toBeNull();
    h.surface.onLostPointerCapture();
    flushSync();
    expect(h.surface.reducer.state.area.kind).toBe("idle");
    expect(h.surface.brushRect).toBeNull();
    h.destroy();
  });

  it("non-primary pointerdown and non-inspect move take the none action paths", () => {
    const h = mountSurfaceComposite({ registerEffects: false });
    h.surface.chooseTool("select-area");
    flushSync();
    const start = panelCenterClient(h.model);

    // Right-click must not begin a brush.
    h.surface.onPointerDown(
      pointerEvent("pointerdown", h.capture, {
        clientX: start.x,
        clientY: start.y,
        button: 2,
      }),
    );
    flushSync();
    expect(h.surface.brushRect).toBeNull();
    expect(h.surface.reducer.state.area.kind).toBe("idle");

    // Move while select-area (not brushing) queues nothing.
    h.surface.onPointerMove(
      pointerEvent("pointermove", h.capture, {
        clientX: start.x + 5,
        clientY: start.y + 5,
      }),
    );
    h.flushFrames();
    flushSync();
    expect(h.surface.brushRect).toBeNull();
    expect(h.inspection.inspection).toBeNull();
    h.destroy();
  });

  it("capture click on point tool with no nearby candidate is a no-op", () => {
    const config = normalizeInteractionConfig({
      inspect: true,
      select: { type: "point" },
    });
    const h = mountSurfaceComposite({
      interactionConfig: config,
      registerEffects: false,
    });
    h.surface.chooseTool("point");
    flushSync();
    expect(h.surface.activeTool).toBe("point");
    // Far outside the plot — nearest lookup must miss.
    const click = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      clientX: -1000,
      clientY: -1000,
    });
    Object.defineProperty(click, "currentTarget", { value: h.capture, configurable: true });
    h.surface.onCaptureClick(click);
    flushSync();
    expect(h.toggleCalls).toEqual([]);
    h.destroy();
  });
});

describe("createSurfaceState pointer-capture failure", () => {
  it("begin-area and start event still commit when setPointerCapture throws", () => {
    const h = mountSurfaceComposite({ registerEffects: false });
    h.surface.chooseTool("select-area");
    flushSync();

    const start = panelCenterClient(h.model);
    const target = h.capture;
    target.setPointerCapture = () => {
      throw new Error("synthetic capture failure");
    };

    h.surface.onPointerDown(
      pointerEvent("pointerdown", target, { clientX: start.x, clientY: start.y }),
    );
    flushSync();
    expect(h.surface.brushRect).not.toBeNull();
    expect(h.surface.reducer.state.area.kind).not.toBe("idle");
    expect(h.selectionEvents.map((e) => e.phase)).toEqual(["start"]);
    h.destroy();
  });
});
