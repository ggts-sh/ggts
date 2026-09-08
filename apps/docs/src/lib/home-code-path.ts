/**
 * Home code-path diptych: the same penguins chart as GrammarDemo, shown as
 * Svelte children and agent JSON.
 *
 * Hand-authored (not loadExample) so the JSON tab can use data: { name } and
 * never dump every row into a mile-tall panel. Matches the interactive
 * grammar chart above the code tabs on the homepage.
 *
 * Data: bundled `palmerPenguins` from `@ggts-sh/core/data` (333 complete
 * cases). Field names match the published dataset, not the short theme-specimen
 * aliases.
 *
 * Interaction: the live chart uses xy inspect (numeric crosshair on both axes)
 * plus GuideLegend focus. Prefer `<Inspect>` for the host capability; legend
 * focus is a host-only prop on `<GuideLegend>` (not a PortableSpec field).
 * - Svelte: `<Inspect>` child; `focus` on <GuideLegend>
 * - Row identity defaults to the `id` column on palmerPenguins (no `key` prop)
 * - JSON: agent envelope `{ interactions, spec }` may flag inspect; legend
 *   focus/filter are Svelte GuideLegend children, not envelope fields.
 */

const HOME_CODE_PATH_SVELTE = `<script lang="ts">
  import { GeomJitter, GeomSmooth, GGPlot, GuideLegend, Inspect, Labs } from "@ggts-sh/svelte";
  import { palmerPenguins } from "@ggts-sh/core/data";
</script>

<GGPlot
  data={palmerPenguins}
  aes={{ x: "flipperLengthMm", y: "bodyMassG", color: "species" }}
  width={640}
  height={400}
>
  <GeomJitter alpha={0.88} />
  <GeomSmooth method="loess" span={0.75} degree={1} se={false} />
  <GuideLegend channel="color" focus />
  <Labs x="Flipper length mm" y="Body mass g" color="species" />
  <Inspect mode="xy" pin maxDistance={24} />
</GGPlot>
`;

/**
 * Agent envelope: host interaction flags + named-data PortableSpec.
 * `spec` alone is valid PortableSpec; interactions are applied by the host.
 * Envelope `inspect: true` defaults mode "auto"; the live homepage uses xy
 * via `<Inspect mode="xy" … />` in the Svelte tabs. Legend focus is not an
 * envelope field — use `<GuideLegend channel="color" focus />` in Svelte.
 */
const HOME_CODE_PATH_SPEC_JSON = `{
  "edition": 2,
  "data": {
    "name": "palmerPenguins"
  },
  "layers": [
    {
      "geom": "jitter",
      "stat": "identity",
      "position": "jitter",
      "aes": {
        "x": {
          "field": "flipperLengthMm"
        },
        "y": {
          "field": "bodyMassG"
        },
        "color": {
          "field": "species"
        }
      },
      "params": {
        "alpha": 0.88
      }
    },
    {
      "geom": "smooth",
      "stat": "smooth",
      "position": "identity",
      "aes": {
        "x": {
          "field": "flipperLengthMm"
        },
        "y": {
          "field": "bodyMassG"
        },
        "color": {
          "field": "species"
        }
      },
      "params": {
        "method": "loess",
        "span": 0.75,
        "degree": 1,
        "se": false
      }
    }
  ]
}\n`;

const HOME_CODE_PATH_REACT = `"use client";

import { GeomJitter, GeomSmooth, GGPlot, GuideLegend, Inspect, Labs } from "@ggts-sh/react";
import { palmerPenguins } from "@ggts-sh/core/data";

export default function PenguinChart() {
  return (
    <GGPlot data={palmerPenguins}
      aes={{ x: "flipperLengthMm", y: "bodyMassG", color: "species" }}
      width={640} height={400}>
      <GeomJitter alpha={0.88} />
      <GeomSmooth method="loess" span={0.75} degree={1} se={false} />
      <GuideLegend channel="color" focus />
      <Labs x="Flipper length mm" y="Body mass g" color="species" />
      <Inspect mode="xy" pin maxDistance={24} />
    </GGPlot>
  );
}`;

/** Only public home code-path surface — tab labels + sources for CodeTabs. */
export const HOME_CODE_PATH_TABS: {
  label: string;
  code: string;
  language: string;
}[] = [
  { label: "React", code: HOME_CODE_PATH_REACT, language: "tsx" },
  { label: "Svelte", code: HOME_CODE_PATH_SVELTE, language: "svelte" },
  {
    label: "Spec (JSON)",
    code: HOME_CODE_PATH_SPEC_JSON,
    language: "json",
  },
];
