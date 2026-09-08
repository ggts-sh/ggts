/**
 * Cross-geom shell parity (#1039).
 *
 * For every KNOWN_GEOMS entry: the package exports Geom*, mounting under a
 * registry host registers a mark layer with the expected geom, and a
 * representative schema param (when the geom has any) reaches layer.params.
 *
 * Full <GGPlot> pipeline training is intentionally out of scope here — sf,
 * map, qq, function, etc. reject generic fixture rows. Live prop updates are
 * covered in factory.test.ts.
 */
import type { Component } from "svelte";
import { describe, expect, it } from "vitest";

import { GEOM_PARAM_KEYS, KNOWN_GEOMS, type GeomName } from "@ggts-sh/spec";

import { toLayerInput } from "../../src/lib/assembly/assemble.js";
import type { LayerRegistry } from "../../src/lib/geoms/registry.svelte.js";
import * as SveltePkg from "../../src/lib/index.js";
import GeomRegistryHost from "../fixtures/GeomRegistryHost.svelte";
import { render } from "../helpers/render.js";

/** snake_case geom → GeomPascal component export name. */
function componentName(geom: GeomName): string {
  const pascal = geom
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return `Geom${pascal}`;
}

/** One representative value per param key family for the whitelist check. */
const STRING_PARAM_VALUES: Readonly<Record<string, string>> = {
  fun: "mean",
  method: "loess",
  shape: "circle",
  curve: "linear",
  connection: "linear",
  direction: "hv",
  stackdir: "up",
  sides: "b",
  outline: "full",
  orientation: "x",
  lineend: "butt",
  linejoin: "round",
  anchor: "middle",
  closed: "right",
  geometry: "geometry",
  mapId: "id",
  scale: "area",
};

function sampleValue(key: string): unknown {
  const stringValue = STRING_PARAM_VALUES[key];
  if (stringValue !== undefined) return stringValue;
  if (key === "drop") return true;
  if (key === "se") return true;
  if (key === "trim") return true;
  if (key === "interpolate") return true;
  if (key === "map") return [];
  if (key === "xlim") return [0, 1];
  if (key === "breaks") return [0, 1];
  if (key === "quantiles") return [0.25, 0.5, 0.75];
  if (key === "args") return {};
  if (key.endsWith("Paint") || key === "glow") {
    return key === "glow" ? 2 : "#ff0000";
  }
  if (key === "alpha" || key === "level" || key === "span" || key === "cut" || key === "adjust") {
    return 0.5;
  }
  // numeric defaults
  return 2;
}

async function waitMark(get: () => LayerRegistry | undefined): Promise<LayerRegistry> {
  await expect.poll(() => get() !== undefined).toBe(true);
  await expect.poll(() => (get()?.markLayers.length ?? 0) > 0).toBe(true);
  return get()!;
}

describe("geom-child parity (all KNOWN_GEOMS shells)", () => {
  it(`KNOWN_GEOMS has 49 entries (got ${String(KNOWN_GEOMS.length)})`, () => {
    expect(KNOWN_GEOMS).toHaveLength(49);
  });

  for (const geom of KNOWN_GEOMS) {
    const name = componentName(geom);
    it(`${name} is exported and registers geom "${geom}"`, async () => {
      const Shell = (SveltePkg as Record<string, unknown>)[name] as Component | undefined;
      expect(Shell, `export ${name}`).toBeTypeOf("function");

      const keys = GEOM_PARAM_KEYS[geom];
      const shellProps: Record<string, unknown> = {};
      const paramKey = keys[0];
      if (paramKey !== undefined) {
        shellProps[paramKey] = sampleValue(paramKey);
      }

      let host: LayerRegistry | undefined;
      render(GeomRegistryHost, {
        Shell,
        shellProps,
        captureRegistry: (registry: LayerRegistry) => {
          host = registry;
        },
      });
      const registry = await waitMark(() => host);
      expect(registry.markLayers).toHaveLength(1);
      const layer = toLayerInput(registry.markLayers[0]);
      expect(layer.geom).toBe(geom);

      if (paramKey === undefined) {
        // blank (and any future zero-param geom)
        expect(layer.params).toBeUndefined();
      } else {
        expect(layer.params).toBeDefined();
        expect(layer.params).toHaveProperty(paramKey, shellProps[paramKey]);
      }
    });
  }
});
