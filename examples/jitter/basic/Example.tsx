"use client";

import {
  GeomJitter,
  GGPlot,
  GuideNone,
  Inspect,
  Labs,
  ScaleColorDiscrete,
  ThemeClean,
} from "@ggts-sh/react";

import { fastfoodMenu } from "./data.js";

export default function FastfoodJitter() {
  return (
    <GGPlot
      data={fastfoodMenu}
      aes={{ x: "restaurant", y: "calories", color: "restaurant" }}
      width={640}
      height={400}
      ariaLabel="Menu calories, spread so items do not stack"
    >
      <GeomJitter width={0.22} height={0} alpha={0.65} />
      <ScaleColorDiscrete scheme="observable10" />
      <ThemeClean />
      <GuideNone channel="color" />
      <Labs
        title="Menu calories, spread so items do not stack"
        subtitle="Each point is one entrée. Jitter separates items that share a restaurant"
        x="Restaurant"
        y="Calories"
      />
      <Inspect mode="xy" pin maxDistance={24} />
    </GGPlot>
  );
}
