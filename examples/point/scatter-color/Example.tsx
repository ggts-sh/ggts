"use client";

import {
  GeomPoint,
  GGPlot,
  GuideLegend,
  Inspect,
  Labs,
  ScaleColorDiscrete,
  ThemeFew,
} from "@ggts-sh/react";

import { guerry } from "./data.js";

export default function GuerryScatter() {
  return (
    <GGPlot
      data={guerry}
      aes={{ x: "literacy", y: "crimePersons", color: "region" }}
      width={640}
      height={400}
      ariaLabel="Two measures coloured by region"
    >
      <GeomPoint size={3} />
      <ScaleColorDiscrete scheme="observable10" />
      <ThemeFew />
      <GuideLegend channel="color" focus />
      <Labs
        title="Two measures coloured by region"
        subtitle="Literacy and crime by French department"
        x="Literate conscripts (%)"
        y="Population per crime against persons"
        color="Region"
      />
      <Inspect mode="xy" pin maxDistance={24} />
    </GGPlot>
  );
}
