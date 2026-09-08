import type { PortableSpec } from "@ggsvelte/spec";
import cliPackage from "../packages/cli/package.json";

/** One runnable chart shared by sandbox and framework onboarding. */
export const SANDBOX_SPEC: PortableSpec = {
  data: {
    values: [
      { year: "2023", sales: 12 },
      { year: "2024", sales: 18 },
      { year: "2025", sales: 25 },
    ],
  },
  aes: { x: { field: "year" }, y: { field: "sales" } },
  layers: [{ geom: "col" }],
  scales: { x: { type: "band" } },
  labs: { title: "Annual sales", x: "Year", y: "Sales" },
};

export const SANDBOX_SPEC_JSON = JSON.stringify(SANDBOX_SPEC, null, 2);
export const SANDBOX_INSTALL = `npm install --save-dev --save-exact @ggsvelte/cli@${cliPackage.version} @ggsvelte/skill@${cliPackage.version}`;
export const SANDBOX_COMMANDS = `npm exec -- ggts check chart.json
npm exec -- ggts render chart.json > chart.svg`;

export const SANDBOX_PROMPT = `Read node_modules/@ggsvelte/skill/SKILL.md. Make a column chart of annual sales:
2023: 12, 2024: 18, 2025: 25. Save the complete PortableSpec to chart.json.
Run npm exec -- ggts check chart.json, read its diagnostics, and fix any errors.
Render chart.svg with npm exec -- ggts render chart.json and inspect the chart.`;

export const REACT_QUICKSTART_SOURCE = `"use client";

import { GGPlot, registerAll, type PortableSpec } from "@ggsvelte/react";

registerAll();
const spec: PortableSpec = ${SANDBOX_SPEC_JSON};

export default function SalesChart() {
  return <GGPlot spec={spec} height={400} />;
}`;

export const SVELTE_QUICKSTART_SOURCE = `<script lang="ts">
  import { GGPlot, registerAll, type PortableSpec } from "@ggsvelte/svelte";

  registerAll();
  const spec: PortableSpec = ${SANDBOX_SPEC_JSON};
</script>

<GGPlot {spec} height={400} />`;

/** Pair this complete host with the gallery's complete Spec JSON as chart.json. */
export const REACT_SPEC_HOST_SOURCE = `"use client";

import { GGPlot, registerAll, normalize } from "@ggsvelte/react";
import input from "./chart.json";

registerAll();
const spec = normalize(input);

export default function Chart() {
  return <GGPlot spec={spec} />;
}`;
