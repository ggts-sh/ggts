import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";

import ChocolateTrend from "../../../examples/smooth/loess-scatter/Example.js";
import PenguinInspection from "../../../examples/interaction/tooltip/Example.js";
import LinkedPenguins from "../../../examples/interaction/linked-views/Example.js";
import LegendComparison from "../../../examples/interaction/legend-filter/Example.js";
import SelectAndZoom from "../../../examples/interaction/brush-zoom/Example.js";
import ChestSizeColumns from "../../../examples/col/basic/Example.js";
import MichelsonHistogram from "../../../examples/histogram/basic/Example.js";
import GuerryScatter from "../../../examples/point/scatter-color/Example.js";
import EarthDensityThreshold from "../../../examples/hline/threshold/Example.js";
import ArmadaHorizontalBars from "../../../examples/bar/horizontal/Example.js";
import FastfoodJitter from "../../../examples/jitter/basic/Example.js";
import HalleyLifeTableArea from "../../../examples/area/basic/Example.js";
import EarthDensityCutoff from "../../../examples/vline/cutoff/Example.js";
import MichelsonFreqpoly from "../../../examples/freqpoly/basic/Example.js";

afterEach(cleanup);

describe("copyable React gallery examples", () => {
  it("renders the chocolate composition with points and a loess trend", async () => {
    const view = render(
      <div style={{ width: 800 }}>
        <ChocolateTrend />
      </div>,
    );
    await waitFor(() => {
      expect(view.container.querySelectorAll(".gg-points circle").length).toBeGreaterThan(100);
      expect(view.container.querySelectorAll(".gg-marks path").length).toBeGreaterThan(0);
    });
  });

  it("pins the custom inspection and runs its React button callback", async () => {
    const view = render(
      <div style={{ width: 800 }}>
        <PenguinInspection />
      </div>,
    );
    const capture = await view.findByRole("group", {
      name: "Inspect penguins by flipper length and body mass",
    });
    fireEvent.focus(capture);
    fireEvent.keyDown(capture, { key: "Home" });
    fireEvent.keyDown(capture, { key: "Enter" });
    const remember = await view.findByRole("button", { name: "Remember this penguin" });
    fireEvent.click(remember);
    expect(view.getByText(/Remembered penguin:/)).toBeTruthy();
  });

  it("links both charts and the table, then reconciles removed rows", async () => {
    const view = render(
      <div style={{ width: 1000 }}>
        <LinkedPenguins />
      </div>,
    );
    await waitFor(() => {
      expect(view.container.querySelectorAll(".gg-points circle")).toHaveLength(30);
    });
    fireEvent.click(view.getByRole("button", { name: "Select Gentoo" }));
    expect(view.getByText("5 penguins selected across both views")).toBeTruthy();
    expect(view.getAllByRole("button", { name: "Selected" })).toHaveLength(5);
    await waitFor(() => {
      const plots = view.container.querySelectorAll(".gg-plot-root");
      for (const plot of plots) {
        const marks = plot.querySelectorAll<SVGElement>(".gg-points circle");
        expect([...marks].filter((mark) => mark.style.opacity !== "")).toHaveLength(10);
      }
    });
    fireEvent.click(view.getByRole("button", { name: "Remove Chinstrap rows" }));
    await waitFor(() => {
      expect(view.container.querySelectorAll(".gg-points circle")).toHaveLength(20);
    });
    expect(view.getByText("5 penguins selected across both views")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Clear linked selection" }));
    expect(view.getByText("0 penguins selected across both views")).toBeTruthy();
  });

  it("filters Playfair's rows and switches to focus without losing a series", async () => {
    const view = render(
      <div style={{ width: 800 }}>
        <LegendComparison />
      </div>,
    );
    const showDebt = await view.findByRole("checkbox", { name: "Show National debt" });
    const count = view.container.querySelectorAll(".gg-points circle").length;
    fireEvent.click(showDebt);
    await waitFor(() => {
      expect(view.container.querySelectorAll(".gg-points circle").length).toBeLessThan(count);
    });
    fireEvent.click(view.getByRole("radio", { name: "Focus a series" }));
    const focusDebt = await view.findByRole("button", { name: /National debt \(.*legend\)/ });
    await waitFor(() => {
      expect(view.container.querySelectorAll(".gg-points circle")).toHaveLength(count);
    });
    fireEvent.click(focusDebt);
    expect(focusDebt.getAttribute("aria-pressed")).toBe("true");
  });

  it("commits precise interval and zoom bounds through the gallery callbacks", async () => {
    const view = render(
      <div style={{ width: 800 }}>
        <SelectAndZoom />
      </div>,
    );
    fireEvent.click(await view.findByRole("button", { name: "Set x selection bounds" }));
    fireEvent.change(view.getByLabelText("Lower bound"), { target: { value: "40" } });
    fireEvent.change(view.getByLabelText("Upper bound"), { target: { value: "50" } });
    fireEvent.click(view.getByRole("button", { name: "Apply" }));
    await view.findByText(/penguins selected \(keyboard\)/);
    fireEvent.click(view.getByRole("button", { name: "Set x zoom bounds" }));
    fireEvent.change(view.getByLabelText("Lower bound"), { target: { value: "40" } });
    fireEvent.change(view.getByLabelText("Upper bound"), { target: { value: "50" } });
    fireEvent.click(view.getByRole("button", { name: "Apply" }));
    await view.findByText(/Zoom applied \(keyboard\)/);
    fireEvent.click(view.getByRole("button", { name: "Reset zoom" }));
    await view.findByText("Zoom reset.");
  });

  it("renders chest-size columns from the authored React host", async () => {
    const view = render(
      <div style={{ width: 640 }}>
        <ChestSizeColumns />
      </div>,
    );
    await waitFor(() => {
      expect(view.container.querySelectorAll(".gg-rects rect").length).toBeGreaterThan(10);
    });
    expect(view.container.textContent).toContain("Counts across ordered chest sizes");
    // Regression: inspect-only charts must not overlay an Inspect tool rail
    // (Svelte hides a single-tool rail; React used to paint it over the title).
    expect(view.queryByRole("group", { name: "Chart interaction tools" })).toBeNull();
  });

  it("renders the Michelson histogram from the authored React host", async () => {
    const view = render(
      <div style={{ width: 640 }}>
        <MichelsonHistogram />
      </div>,
    );
    await waitFor(() => {
      expect(view.container.querySelectorAll(".gg-rects rect").length).toBeGreaterThan(4);
    });
    expect(view.container.textContent).toContain("Histogram of a hundred experimental runs");
  });

  it("renders the Guerry scatter from the authored React host", async () => {
    const view = render(
      <div style={{ width: 640 }}>
        <GuerryScatter />
      </div>,
    );
    await waitFor(() => {
      expect(view.container.querySelectorAll(".gg-points circle").length).toBeGreaterThan(20);
    });
    expect(view.container.textContent).toContain("Two measures coloured by region");
  });

  it("renders the earth-density threshold from the authored React host", async () => {
    const view = render(
      <div style={{ width: 640 }}>
        <EarthDensityThreshold />
      </div>,
    );
    await waitFor(() => {
      expect(view.container.querySelectorAll(".gg-points circle").length).toBeGreaterThan(10);
    });
    expect(view.container.textContent).toContain("One horizontal threshold");
  });

  it("renders flipped armada columns from the authored React host", async () => {
    const view = render(
      <div style={{ width: 640 }}>
        <ArmadaHorizontalBars />
      </div>,
    );
    await waitFor(() => {
      expect(view.container.querySelectorAll(".gg-rects rect").length).toBeGreaterThan(3);
    });
    expect(view.container.textContent).toContain("Category totals, flipped so labels read across");
  });

  it("renders jittered menu calories from the authored React host", async () => {
    const view = render(
      <div style={{ width: 640 }}>
        <FastfoodJitter />
      </div>,
    );
    await waitFor(() => {
      expect(view.container.querySelectorAll(".gg-points circle").length).toBeGreaterThan(20);
    });
    expect(view.container.textContent).toContain("Menu calories, spread so items do not stack");
  });

  it("renders the Halley life-table area from the authored React host", async () => {
    const view = render(
      <div style={{ width: 640 }}>
        <HalleyLifeTableArea />
      </div>,
    );
    await waitFor(() => {
      expect(view.container.querySelectorAll(".gg-marks path").length).toBeGreaterThan(0);
    });
    expect(view.container.textContent).toContain("Survivors from a cohort of one thousand");
  });

  it("renders the earth-density vertical cutoff from the authored React host", async () => {
    const view = render(
      <div style={{ width: 640 }}>
        <EarthDensityCutoff />
      </div>,
    );
    await waitFor(() => {
      expect(view.container.querySelectorAll(".gg-points circle").length).toBeGreaterThan(10);
    });
    expect(view.container.textContent).toContain("One vertical cutoff");
  });

  it("renders the Michelson frequency polygon from the authored React host", async () => {
    const view = render(
      <div style={{ width: 640 }}>
        <MichelsonFreqpoly />
      </div>,
    );
    await waitFor(() => {
      expect(view.container.querySelectorAll(".gg-marks path").length).toBeGreaterThan(0);
    });
    expect(view.container.textContent).toContain("Frequency polygon through bin centres");
  });
});
