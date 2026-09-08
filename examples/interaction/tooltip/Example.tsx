"use client";

import { useState } from "react";
import { GGPlot, GeomPoint, Inspect, Labs, ThemeLight } from "@ggts-sh/react";
import { palmerPenguins } from "@ggts-sh/core/data";

export default function PenguinInspection() {
  const [remembered, setRemembered] = useState<string | null>(null);
  return (
    <div>
      <GGPlot
        data={palmerPenguins}
        aes={{ x: "flipperLengthMm", y: "bodyMassG", color: "species" }}
        identity="id"
        height={400}
        ariaLabel="Inspect penguins by flipper length and body mass"
      >
        <GeomPoint size={4} alpha={0.85} />
        <ThemeLight />
        <Labs
          title="Inspect a shared x value, then pin"
          x="Flipper length (mm)"
          y="Body mass (g)"
          color="Species"
        />
        <Inspect
          mode="x"
          pin
          maxDistance={24}
          identity="id"
          contentMode="interactive"
          content={(inspection) => (
            <div>
              <strong>{String(inspection.focus.row?.["species"] ?? "Penguin")}</strong>
              <p>{inspection.members.length} penguins share this inspected flipper length.</p>
              <p>
                {String(inspection.focus.row?.["flipperLengthMm"])} mm flipper ·{" "}
                {String(inspection.focus.row?.["bodyMassG"])} g
              </p>
              {inspection.state === "pinned" ? (
                <button
                  type="button"
                  style={{ minHeight: 44 }}
                  onClick={() => {
                    setRemembered(String(inspection.focus.key));
                  }}
                >
                  Remember this penguin
                </button>
              ) : (
                <p>Click the point or press Enter to pin this inspection.</p>
              )}
            </div>
          )}
        />
      </GGPlot>
      <p>
        {remembered === null
          ? "Pin an inspection, then use its custom button."
          : `Remembered penguin: ${remembered}`}
      </p>
    </div>
  );
}
