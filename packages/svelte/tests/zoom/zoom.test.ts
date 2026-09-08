import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";

import type { PortableSpec } from "@ggts-sh/spec";
import type { CellValue, PlotRect, SemanticViewport, SemanticViewportPanel } from "@ggts-sh/core";

import {
  applyZoomToSpec,
  buildZoomEvent,
  continuousZoomDomainsFromScopes,
  filterScopeChannelsByZoomMode,
  filterZoomDomainsByMode,
  resolveBrushZoomDomains,
  resolveBrushZoomFromModel,
  sameZoomDomains,
  sanitizePartialZoomDomains,
  stableZoomDomains,
} from "../../src/lib/zoom/zoom.js";

const continuousScale = (domain: [number, number]) => {
  const [d0, d1] = domain;
  const span = d1 - d0;
  return {
    type: "continuous" as const,
    invert: (t: number) => d0 + t * span,
  };
};

const bandScale = {
  type: "band" as const,
  invert: (_t: number) => 0,
};

const viewportPanel = (domains: {
  x?: readonly [CellValue, CellValue];
  y?: readonly [CellValue, CellValue];
}) =>
  fromPartial<SemanticViewportPanel>({
    id: "panel",
    bounds: { x0: 0, y0: 0, x1: 100, y1: 100 },
    invert: () => domains,
    normalizedSpan: (rect: PlotRect) => {
      const clamp = (value: number) => Math.max(0, Math.min(1, value));
      const th0 = clamp(rect.x0 / 100);
      const th1 = clamp(rect.x1 / 100);
      const tv0 = clamp(1 - rect.y1 / 100);
      const tv1 = clamp(1 - rect.y0 / 100);
      return { x: th1 - th0, y: tv1 - tv0 };
    },
  });

describe("filterZoomDomainsByMode", () => {
  const domains = {
    x: [1, 2] as [number, number],
    y: [3, 4] as [number, number],
  };

  it("returns null for empty domains and keeps all channels when mode is null", () => {
    expect(filterZoomDomainsByMode(null, "xy")).toBeNull();
    expect(filterZoomDomainsByMode({}, "xy")).toBeNull();
    // No local zoom tool still displays shared controller domains.
    expect(filterZoomDomainsByMode(domains, null)).toEqual({
      x: [1, 2],
      y: [3, 4],
    });
  });

  it("keeps only channels the plot opted into", () => {
    expect(filterZoomDomainsByMode(domains, "x")).toEqual({ x: [1, 2] });
    expect(filterZoomDomainsByMode(domains, "y")).toEqual({ y: [3, 4] });
    expect(filterZoomDomainsByMode(domains, "xy")).toEqual({
      x: [1, 2],
      y: [3, 4],
    });
  });

  it("drops a mode when the matching channel is absent", () => {
    expect(filterZoomDomainsByMode({ y: [3, 4] }, "x")).toBeNull();
    expect(filterZoomDomainsByMode({ x: [1, 2] }, "y")).toBeNull();
  });
});

describe("filterScopeChannelsByZoomMode", () => {
  const linked = { keys: "id", x: "x-mm", y: "y-mm" };

  it("keeps both channels for xy or null mode", () => {
    expect(filterScopeChannelsByZoomMode(linked, "xy")).toEqual(linked);
    expect(filterScopeChannelsByZoomMode(linked, null)).toEqual(linked);
  });

  it("drops the non-opted channel for single-axis zoom", () => {
    expect(filterScopeChannelsByZoomMode(linked, "x")).toEqual({
      keys: "id",
      x: "x-mm",
    });
    expect(filterScopeChannelsByZoomMode(linked, "y")).toEqual({
      keys: "id",
      y: "y-mm",
    });
  });

  it("freezes the result", () => {
    expect(Object.isFrozen(filterScopeChannelsByZoomMode(linked, "x"))).toBe(true);
  });
});

