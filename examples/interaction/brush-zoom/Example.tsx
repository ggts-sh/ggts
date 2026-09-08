"use client";

import { useState } from "react";
import { GGPlot, GeomPoint, Inspect, Labs, ThemeLight } from "@ggsvelte/react";
import { palmerPenguins } from "@ggsvelte/core/data";

export default function SelectAndZoom() {
  const [selection, setSelection] = useState(
    "Choose Select area, then drag a rectangle or set its bounds.",
  );
  const [zoom, setZoom] = useState(
    "Choose Zoom area to rescale, then Reset zoom to restore the view.",
  );
  return (
    <div>
      <GGPlot
        data={palmerPenguins}
        aes={{ x: "billLengthMm", y: "bodyMassG", color: "species" }}
        identity="id"
        select={{ type: "interval", mode: "xy", persistent: true }}
        zoom={{ mode: "xy" }}
        height={400}
        ariaLabel="Select an interval or zoom through penguin measurements"
        onselect={(event) => {
          if (event.mode === "point") return;
          setSelection(
            event.phase === "clear"
              ? "Selection cleared."
              : `${event.keys.length} penguins selected (${event.source}).`,
          );
        }}
        onzoom={(event) => {
          setZoom(
            event.phase === "clear"
              ? "Zoom reset."
              : `Zoom applied (${event.source}). Use Reset zoom to restore the view.`,
          );
        }}
      >
        <GeomPoint size={3} alpha={0.8} />
        <ThemeLight />
        <Labs
          title="Select an interval or brush to zoom"
          x="Bill length (mm)"
          y="Body mass (g)"
          color="Species"
        />
        <Inspect mode="xy" pin identity="id" />
      </GGPlot>
      <p>
        <strong>Selection:</strong> {selection}
      </p>
      <p>
        <strong>Zoom:</strong> {zoom}
      </p>
    </div>
  );
}
