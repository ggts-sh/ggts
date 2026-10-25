"use client";

import { CoordFlip, GeomCol, GGPlot, Inspect, Labs, ThemeFivethirtyeight } from "@ggts-sh/react";

import { armadaMen } from "./data.js";

export default function ArmadaHorizontalBars() {
  return (
    <GGPlot
      data={armadaMen}
      aes={{ x: "squadron", y: "men" }}
      width={640}
      height={400}
      ariaLabel="Category totals, flipped so labels read across"
    >
      <GeomCol />
      <CoordFlip />
      <ThemeFivethirtyeight />
      <Labs
        title="Category totals, flipped so labels read across"
        subtitle="Ordered smallest to largest so the flip reads bottom-up"
        x="Squadron"
        y="Men"
      />
      <Inspect mode="exact" pin />
    </GGPlot>
  );
}