describe("sameZoomDomains / stableZoomDomains", () => {
  it("compares channel endpoints with Object.is", () => {
    expect(sameZoomDomains({ x: [1, 2] }, { x: [1, 2] })).toBe(true);
    expect(sameZoomDomains({ x: [1, 2] }, { x: [1, 3] })).toBe(false);
    expect(sameZoomDomains(null, null)).toBe(true);
    expect(sameZoomDomains({ x: [1, 2] }, null)).toBe(false);
    expect(sameZoomDomains({ x: [-0, 1] }, { x: [0, 1] })).toBe(false);
  });

  it("reuses the previous bag when values match", () => {
    const previous = { x: [1, 2] as [number, number] };
    const next = { x: [1, 2] as [number, number] };
    expect(stableZoomDomains(previous, next)).toBe(previous);
    expect(stableZoomDomains(previous, { x: [1, 3] })).toEqual({ x: [1, 3] });
    expect(stableZoomDomains(previous, null)).toBeNull();
  });
});

describe("applyZoomToSpec", () => {
  const base = fromAny<PortableSpec>({
    aes: {},
    layers: [{ geom: "point" }],
    scales: {
      x: { type: "continuous", nice: true },
      y: { type: "continuous", nice: true },
    },
  });

  it("returns the same reference when domains are null or empty", () => {
    expect(applyZoomToSpec(base, null)).toBe(base);
    expect(applyZoomToSpec(base, {})).toBe(base);
    expect(applyZoomToSpec(base, { x: undefined, y: undefined })).toBe(base);
  });

  it("merges continuous domains with nice:false, zero expansion, and cloned tuples", () => {
    const x: [number, number] = [10, 20];
    const next = applyZoomToSpec(base, { x });
    expect(next).not.toBe(base);
    expect(next.scales?.x).toEqual({
      type: "continuous",
      nice: false,
      expand: { mult: 0, add: 0 },
      domain: [10, 20],
    });
    expect(next.scales?.x?.domain).not.toBe(x);
    expect(next.scales?.y).toEqual(base.scales?.y);
    x[0] = 99;
    expect(next.scales?.x?.domain).toEqual([10, 20]);
  });

  it("handles absent scale configs via spread of undefined", () => {
    const bare = fromAny<PortableSpec>({
      aes: {},
      layers: [{ geom: "point" }],
    });
    const next = applyZoomToSpec(bare, { y: [0, 1] });
    expect(next.scales?.y).toEqual({
      domain: [0, 1],
      nice: false,
      expand: { mult: 0, add: 0 },
    });
    expect(next.scales?.x).toBeUndefined();
  });

  it("clears explicit coordinate limits on zoomed axes", () => {
    const withCoordLimits = fromAny<PortableSpec>({
      layers: [{ geom: "point" }],
      coord: {
        type: "transform",
        x: { transform: "log10", limits: [1, 1000], expand: false },
        y: { transform: "sqrt", limits: [0, 100], reverse: true },
      },
    });
    const next = applyZoomToSpec(withCoordLimits, { x: [10, 100] });
    expect(next.coord).toEqual({
      type: "transform",
      x: { transform: "log10", expand: false },
      y: { transform: "sqrt", limits: [0, 100], reverse: true },
    });
    expect(next.scales?.x?.domain).toEqual([10, 100]);
  });

  it("is idempotent when an emitted semantic domain is reapplied", () => {
    const once = applyZoomToSpec(base, { x: [10, 20] });
    const twice = applyZoomToSpec(once, { x: [10, 20] });
    expect(twice.scales?.x).toEqual(once.scales?.x);
    expect(twice.scales?.x?.expand).toEqual({ mult: 0, add: 0 });
  });
});

