"use client";

import { useState, useSyncExternalStore } from "react";
import {
  createPlotInteraction,
  GGPlot,
  GeomPoint,
  Inspect,
  Labs,
  ThemeMinimal,
} from "@ggsvelte/react";

// The same fifteen Palmer penguins shown in the Svelte gallery example.
const penguins = [
  { id: "adelie-001", species: "Adelie", flipper: 181, mass: 3750 },
  { id: "adelie-030", species: "Adelie", flipper: 195, mass: 3325 },
  { id: "adelie-059", species: "Adelie", flipper: 184, mass: 2850 },
  { id: "adelie-088", species: "Adelie", flipper: 186, mass: 4450 },
  { id: "adelie-117", species: "Adelie", flipper: 176, mass: 3450 },
  { id: "chinstrap-001", species: "Chinstrap", flipper: 192, mass: 3500 },
  { id: "chinstrap-014", species: "Chinstrap", flipper: 201, mass: 4050 },
  { id: "chinstrap-027", species: "Chinstrap", flipper: 200, mass: 3400 },
  { id: "chinstrap-040", species: "Chinstrap", flipper: 205, mass: 4500 },
  { id: "chinstrap-053", species: "Chinstrap", flipper: 193, mass: 3600 },
  { id: "gentoo-001", species: "Gentoo", flipper: 211, mass: 4500 },
  { id: "gentoo-024", species: "Gentoo", flipper: 215, mass: 5050 },
  { id: "gentoo-047", species: "Gentoo", flipper: 225, mass: 5400 },
  { id: "gentoo-070", species: "Gentoo", flipper: 221, mass: 5000 },
  { id: "gentoo-093", species: "Gentoo", flipper: 214, mass: 4850 },
];
const scope = { keys: "penguin-id" };

export default function LinkedPenguins() {
  // One controller survives React renders; the revision drives the external table.
  const [interaction] = useState(() => createPlotInteraction<string>());
  useSyncExternalStore(
    (listener) => interaction.subscribe(listener),
    () => interaction.revision,
    () => 0,
  );
  const selected = interaction.selected(scope);
  const emphasized = interaction.emphasized(scope);
  const [showingAll, setShowingAll] = useState(true);
  const rows = showingAll ? penguins : penguins.filter((row) => row.species !== "Chinstrap");
  const emphasisTarget = penguins[1]!;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: 16,
        }}
      >
        <GGPlot
          data={rows}
          aes={{ x: "flipper", y: "mass", color: "species" }}
          identity="id"
          select={{ type: "point", multiple: true }}
          interaction={interaction}
          interactionScope={scope}
          height={340}
          ariaLabel="Linked penguins: flipper length"
        >
          <GeomPoint size={5} alpha={0.85} />
          <ThemeMinimal />
          <Labs
            title="Select in either view"
            x="Flipper length (mm)"
            y="Body mass (g)"
            color="Species"
          />
          <Inspect mode="xy" pin identity="id" />
        </GGPlot>
        <GGPlot
          data={rows}
          aes={{ x: "flipper", y: "mass" }}
          identity="id"
          select={{ type: "point", multiple: true }}
          interaction={interaction}
          interactionScope={scope}
          height={340}
          ariaLabel="Linked penguins: quiet style"
        >
          <GeomPoint size={5} alpha={0.85} />
          <ThemeMinimal />
          <Labs title="Minimal theme, linked selection" x="Flipper length (mm)" y="Body mass (g)" />
          <Inspect mode="xy" pin identity="id" />
        </GGPlot>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          style={{ minHeight: 44 }}
          onClick={() => {
            interaction.setSelection(
              rows.filter((row) => row.species === "Gentoo").map((row) => row.id),
              { scope },
            );
          }}
        >
          Select Gentoo
        </button>
        <button
          type="button"
          style={{ minHeight: 44 }}
          onClick={() => {
            interaction.clearSelection({ scope });
          }}
        >
          Clear linked selection
        </button>
        <button
          type="button"
          style={{ minHeight: 44 }}
          aria-pressed={emphasized.includes(emphasisTarget.id)}
          onClick={() => {
            interaction.setEmphasis([emphasisTarget.id], { scope });
          }}
        >
          Emphasize Adelie 2
        </button>
        <button
          type="button"
          style={{ minHeight: 44 }}
          onClick={() => {
            const next = showingAll
              ? penguins.filter((row) => row.species !== "Chinstrap")
              : penguins;
            setShowingAll(!showingAll);
            interaction.reconcileKeys(
              next.map((row) => row.id),
              { scope },
            );
          }}
        >
          {showingAll ? "Remove Chinstrap rows" : "Restore all rows"}
        </button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", textAlign: "left" }}>
          <caption>{selected.length} penguins selected across both views</caption>
          <thead>
            <tr>
              <th scope="col">Penguin</th>
              <th scope="col">Species</th>
              <th scope="col">Selection</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.id}</th>
                <td>{row.species}</td>
                <td>
                  <button
                    type="button"
                    style={{ minHeight: 44 }}
                    aria-pressed={selected.includes(row.id)}
                    onClick={() => {
                      interaction.toggleSelection(row.id, { scope });
                    }}
                    onPointerEnter={() => {
                      interaction.setEmphasis([row.id], { scope });
                    }}
                    onPointerLeave={() => {
                      interaction.clearEmphasis({ scope });
                    }}
                    onFocus={() => {
                      interaction.setEmphasis([row.id], { scope });
                    }}
                    onBlur={() => {
                      interaction.clearEmphasis({ scope });
                    }}
                  >
                    {selected.includes(row.id) ? "Selected" : "Select"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
