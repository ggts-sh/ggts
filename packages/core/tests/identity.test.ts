import { describe, expect, it } from "bun:test";

import { LineageStore } from "../src/identity.ts";
import { createFacetPanelIdentity } from "../src/facet-identity.ts";
import { runPipeline } from "../src/pipeline.ts";

describe("LineageStore", () => {
  it("interns empty, singleton, and shared memberships", () => {
    const store = new LineageStore<string>();
    const empty = store.intern([]);
    const first = store.intern(["a"]);
    const firstAgain = store.intern(["a"]);
    const shared = store.intern(["a", "b", "a"]);
    const sharedAgain = store.intern(["b", "a"]);

    expect(empty).toBe(store.empty);
    expect(firstAgain).toBe(first);
    expect(sharedAgain).toBe(shared);
    expect(store.keys(shared)).toEqual(["a", "b"]);
    expect(store.count(shared)).toBe(2);
  });

  it("gives one ref to a singleton however it is interned", () => {
    const store = new LineageStore<number>();
    const viaFreshArray = store.intern([7]);
    const viaFrozenShared = store.intern(Object.freeze([7]));
    const viaFrozenAgain = store.intern(Object.freeze([7]));

    expect(viaFrozenShared).toBe(viaFreshArray);
    expect(viaFrozenAgain).toBe(viaFreshArray);
    expect(store.keys(viaFreshArray)).toEqual([7]);
    expect(store.count(viaFreshArray)).toBe(1);

    // Multi-element interning coexists and still dedupes by membership.
    const pair = store.intern([7, 9]);
    expect(store.intern([9, 7])).toBe(pair);
    expect(store.keys(pair)).toEqual([7, 9]);
  });
});

