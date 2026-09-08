"use client";

import { GeomPoint, GeomSmooth, GGPlot, Inspect, Labs, ThemeTufte } from "@ggts-sh/react";
import { chocolateBars } from "@ggts-sh/core/data";

// Keep the gallery responsive while retaining the dataset's original order.
const reviews = chocolateBars.filter((_, index) => index % 6 === 0);

export default function ChocolateTrend() {
  return (
    <GGPlot
      data={reviews}
      aes={{ x: "cocoaPercent", y: "rating" }}
      height={400}
      ariaLabel="Chocolate bar ratings against cocoa percentage with a loess trend"
    >
      <GeomSmooth method="loess" span={0.75} />
      <GeomPoint alpha={0.25} size={2} />
      <ThemeTufte />
      <Labs
        title="Cocoa percent against bar rating"
        subtitle="Chocolate reviews with a loess trend and confidence band"
        x="Cocoa (%)"
        y="Rating (1–4)"
      />
      <Inspect mode="xy" pin maxDistance={24} />
    </GGPlot>
  );
}
