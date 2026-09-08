import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";

import { PlotControls } from "../src/plot-controls.js";

afterEach(cleanup);

const defaults: ComponentProps<typeof PlotControls> = {
  tools: ["inspect", "point", "select-area", "zoom-area"],
  activeTool: "inspect",
  onToolChange: () => {},
  canResetZoom: false,
  onResetZoom: () => {},
  canClearSelection: false,
  onClearSelection: () => {},
  canClearIntervals: false,
  onClearIntervals: () => {},
  boundsInputs: [
    {
      panelId: "panel-0",
      input: {
        axis: "x",
        action: "zoom",
        scale: "linear",
        transform: "log10",
        bounds: [1, 10],
      },
    },
  ],
  onApplyBounds: () => {},
};

describe("React plot controls", () => {
  it("keeps invalid bounds in the editor, then applies corrected bounds once and returns focus", async () => {
    const apply = vi.fn(() => {});
    const view = render(<PlotControls {...defaults} onApplyBounds={apply} />);
    const trigger = view.getByRole("button", { name: "Set x zoom bounds" });
    fireEvent.click(trigger);
    const lower = view.getByLabelText("Lower bound");
    const upper = view.getByLabelText("Upper bound");
    expect(document.activeElement).toBe(lower);
    expect(view.getByRole("group", { name: "Edit horizontal zoom bounds" })).toBeTruthy();
    expect(getComputedStyle(lower).minHeight).toBe("44px");
    fireEvent.change(lower, { target: { value: "0" } });
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole("button", { name: "Apply" }));
    expect(apply).not.toHaveBeenCalled();
    expect(lower.getAttribute("aria-invalid")).toBe("true");
    const error = view.getByRole("alert");
    expect(error.textContent).toContain("greater than zero");
    expect(lower.getAttribute("aria-describedby")).toContain(error.id);
    expect(document.activeElement).toBe(lower);
    fireEvent.change(lower, { target: { value: "2" } });
    fireEvent.change(upper, { target: { value: "8" } });
    fireEvent.pointerDown(view.getByRole("button", { name: "Apply" }), { pointerType: "touch" });
    fireEvent.click(view.getByRole("button", { name: "Apply" }));
    expect(apply).toHaveBeenCalledExactlyOnceWith("panel-0", {
      source: "precise-bounds",
      inputSource: "touch",
      action: "zoom",
      axis: "x",
      scale: "linear",
      transform: "log10",
      bounds: [2, 8],
      reversed: false,
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(view.queryByLabelText("Lower bound")).toBeNull();
  });

  it("opens with Enter, cancels with Escape, and discards the draft", async () => {
    const apply = vi.fn(() => {});
    const view = render(<PlotControls {...defaults} onApplyBounds={apply} />);
    const trigger = view.getByRole("button", { name: "Set x zoom bounds" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const lower = view.getByLabelText("Lower bound");
    expect(document.activeElement).toBe(lower);
    fireEvent.change(lower, { target: { value: "4" } });
    await userEvent.keyboard("{Escape}");
    expect(view.queryByLabelText("Lower bound")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(apply).not.toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    expect(view.getByLabelText("Lower bound").getAttribute("value")).toBe("1");
    fireEvent.click(view.getByRole("button", { name: "Cancel" }));
    expect(document.activeElement).toBe(trigger);
  });

  it("uses month-day text and native category selects without losing typed categories", () => {
    const apply = vi.fn(() => {});
    const view = render(
      <PlotControls
        {...defaults}
        onApplyBounds={apply}
        boundsInputs={[
          {
            panelId: "time",
            input: {
              axis: "y",
              action: "select",
              scale: "time",
              temporalKind: "monthDay",
              bounds: [Date.UTC(2000, 3, 1), Date.UTC(2000, 4, 10)],
            },
          },
          {
            panelId: "category",
            input: {
              axis: "x",
              action: "select",
              scale: "band",
              bounds: [1, "1"],
              categories: [
                { value: 1, label: "1 (number)" },
                { value: "1", label: "1 (string)" },
              ],
            },
          },
        ]}
      />,
    );
    fireEvent.click(view.getByRole("button", { name: "Set y selection bounds: time" }));
    expect(view.getByLabelText("Lower bound").getAttribute("value")).toBe("04-01");
    expect(view.getByLabelText("Upper bound").getAttribute("value")).toBe("05-10");
    expect(view.getByText(/Enter a month-day/)).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Set x selection bounds: category" }));
    expect(view.getAllByRole("combobox")).toHaveLength(2);
    fireEvent.click(view.getByRole("button", { name: "Apply" }));
    expect(apply).toHaveBeenCalledExactlyOnceWith(
      "category",
      expect.objectContaining({
        scale: "band",
        bounds: [1, "1"],
        inputSource: "keyboard",
      }),
    );
  });

  it("resets a stale draft when committed bounds change and exposes native recovery buttons", async () => {
    const changeTool = vi.fn(() => {});
    const reset = vi.fn(() => {});
    const clearPoints = vi.fn(() => {});
    const clearIntervals = vi.fn(() => {});
    const props = {
      ...defaults,
      onToolChange: changeTool,
      canResetZoom: true,
      onResetZoom: reset,
      canClearSelection: true,
      onClearSelection: clearPoints,
      canClearIntervals: true,
      onClearIntervals: clearIntervals,
    };
    const view = render(<PlotControls {...props} />);
    expect(view.getByRole("button", { name: "Inspect" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(view.getByRole("button", { name: "Select area" }));
    expect(changeTool).toHaveBeenCalledExactlyOnceWith("select-area");
    fireEvent.click(view.getByRole("button", { name: "Reset zoom" }));
    fireEvent.click(view.getByRole("button", { name: "Clear selection" }));
    fireEvent.click(view.getByRole("button", { name: "Clear all selections" }));
    expect(reset).toHaveBeenCalledOnce();
    expect(clearPoints).toHaveBeenCalledOnce();
    expect(clearIntervals).toHaveBeenCalledOnce();
    fireEvent.click(view.getByRole("button", { name: "Set x zoom bounds" }));
    fireEvent.change(view.getByLabelText("Lower bound"), { target: { value: "3" } });
    view.rerender(
      <PlotControls
        {...props}
        boundsInputs={[
          {
            panelId: "panel-0",
            input: {
              axis: "x",
              action: "zoom",
              scale: "linear",
              transform: "identity",
              bounds: [10, 20],
            },
          },
        ]}
      />,
    );
    await waitFor(() => {
      expect(view.getByLabelText<HTMLInputElement>("Lower bound").value).toBe("10");
      expect(view.getByLabelText<HTMLInputElement>("Upper bound").value).toBe("20");
    });
  });
});