describe("sanitizePartialZoomDomains", () => {
  const scales = {
    x: continuousScale([0, 100]),
    y: bandScale,
  };

  it("keeps finite continuous channels and drops band/non-finite", () => {
    expect(sanitizePartialZoomDomains({ x: [5, 15], y: [0, 1] }, fromAny(scales), null)).toEqual({
      x: [5, 15],
    });
  });

  it("retains the other channel from current domains", () => {
    expect(
      sanitizePartialZoomDomains(
        { x: [1, 2] },
        fromAny({
          x: continuousScale([0, 10]),
          y: continuousScale([0, 10]),
        }),
        { y: [3, 4] },
      ),
    ).toEqual({ x: [1, 2], y: [3, 4] });
  });

  it("returns null when nothing valid remains", () => {
    expect(
      sanitizePartialZoomDomains(
        { x: [Number.NaN, 1], y: [0, Number.POSITIVE_INFINITY] },
        fromAny({
          x: continuousScale([0, 1]),
          y: continuousScale([0, 1]),
        }),
        null,
      ),
    ).toBeNull();
    expect(
      sanitizePartialZoomDomains({ x: [0, 1] }, fromAny({ x: bandScale, y: bandScale }), null),
    ).toBeNull();
  });
});

describe("resolveBrushZoomDomains", () => {
  it("rejects only when both normalized pixel spans are non-positive", () => {
    expect(
      resolveBrushZoomDomains(
        { x0: 10, y0: 10, x1: 10, y1: 10 },
        viewportPanel({ x: [10, 10], y: [45, 45] }),
        "xy",
        null,
      ),
    ).toBeNull();
  });

  it("allows a single-axis-thin brush (existing behavior)", () => {
    const domains = resolveBrushZoomDomains(
      { x0: 10, y0: 20, x1: 10, y1: 80 },
      viewportPanel({ x: [10, 10], y: [10, 40] }),
      "xy",
      null,
    );
    expect(domains).not.toBeNull();
    expect(domains!.y).toBeDefined();
  });

  it("filters by mode and merges with current domains", () => {
    const xOnly = resolveBrushZoomDomains(
      { x0: 10, y0: 10, x1: 90, y1: 90 },
      viewportPanel({ x: [10, 90], y: [5, 45] }),
      "x",
      { y: [1, 2] },
    );
    expect(xOnly?.x).toEqual([10, 90]);
    expect(xOnly?.y).toEqual([1, 2]);

    const yOnly = resolveBrushZoomDomains(
      { x0: 10, y0: 10, x1: 90, y1: 90 },
      viewportPanel({ x: [10, 90], y: [5, 45] }),
      "y",
      null,
    );
    expect(yOnly?.x).toBeUndefined();
    expect(yOnly?.y).toBeDefined();
  });

  it("accepts only finite numeric viewport domains", () => {
    const domains = resolveBrushZoomDomains(
      { x0: 50, y0: 0, x1: 100, y1: 100 },
      viewportPanel({ x: [25, 100], y: ["a", "b"] }),
      "xy",
      null,
    );
    expect(domains?.x).toEqual([25, 100]);
    expect(domains?.y).toBeUndefined();
  });
});

