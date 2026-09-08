import type { PortableSpec } from "@ggts-sh/spec";

import type { ZoomDomains } from "./interaction.js";

export function numericDomain(
  values: readonly unknown[] | undefined,
): [number, number] | undefined {
  if (values === undefined || values.length < 2) return undefined;
  const a = values[0];
  const b = values[1];
  if (typeof a !== "number" || typeof b !== "number") return undefined;
  return [Math.min(a, b), Math.max(a, b)];
}

export function applyZoom(spec: PortableSpec, zoom: Partial<ZoomDomains> | null): PortableSpec {
  if (zoom === null || (zoom.x === undefined && zoom.y === undefined)) return spec;
  return {
    ...spec,
    scales: {
      ...spec.scales,
      ...(zoom.x !== undefined && {
        x: { ...spec.scales?.x, type: spec.scales?.x?.type ?? "linear", domain: zoom.x },
      }),
      ...(zoom.y !== undefined && {
        y: { ...spec.scales?.y, type: spec.scales?.y?.type ?? "linear", domain: zoom.y },
      }),
    },
  };
}
