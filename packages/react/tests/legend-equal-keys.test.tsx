import { describe, expect, it } from "vitest";
import { act } from "react";
import { fireEvent, render } from "@testing-library/react";

import { createPlotInteraction, GGPlot, GeomPoint, GuideLegend } from "../src/index.js";

const scope = { keys: "plot", x: "x", y: "y" };

// Columns `a` and `b` split the rows the same way, so entries g1 and h1 have equal row keys.
const data = Array.from({ length: 12 }, (_, i) => ({
  id: `r${i}`,
  x: i,
  y: i,
  a: `g${i % 3}`,
  b: `h${i % 3}`,
}));

const chart = (interaction?: ReturnType<typeof createPlotInteraction>) => (
  <GGPlot
    data={data}
    aes={{ x: "x", y: "y", color: "a", shape: "b" }}
    width={600}
    height={400}
    identity="id"
    interaction={interaction}
    interactionScope={interaction === undefined ? undefined : scope}
    legendFocus
  >
    <GeomPoint />
    <GuideLegend channel="color" focus />
    <GuideLegend channel="shape" focus />
  </GGPlot>
);

const pressed = (container: HTMLElement) =>
  [...container.querySelectorAll('[aria-pressed="true"]')].map(
    (target) => /[gh]\d/.exec(target.getAttribute("aria-label") ?? "")?.[0],
  );

describe("legends whose entries have equal row keys", () => {
  it("presses the clicked entry of the second legend", () => {
    const view = render(chart());
    fireEvent.click(view.getByRole("button", { name: /h1 \(.*legend\)/ }));
    expect(pressed(view.container)).toEqual(["h1"]);
  });

  it("moves the press from the first legend to the second", () => {
    const view = render(chart());
    fireEvent.click(view.getByRole("button", { name: /g1 \(.*legend\)/ }));
    expect(pressed(view.container)).toEqual(["g1"]);
    fireEvent.click(view.getByRole("button", { name: /h1 \(.*legend\)/ }));
    expect(pressed(view.container)).toEqual(["h1"]);
  });

  it("clears the pressed entry when it is clicked again", () => {
    const view = render(chart());
    const button = () => view.getByRole("button", { name: /h1 \(.*legend\)/ });
    fireEvent.click(button());
    fireEvent.click(button());
    expect(pressed(view.container)).toEqual([]);
  });

  it("presses no entry when only controller keys match two entries", () => {
    const interaction = createPlotInteraction();
    const view = render(chart(interaction));
    act(() => {
      interaction.setEmphasis(["r1", "r4", "r7", "r10"], {
        scope,
        source: "programmatic",
      });
    });
    expect(pressed(view.container)).toEqual([]);
  });
});
