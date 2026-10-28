import { fromAny } from "@total-typescript/shoehorn";
import { expect, test } from "vitest";

import GGPlot from "../../src/lib/GGPlot.svelte";
import "../../src/lib/host-init.js";
import type { LegendFilterEvent } from "../../src/lib/legend/filter.js";
import { render } from "../helpers/render.js";
import { until } from "../helpers/until.js";

test("disappeared filter values return visible while resetScales keeps active filters", async () => {
  let candidates = 0;
  const base = {
    aes: { x: "x", y: "y", color: "group" },
    layers: [{ geom: "point" as const }],
    legendFilter: true,
    width: 360,
    height: 260,
    onrender: (model: { candidates: { size: number } }) => {
      candidates = model.candidates.size;
    },
  };
  const both = [
    { x: 1, y: 1, group: "north" },
    { x: 2, y: 2, group: "south" },
  ];
  const view = render(GGPlot, { ...base, data: both });
  await until(() => view.container.querySelectorAll(".gg-legend-filters input").length === 2);
  view.container.querySelector<HTMLInputElement>("input[aria-label='Show north']")!.click();
  await until(() => candidates === 1);

  await view.rerender({ ...base, data: [both[1]] });
  await until(() => view.container.querySelectorAll(".gg-legend-filters input").length === 1);
  await view.rerender({ ...base, data: both });
  await until(() => view.container.querySelectorAll(".gg-legend-filters input").length === 2);
  expect(
    view.container.querySelector<HTMLInputElement>("input[aria-label='Show north']")!.checked,
  ).toBe(true);
  expect(candidates).toBe(2);

  view.container.querySelector<HTMLInputElement>("input[aria-label='Show south']")!.click();
  await until(() => candidates === 1);
  fromAny<{ component: { resetScales(): void } }>(view).component.resetScales();
  await until(() => candidates === 1);
  expect(
    view.container.querySelector<HTMLInputElement>("input[aria-label='Show south']")!.checked,
  ).toBe(false);
});

test("explicit layer aes null clears active filters instead of silently filtering", async () => {
  let candidates = 0;
  const events: LegendFilterEvent[] = [];
  const both = [
    { x: 1, y: 1, group: "north" },
    { x: 2, y: 2, group: "south" },
  ];
  const base = {
    aes: { x: "x", y: "y", color: "group" },
    layers: [{ geom: "point" as const }],
    legendFilter: true,
    width: 360,
    height: 260,
    onrender: (model: { candidates: { size: number } }) => {
      candidates = model.candidates.size;
    },
    onlegendfilter: (event: LegendFilterEvent) => {
      events.push(event);
    },
  };
  const view = render(GGPlot, { ...base, data: both });
  await until(() => view.container.querySelectorAll(".gg-legend-filters input").length === 2);
  view.container.querySelector<HTMLInputElement>("input[aria-label='Show north']")!.click();
  await until(() => candidates === 1);

  // The layer explicitly unsets color (null-unset semantics): the old global
  // binding is gone, so the active filter must clear rather than keep
  // filtering rows with no visible legend control.
  await view.rerender({
    ...base,
    data: both,
    layers: [{ geom: "point" as const, aes: { color: null } }],
  });
  await until(() => events.some((event) => event.phase === "clear"));
  await until(() => candidates === 2);
});

test("a legend that stops being filterable clears its active filter", async () => {
  let candidates = 0;
  const events: LegendFilterEvent[] = [];
  const both = [
    { x: 1, y: 1, group: "north" },
    { x: 2, y: 2, group: "south" },
  ];
  const base = {
    aes: { x: "x", y: "y", color: "group" },
    layers: [{ geom: "point" as const }],
    legendFilter: true,
    width: 360,
    height: 260,
    onrender: (model: { candidates: { size: number } }) => {
      candidates = model.candidates.size;
    },
    onlegendfilter: (event: LegendFilterEvent) => {
      events.push(event);
    },
  };
  const view = render(GGPlot, { ...base, data: both });
  await until(() => view.container.querySelectorAll(".gg-legend-filters input").length === 2);
  view.container.querySelector<HTMLInputElement>("input[aria-label='Show north']")!.click();
  await until(() => candidates === 1);

  // A scaled constant joins the color legend: the fieldset disappears, so
  // the active clause must clear instead of filtering rows with no visible
  // checkbox or reset control left. The field binding itself stays mapped.
  await view.rerender({
    ...base,
    data: both,
    layers: [
      { geom: "point" as const },
      {
        geom: "line" as const,
        aes: { x: "x", y: "y", color: { value: "reference", scale: true } },
      },
    ],
  });
  await until(() => events.some((event) => event.phase === "remove"));
  expect(view.container.querySelector(".gg-legend-filters")).toBeNull();
  const removed = events.find((event) => event.phase === "remove")!;
  expect(removed.clause).toMatchObject({ scale: "color", field: "group" });
  // Both point rows render again once the orphaned clause is gone.
  await until(() => candidates >= 3);
});

test("include reconciliation reports clause removal instead of an empty include change", async () => {
  let candidates = 0;
  const events: LegendFilterEvent[] = [];
  const both = [
    { x: 1, y: 1, group: "north" },
    { x: 2, y: 2, group: "south" },
  ];
  const base = {
    aes: { x: "x", y: "y", color: "group" },
    layers: [{ geom: "point" as const }],
    legendFilter: { mode: "include" as const },
    width: 360,
    height: 260,
    onrender: (model: { candidates: { size: number } }) => {
      candidates = model.candidates.size;
    },
    onlegendfilter: (event: LegendFilterEvent) => {
      events.push(event);
    },
  };
  const view = render(GGPlot, { ...base, data: both });
  await until(() => view.container.querySelectorAll(".gg-legend-filters input").length === 2);
  view.container.querySelector<HTMLInputElement>("input[aria-label='Show south']")?.click();
  await until(() => candidates === 1 && events.length === 1);

  await view.rerender({ ...base, data: [both[1]] });
  await until(() => events.some((event) => event.phase === "remove"));
  expect(candidates).toBe(1);
  expect(events.at(-1)).toEqual({
    type: "legend-filter",
    phase: "remove",
    source: "programmatic",
    clause: {
      scale: "color",
      field: "group",
      values: [],
      mode: "include",
    },
  });
});
