"use client";

import { GeomCol, GGPlot, Inspect, Labs, ScaleXContinuous, ThemeClassic } from "@ggts-sh/react";

import { chestSizes } from "./data.js";

export default function ChestSizeColumns() {
  return (
    <GGPlot
      data={chestSizes}
      aes={{ x: "chest", y: "soldiers" }}
      width={640}
      height={400}
      ariaLabel="Counts across ordered chest sizes"
    >
      <GeomCol />
      <ScaleXContinuous nice={false} />
      <ThemeClassic />
      <Labs
        title="Counts across ordered chest sizes"
        subtitle="How many men fell in each chest-measure class"
        x="Chest circumference (inches)"
        y="Soldiers"
      />
      <Inspect mode="exact" pin />
    </GGPlot>
  );
}