describe("pipeline semantic identity", () => {
  it("assigns semantic automatic inspection modes per layer before coord transforms", () => {
    const model = runPipeline(
      {
        data: {
          values: [
            { x: 1, y: 2 },
            { x: 2, y: 3 },
          ],
        },
        layers: [
          { geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } },
          { geom: "line", aes: { x: { field: "x" }, y: { field: "y" } } },
          { geom: "area", aes: { x: { field: "x" }, y: { field: "y" } } },
          { geom: "col", aes: { x: { field: "x" }, y: { field: "y" } } },
        ],
        coord: { type: "flip" },
      },
      { width: 400, height: 240 },
    );
    const modesByLayer = Array.from({ length: model.candidates.size }, (_, id) =>
      model.candidates.candidate(id),
    ).reduce<Record<number, Set<string>>>((modes, candidate) => {
      if (candidate !== null) (modes[candidate.layerIndex] ??= new Set()).add(candidate.autoMode);
      return modes;
    }, {});

    // Points default to exact (hover ring only); lines/areas keep axis modes (#754).
    expect([...modesByLayer[0]!]).toEqual(["exact"]);
    expect([...modesByLayer[1]!]).toEqual(["x"]);
    expect([...modesByLayer[2]!]).toEqual(["x"]);
    expect([...modesByLayer[3]!]).toEqual(["exact"]);

    const lineOnly = runPipeline(
      {
        data: {
          values: [
            { x: 1, y: 10 },
            { x: 2, y: 20 },
          ],
        },
        layers: [{ geom: "line", aes: { x: { field: "x" }, y: { field: "y" } } }],
        coord: { type: "flip" },
      },
      { width: 400, height: 240 },
    );
    const first = lineOnly.candidates.candidate(0)!;
    const second = lineOnly.candidates.candidate(1)!;
    expect(
      lineOnly.candidates.nearest(second.x, first.y, { mode: "auto", maxDistance: 1 }),
    ).toMatchObject({ id: 0, mode: "x" });
  });

  it("keeps rule inspection tied to its mapped semantic channel under coord flip", () => {
    const model = runPipeline(
      {
        data: { values: [{ x: 1, y: 2 }] },
        layers: [
          { geom: "rule", aes: { x: { field: "x" } } },
          { geom: "rule", aes: { y: { field: "y" } } },
        ],
        coord: { type: "flip" },
      },
      { width: 400, height: 240 },
    );

    expect(model.candidates.candidate(0)?.autoMode).toBe("x");
    expect(model.candidates.candidate(1)?.autoMode).toBe("y");

    const annotated = runPipeline(
      {
        data: { values: [{ unused: true }] },
        layers: [
          {
            geom: "rule",
            params: { xintercept: [1, 2], yintercept: [3] },
          },
        ],
      },
      { width: 400, height: 240 },
    );
    expect(
      Array.from(
        { length: annotated.candidates.size },
        (_, id) => annotated.candidates.candidate(id)?.autoMode,
      ),
    ).toEqual(["x", "x", "y"]);
    expect(annotated.candidates.candidate(0)?.xValue).toBe(1);
    expect(annotated.candidates.candidate(2)?.yValue).toBe(3);
    const yRule = annotated.candidates.candidate(2)!;
    expect(
      annotated.candidates.nearest(yRule.x, yRule.y, { mode: "auto", maxDistance: 1 }),
    ).toMatchObject({ id: 2, mode: "y" });
  });

  it("exposes semantic axis formatters for custom numeric and time labels", () => {
    const instant = "2025-07-14";
    const model = runPipeline(
      {
        data: { values: [{ x: 1234.5, when: instant }] },
        layers: [{ geom: "point", aes: { x: { field: "x" }, y: { field: "when" } } }],
        scales: {
          x: { labels: ",.2f" },
          y: { type: "time", labels: "%Y-%m-%d" },
        },
        coord: { type: "flip" },
      },
      { width: 400, height: 240 },
    );

    expect(model.axisFormatters.x(1234.5)).toBe("1,234.50");
    expect(model.axisFormatters.y(instant)).toBe("2025-07-14");

    const defaults = runPipeline(
      {
        data: {
          values: [
            { x: 0, when: "2025-01-01" },
            { x: 2000, when: instant },
          ],
        },
        layers: [{ geom: "point", aes: { x: { field: "x" }, y: { field: "when" } } }],
      },
      { width: 400, height: 240 },
    );
    expect(defaults.axisFormatters.x(1000)).toBe("1000");
    expect(defaults.axisFormatters.y(instant)).toBe("2025-07-14");
  });

  it("keeps stable facet ids, raw legend values, and domain snapshots", () => {
    const model = runPipeline(
      {
        data: {
          values: [
            { id: 1, facet: "north", x: 1, y: 2, team: "A" },
            { id: 2, facet: "south", x: 2, y: 3, team: "B" },
          ],
        },
        layers: [
          {
            geom: "point",
            aes: { x: { field: "x" }, y: { field: "y" }, color: { field: "team" } },
          },
        ],
        facet: { wrap: { field: "facet" } },
      },
      { width: 640, height: 400 },
    );

    expect(model.scene.panels.map((panel) => panel.id)).toEqual([
      createFacetPanelIdentity([{ role: "wrap", field: "facet", value: "north" }]).key,
      createFacetPanelIdentity([{ role: "wrap", field: "facet", value: "south" }]).key,
    ]);
    const legend = model.scene.legends.find((item) => item.type === "discrete");
    expect(legend?.entries.map((entry) => entry.value)).toEqual(["A", "B"]);
    expect(model.domains.baseline).toEqual(model.domains.effective);
    expect(model.domains.effective.panels).toHaveLength(2);
  });

  it("shares frozen domain copies across fixed facets", () => {
    const model = runPipeline(
      {
        data: {
          values: [
            { facet: "a", label: "north", value: 1 },
            { facet: "b", label: "south", value: 5 },
          ],
        },
        aes: { x: "label", y: "value" },
        layers: [{ geom: "point" }],
        facet: { wrap: { field: "facet" } },
      },
      {
        width: 640,
        height: 400,
        baselineScales: { x: { type: "band", domain: ["south", "north", "baseline-only"] } },
      },
    );

    const { effective, baseline } = model.domains;
    expect(effective.x).toEqual(["north", "south"]);
    expect(effective.x).not.toBe(model.scales.x.domain);
    expect(baseline.x).toEqual(["south", "north", "baseline-only"]);
    for (const snapshot of [effective, baseline]) {
      expect(snapshot.panels).toHaveLength(2);
      expect(Object.isFrozen(snapshot)).toBe(true);
      expect(Object.isFrozen(snapshot.x)).toBe(true);
      expect(Object.isFrozen(snapshot.y)).toBe(true);
      for (const panel of snapshot.panels) {
        expect(Object.isFrozen(panel)).toBe(true);
        expect(panel.x).toBe(snapshot.x);
        expect(panel.y).toBe(snapshot.y);
      }
    }

    const yScale = model.scales.y;
    if (yScale.type !== "linear") throw new Error("expected a continuous y scale");
    const first = yScale.domain[0];
    yScale.domain[0] = first - 1;
    expect(effective.y[0]).toBe(first);
  });

  // Uncensored second evidence pass when baselineScales + domain pins (#449).
  it("trains latest natural baseline domains beside explicit effective zoom domains", () => {
    const model = runPipeline(
      {
        data: {
          values: [
            { facet: "a", x: 0, y: 0 },
            { facet: "a", x: 1, y: 2 },
            { facet: "b", x: 10, y: 10 },
            { facet: "b", x: 20, y: 20 },
          ],
        },
        layers: [{ geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } }],
        facet: { wrap: { field: "facet" }, scales: "free" },
        scales: {
          x: { type: "linear", domain: [2, 4], nice: false },
          y: { type: "linear", domain: [5, 10], nice: false },
        },
      },
      {
        width: 640,
        height: 400,
        baselineScales: {
          x: { type: "linear", nice: false },
          y: { type: "linear", nice: false },
        },
      },
    );
    // Continuous domains now carry the default 5% multiplicative display
    // expansion (pinned domains included); the pinned/effective extent widens.
    expect(model.domains.effective.x).toEqual([1.9, 4.1]);
    expect(model.domains.effective.y).toEqual([4.75, 10.25]);
    expect(model.domains.effective.panels.map((panel) => panel.x)).toEqual([
      [1.9, 4.1],
      [1.9, 4.1],
    ]);
    // Natural baseline: uncensored data extent [0,20] with expansion (#449).
    expect(model.domains.baseline.x).toEqual([-1, 21]);
    expect(model.domains.baseline.y).toEqual([-1, 21]);
    expect(model.domains.baseline.panels.map((panel) => panel.x)).toEqual([
      [-0.05, 1.05],
      [9.5, 20.5],
    ]);
    expect(model.domains.baseline.panels.map((panel) => panel.y)).toEqual([
      [-0.1, 2.1],
      [9.5, 20.5],
    ]);

    // Codex P2: uncensored pass must honor baselineScales (nice/expand/type),
    // not the stripped effective scale config. Data extent [1,19] nices to
    // [0,20] then expands 5% → [-1,21]; with nice:false expand alone → [0.1,19.9].
    const nicedBaseline = runPipeline(
      {
        data: {
          values: [
            { x: 1, y: 1 },
            { x: 19, y: 19 },
          ],
        },
        layers: [{ geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } }],
        scales: {
          x: { type: "linear", domain: [2, 4], nice: false },
          y: { type: "linear", domain: [2, 4], nice: false },
        },
      },
      {
        width: 400,
        height: 240,
        baselineScales: {
          x: { type: "linear" },
          y: { type: "linear" },
        },
      },
    );
    expect(nicedBaseline.domains.baseline.x).toEqual([-1, 21]);
    expect(nicedBaseline.domains.baseline.y).toEqual([-1, 21]);

    const override = {
      x: [100, 200],
      y: [300, 400],
      panels: [
        { x: [100, 150], y: [300, 350] },
        { x: [150, 200], y: [350, 400] },
      ],
    } as const;
    const overridden = runPipeline(
      {
        data: {
          values: [
            { x: 0, y: 0 },
            { x: 20, y: 20 },
          ],
        },
        layers: [{ geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } }],
      },
      {
        width: 400,
        height: 240,
        baselineDomains: override,
        baselineScales: { x: { nice: false }, y: { nice: false } },
      },
    );
    expect(overridden.domains.baseline).toBe(override);
  });

  it("keeps grid panel identities collision-free for delimiter-bearing values", () => {
    const model = runPipeline(
      {
        data: {
          values: [
            { row: "A|col=s:B", col: "C", x: 1, y: 1 },
            { row: "A", col: "B|col=s:C", x: 2, y: 2 },
          ],
        },
        layers: [{ geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } }],
        facet: { rows: { field: "row" }, cols: { field: "col" } },
      },
      { width: 640, height: 400 },
    );
    const ids = model.scene.panels.map((panel) => panel.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("builds candidates with ggplot-derived series and facet-local buckets", () => {
    const model = runPipeline(
      {
        data: {
          values: [
            { facet: "a", x: 1, y: 2, team: "red" },
            { facet: "a", x: 1, y: 4, team: "blue" },
            { facet: "b", x: 1, y: 8, team: "red" },
          ],
        },
        layers: [
          {
            geom: "point",
            aes: { x: { field: "x" }, y: { field: "y" }, color: { field: "team" } },
          },
        ],
        facet: { wrap: { field: "facet" } },
      },
      { width: 640, height: 400 },
    );
    expect(model.candidates.size).toBe(3);
    expect(model.candidates.candidate(0)).toMatchObject({
      xValue: 1,
      yValue: 2,
      panelId: createFacetPanelIdentity([{ role: "wrap", field: "facet", value: "a" }]).key,
    });
    const firstPanel = model.candidates.group(0, "x");
    expect(firstPanel?.memberIds).toHaveLength(2);
    expect(
      [...firstPanel!.memberIds].map((id) => model.candidates.candidate(id)?.panelIndex),
    ).toEqual([0, 0]);
  });

  it("interns the exact source memberships represented by aggregate marks", () => {
    const model = runPipeline(
      {
        data: { values: [{ x: 1 }, { x: 1 }, { x: 2 }] },
        layers: [{ geom: "bar", aes: { x: { field: "x" } } }],
      },
      { width: 400, height: 240 },
    );
    expect(
      Array.from({ length: model.candidates.size }, (_, id) => {
        const candidate = model.candidates.candidate(id)!;
        return [candidate.xValue, model.lineage.count(candidate.lineage)];
      }),
    ).toEqual([
      [1, 2],
      [2, 1],
    ]);
  });

  it("assigns rows on shared bin breaks to exactly one lineage using closedness", () => {
    const memberships = (closed: "right" | "left") => {
      const model = runPipeline(
        {
          data: { values: [{ x: 0 }, { x: 1 }, { x: 2 }] },
          layers: [
            {
              geom: "histogram",
              aes: { x: { field: "x" } },
              params: { binwidth: 1, boundary: 0, closed },
            },
          ],
        },
        { width: 400, height: 240 },
      );
      return Array.from({ length: model.candidates.size }, (_, id) => {
        const candidate = model.candidates.candidate(id)!;
        return [...model.lineage.keys(candidate.lineage)].toSorted((a, b) => a - b);
      });
    };
    expect(memberships("right")).toEqual([[0, 1], [2]]);
    expect(memberships("left")).toEqual([[0], [1, 2]]);
  });
});
