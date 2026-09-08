import { GGPlot } from "@ggts-sh/react";
import type { SpecInput } from "@ggts-sh/spec/portable";

import { COLORS, type ScatterColumns } from "../../scenarios";

export function ScatterChart({
  data,
  width = 800,
  height = 500,
}: {
  data: ScatterColumns;
  width?: number;
  height?: number;
}) {
  const spec: SpecInput = {
    data: { columns: data },
    aes: { x: "x", y: "y", color: "cls" },
    layers: [{ geom: "point", render: "svg", params: { size: 1.5, alpha: 0.7 } }],
    scales: {
      color: {
        type: "manual",
        domain: ["series-0", "series-1", "series-2", "series-3", "series-4"],
        range: COLORS.slice(0, 5),
      },
    },
  };
  return <GGPlot spec={spec} width={width} height={height} />;
}
