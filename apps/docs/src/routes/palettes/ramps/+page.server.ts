import type { ColorScaleSpec } from "@ggts-sh/spec";

import { THEME_STATIC_SHELL_BY_ID } from "$lib/generated/theme-static-shells";
import { RASTER_Z_DOMAIN } from "$lib/theme-specimens/catalog";

const SEQUENTIAL_EXAMPLES: readonly {
  id: string;
  label: string;
  scale: ColorScaleSpec;
}[] = [
  {
    id: "viridis",
    label: "Viridis",
    scale: { type: "sequential", scheme: "viridis" },
  },
  {
    id: "viridis-reversed",
    label: "Reversed",
    scale: { type: "sequential", scheme: "viridis", reverse: true },
  },
  {
    id: "custom-range",
    label: "Custom range",
    scale: {
      type: "sequential",
      range: ["#2d1e2f", "#3d5a80", "#e76f51"],
    },
  },
  {
    id: "pinned-domain",
    label: "Pinned domain",
    scale: {
      type: "sequential",
      scheme: "viridis",
      domain: [...RASTER_Z_DOMAIN],
    },
  },
];

function shellPath(id: string): string {
  const path = THEME_STATIC_SHELL_BY_ID[id];
  if (path === undefined) throw new Error(`Missing static shell ${id}`);
  return path;
}

/** Paths only — SVG bodies under /theme-shells/ (see gen-theme-static-shells). */
export function load() {
  return {
    sequentialExamples: SEQUENTIAL_EXAMPLES.map((example) => ({
      label: example.label,
      scale: example.scale,
      staticSrc: shellPath(`sequential-${example.id}`),
    })),
  };
}