describe("resolveBrushZoomFromModel", () => {
  const panel = viewportPanel({ x: [10, 90], y: [5, 45] });
  const single = {
    viewport: fromPartial<SemanticViewport>({ panels: [panel] }),
  };
  const rect = { x0: 10, y0: 10, x1: 90, y1: 90 };

  it("returns null when model is null", () => {
    expect(
      resolveBrushZoomFromModel({
        model: null,
        rect,
        mode: "xy",
        current: null,
      }),
    ).toBeNull();
  });

  it("returns null for multi-panel (M2 faceted skip)", () => {
    expect(
      resolveBrushZoomFromModel({
        model: {
          viewport: fromPartial<SemanticViewport>({
            panels: [panel, panel],
          }),
        },
        rect,
        mode: "xy",
        current: null,
      }),
    ).toBeNull();
  });

  it("returns null when there are zero panels", () => {
    expect(
      resolveBrushZoomFromModel({
        model: {
          viewport: fromPartial<SemanticViewport>({ panels: [] }),
        },
        rect,
        mode: "xy",
        current: null,
      }),
    ).toBeNull();
  });

  it("returns frozen commit-ready domains for a single panel", () => {
    const domains = resolveBrushZoomFromModel({
      model: single,
      rect,
      mode: "xy",
      current: null,
    });
    expect(domains).not.toBeNull();
    expect(domains!.x).toBeDefined();
    expect(domains!.y).toBeDefined();
    expect(Object.isFrozen(domains)).toBe(true);
    expect(Object.isFrozen(domains!.x)).toBe(true);
    expect(Object.isFrozen(domains!.y)).toBe(true);
    // Deep clone: frozen tuples are not the same references as a mutable source.
    const mutable: [number, number] = [domains!.x![0], domains!.x![1]];
    expect(domains!.x).not.toBe(mutable);
    mutable[0] = 999;
    expect(domains!.x![0]).not.toBe(999);
  });

  it("returns null when domain invert degenerates", () => {
    expect(
      resolveBrushZoomFromModel({
        model: single,
        rect: { x0: 10, y0: 10, x1: 10, y1: 10 },
        mode: "xy",
        current: null,
      }),
    ).toBeNull();
  });
});

describe("buildZoomEvent", () => {
  it("builds a frozen end payload and freezes nested domain tuples", () => {
    const x: [number, number] = [1, 2];
    const event = buildZoomEvent({ x }, "pointer");
    expect(event.type).toBe("zoom");
    expect(event.phase).toBe("end");
    expect(event.source).toBe("pointer");
    expect(event.domains?.x).toEqual([1, 2]);
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.domains)).toBe(true);
    expect(Object.isFrozen(event.domains?.x)).toBe(true);
    x[0] = 99;
    expect(event.domains?.x).toEqual([1, 2]);
  });

  it("uses clear phase when domains are null", () => {
    const event = buildZoomEvent(null, "programmatic");
    expect(event).toEqual({
      type: "zoom",
      phase: "clear",
      source: "programmatic",
      domains: null,
    });
    expect(Object.isFrozen(event)).toBe(true);
  });
});

describe("continuousZoomDomainsFromScopes", () => {
  it("picks x and y by scope and clones domain tuples", () => {
    const xDomain: [number, number] = [0, 1];
    const yDomain: [number, number] = [2, 3];
    const result = continuousZoomDomainsFromScopes(
      {
        x: [
          { scope: "plot-a", domain: xDomain },
          { scope: "other", domain: [9, 10] },
        ],
        y: [{ scope: "plot-a", domain: yDomain }],
      },
      "plot-a",
      "plot-a",
    );
    expect(result).toEqual({ x: [0, 1], y: [2, 3] });
    xDomain[0] = 99;
    yDomain[1] = 88;
    expect(result).toEqual({ x: [0, 1], y: [2, 3] });
  });

  it("omits missing channels and returns empty bag when neither matches", () => {
    expect(
      continuousZoomDomainsFromScopes(
        {
          x: [{ scope: "plot-a", domain: [0, 1] }],
          y: [],
        },
        "plot-a",
        "plot-b",
      ),
    ).toEqual({ x: [0, 1] });

    expect(
      continuousZoomDomainsFromScopes(
        {
          x: [],
          y: [{ scope: "plot-b", domain: [4, 5] }],
        },
        "plot-a",
        "plot-b",
      ),
    ).toEqual({ y: [4, 5] });

    expect(
      continuousZoomDomainsFromScopes(
        {
          x: [{ scope: "other", domain: [0, 1] }],
          y: [{ scope: "other", domain: [2, 3] }],
        },
        "plot-a",
        "plot-b",
      ),
    ).toEqual({});

    const unsetScope: string | undefined = void 0;
    expect(
      continuousZoomDomainsFromScopes(
        {
          x: [{ scope: "plot-a", domain: [0, 1] }],
          y: [{ scope: "plot-b", domain: [2, 3] }],
        },
        unsetScope,
        unsetScope,
      ),
    ).toEqual({});
  });
});
