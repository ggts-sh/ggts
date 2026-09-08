/**
 * Packed-consumer fixture materialization (package.json, vite/sveltekit shells,
 * smoke route sources). Command planning: consumer-compat-plan.ts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { COMPLETE_SVELTE_SNIPPETS } from "./guide-code-contract.js";
import { SVELTE_QUICKSTART_SOURCE, SANDBOX_SPEC } from "./agent-quickstart.js";
import { type PackageManager } from "./support-matrix.js";
import { assertRecipeImports } from "./consumer-compat-skill.js";
import { consumerPlotSpec } from "./consumer-compat-plan.js";

const fixtureDependencies = [
  // The compatibility fixture must itself support the Svelte 5.33.1 floor.
  // Plugin 7 requires Svelte 5.46+, which would make the minimum row a test
  // of fixture peer resolution rather than a test of ggsvelte.
  "@sveltejs/adapter-static@3.0.10",
  "@sveltejs/kit@2.20.8",
  "@sveltejs/vite-plugin-svelte@5.1.1",
  "@types/node@22.15.3",
  "svelte-check@4.7.3",
  "typescript@6.0.3",
  "vite@6.4.3",
];

export function fixtureManifest(
  svelteVersion: string,
  tarballs: string[],
  directory: string,
  packageManager: PackageManager = "npm",
) {
  const file = (path: string) => `file:${relative(directory, path).replaceAll("\\", "/")}`;
  const named = (directoryName: string) => {
    const found = tarballs.find((path) => path.includes(`ggsvelte-${directoryName}-`));
    if (found === undefined) {
      throw new Error(`consumer fixture missing ggsvelte-${directoryName} tarball`);
    }
    return file(found);
  };
  const localPackages = {
    "@ggsvelte/spec": named("spec"),
    "@ggsvelte/core": named("core"),
    "@ggsvelte/compose": named("compose"),
    "@ggsvelte/svelte": named("svelte"),
    "@ggsvelte/cli": named("cli"),
    "@ggsvelte/skill": named("skill"),
  };
  return {
    name: "ggsvelte-packed-consumer",
    private: true,
    type: "module",
    dependencies: {
      ...localPackages,
      svelte: svelteVersion,
    },
    devDependencies: Object.fromEntries(
      fixtureDependencies.map((entry) => {
        const separator = entry.lastIndexOf("@");
        return [entry.slice(0, separator), entry.slice(separator + 1)];
      }),
    ),
    scripts: {
      check: "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings",
      build: "vite build",
    },
    ...(packageManager === "bun" ? { overrides: localPackages } : {}),
  };
}

export function writeConsumerFixture(
  directory: string,
  svelteVersion: string,
  tarballs: string[],
  packageManager: PackageManager,
): void {
  mkdirSync(join(directory, "src", "lib"), { recursive: true });
  mkdirSync(join(directory, "src", "routes", "contract"), { recursive: true });
  mkdirSync(join(directory, "src", "routes", "agent"), { recursive: true });
  writeFileSync(
    join(directory, "src", "routes", "agent", "+page.svelte"),
    SVELTE_QUICKSTART_SOURCE + "\n",
  );
  const manifest = fixtureManifest(svelteVersion, tarballs, directory, packageManager);
  writeFileSync(join(directory, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  if (packageManager === "pnpm") {
    writeFileSync(
      join(directory, "pnpm-workspace.yaml"),
      `packages: []\noverrides:\n  '@ggsvelte/spec': ${JSON.stringify(manifest.dependencies["@ggsvelte/spec"])}\n  '@ggsvelte/core': ${JSON.stringify(manifest.dependencies["@ggsvelte/core"])}\n  '@ggsvelte/compose': ${JSON.stringify(manifest.dependencies["@ggsvelte/compose"])}\n  '@ggsvelte/svelte': ${JSON.stringify(manifest.dependencies["@ggsvelte/svelte"])}\n  '@ggsvelte/cli': ${JSON.stringify(manifest.dependencies["@ggsvelte/cli"])}\n`,
    );
  }
  writeFileSync(
    join(directory, "tsconfig.json"),
    `${JSON.stringify(
      {
        extends: "./.svelte-kit/tsconfig.json",
        compilerOptions: {
          allowJs: true,
          checkJs: true,
          esModuleInterop: true,
          forceConsistentCasingInFileNames: true,
          lib: ["ES2024", "DOM", "DOM.Iterable"],
          moduleResolution: "Bundler",
          resolveJsonModule: true,
          skipLibCheck: false,
          sourceMap: true,
          strict: true,
        },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(directory, "svelte.config.js"),
    `import adapter from "@sveltejs/adapter-static";\n\nexport default { kit: { adapter: adapter() } };\n`,
  );
  writeFileSync(
    join(directory, "vite.config.ts"),
    `import { sveltekit } from "@sveltejs/kit/vite";\nimport { defineConfig } from "vite";\n\nexport default defineConfig({ plugins: [sveltekit()] });\n`,
  );
  writeFileSync(
    join(directory, "src", "app.html"),
    `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width" />\n    %sveltekit.head%\n  </head>\n  <body data-sveltekit-preload-data="hover">\n    <div style="display: contents">%sveltekit.body%</div>\n  </body>\n</html>\n`,
  );
  writeFileSync(join(directory, "src", "routes", "+layout.ts"), `export const prerender = true;\n`);
  for (const snippet of COMPLETE_SVELTE_SNIPPETS) {
    const target = join(directory, snippet.filename);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${snippet.source}\n`);
  }
  writeFileSync(
    join(directory, "src", "routes", "contract", "+page.svelte"),
    `<script lang="ts">
  import { Coord, coord_transform, coordTransform, dmy, GGPlot, GeomLine, GeomPoint, guideColorsteps, guideLegend, guide_legend, Guides, Scale, scaleColorBinned, scaleColourBinned, scaleShapeDiscrete, scaleSizeContinuous, scaleXBinned, scaleXDate, scaleXLog10, scale_color_binned, scale_colour_binned, scale_shape_discrete, scale_x_date, scale_x_log10, type GuidePlan, type PortableSpec } from "@ggsvelte/svelte";
  const spec: PortableSpec = ${JSON.stringify(consumerPlotSpec)};
  const temporalRows = [
    { year: "1835", value: 12 },
    { year: "1900", value: 19 },
    { year: "2026", value: 31 },
  ];
  const explicitDateScale = scale_x_date({ parse: "dmy" });
  const camelDateScale = scaleXDate({
    parse: "iso",
    dateBreaks: "2 weeks",
    dateMinorBreaks: "1 day",
    dateLabels: "%e %b",
    locale: "en-GB",
    weekStart: "monday",
  });
  const authorDate = dmy("31/12/2024");
  const logScale = scaleXLog10({ limits: [1, 1000] });
  const logAlias = scale_x_log10({ limits: [1, 1000] });
  const binnedScale = scaleXBinned({ breaks: [1, 10, 100, 1000] });
  const binnedColor = scaleColorBinned({ breaks: [1, 10, 100, 1000] });
  if (scaleColorBinned !== scaleColourBinned || scaleColorBinned !== scale_color_binned || scaleColorBinned !== scale_colour_binned) throw new Error("color alias identity mismatch");
  if (scaleShapeDiscrete !== scale_shape_discrete) throw new Error("shape alias identity mismatch");
  if (guideLegend !== guide_legend) throw new Error("guide alias identity mismatch");
  const transformedCoord = coordTransform({ x: "log10" });
  if (coord_transform !== coordTransform) throw new Error("coord alias identity mismatch");
  void transformedCoord;
  void logScale;
  void logAlias;
  void binnedScale;
  void binnedColor;
  void explicitDateScale;
  void camelDateScale;
  const guidePlan: GuidePlan | undefined = undefined;
  void authorDate;
  void guidePlan;
</script>

<GGPlot {spec} width={480} height={320} inspect={true} ariaLabel="Packed contract chart" />
<GGPlot
  data={temporalRows}
  aes={{ x: "year", y: "value" }}
  width={480}
  height={320}
  ariaLabel="Raw year temporal contract chart"
>
  <GeomLine />
</GGPlot>
<GGPlot
  data={[{ x: 1, y: 1 }, { x: 10, y: 2 }, { x: 100, y: 3 }]}
  aes={{ x: "x", y: "y" }}
  width={480}
  height={320}
  ariaLabel="Packed log transform contract chart"
>
  <Scale value={scaleXLog10()} />
  <GeomPoint />
</GGPlot>
<GGPlot
  data={[{ x: 1, y: 1 }, { x: 10, y: 2 }, { x: 100, y: 3 }]}
  aes={{ x: "x", y: "y", color: "x" }}
  width={480}
  height={320}
  ariaLabel="Packed binned color contract chart"
>
  <Scale value={scaleColorBinned({ breaks: [1, 10, 100] })} />
  <Guides value={{ color: guideColorsteps({ position: "bottom", direction: "horizontal" }) }} />
  <GeomPoint />
</GGPlot>
<GGPlot
  data={[{ x: 1, y: 1, amount: 2, group: "a" }, { x: 2, y: 2, amount: 8, group: "b" }]}
  aes={{ x: "x", y: "y", size: "amount", shape: "group" }}
  width={480}
  height={320}
  ariaLabel="Packed mapped style contract chart"
>
  <Scale value={{ ...scaleSizeContinuous(), ...scaleShapeDiscrete() }} />
  <GeomPoint />
</GGPlot>
<GGPlot
  data={[{ x: 1, y: 1 }, { x: 10, y: 2 }, { x: 100, y: 3 }]}
  aes={{ x: "x", y: "y" }}
  width={480}
  height={320}
  ariaLabel="Packed post-stat coordinate contract chart"
>
  <Coord value={coordTransform({ x: "log10" })} />
  <GeomPoint />
</GGPlot>
`,
  );
  assertRecipeImports(SVELTE_QUICKSTART_SOURCE, ["@ggsvelte/svelte"], "Svelte quickstart");
  writeFileSync(join(directory, "plot.json"), `${JSON.stringify(SANDBOX_SPEC)}\n`);
  writeFileSync(
    join(directory, "verify-prerender.mjs"),
    `import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";

const html = readFileSync("build/index.html", "utf8");
// The starter file omits ariaLabel (production polish). The library still
// emits a generated role=img aria-label from the scene.
assert.match(html, /role="img"[^>]*aria-label="[^"]+"|aria-label="[^"]+"[^>]*role="img"/);
assert.match(html, /class="gg-plot-root[^"]*gg-container-width"/);
assert.match(html, /data-gg-ready="false"/);
assert.match(html, /width="832" height="400"/);
assert.match(html, /_app\\/immutable/);
assert.equal(
  existsSync("build/contract.html") || existsSync("build/contract/index.html"),
  true,
);
const agentHtml = readFileSync(existsSync("build/agent.html") ? "build/agent.html" : "build/agent/index.html", "utf8");
assert.match(agentHtml, /Annual sales/);
for (const year of ["2023", "2024", "2025"]) assert.ok(agentHtml.includes(year));
console.log("prerendered Quickstart verified");
`,
  );
  writeFileSync(
    join(directory, "smoke.mjs"),
    `import { strict as assert } from "node:assert";
import { coord_equal, coord_fixed, coord_transform, coordEqual, coordFixed, coordTransform, guideColorsteps, guideLegend, guide_legend, SpecModule, normalize, scaleColorBinned, scaleColourBinned, scaleShapeDiscrete, scaleSizeContinuous, scaleXBinned, scaleXLog10, scale_colour_binned, scale_shape_discrete, scale_x_log10, validate } from "@ggsvelte/spec";
import { registerAll, renderToSVGString, runPipeline } from "@ggsvelte/core";

// Headless full-grammar rendering (#1420): explicit opt-in.
registerAll();
import {
  KYOTO_SAKURA_CITATION,
  MPG_CITATION,
  PALMER_PENGUINS_CITATION,
  kyotoSakura,
  mpg,
  palmerPenguins,
} from "@ggsvelte/core/data";

// Bundled datasets resolve from the packed tarball's subpath export, which is
// what makes a copy-pasted quickstart file build in a bare app.
assert.equal(kyotoSakura.length, 838);
assert.equal(kyotoSakura[0].year, 812);
assert.match(KYOTO_SAKURA_CITATION, /Aono/);
assert.equal(palmerPenguins.length, 333);
assert.equal(palmerPenguins[0].species, "Adelie");
assert.match(PALMER_PENGUINS_CITATION, /Horst/);
assert.equal(mpg.length, 234);
assert.equal(mpg[0].manufacturer, "audi");
assert.match(MPG_CITATION, /EPA/);

const pointParamsSchema = SpecModule.Import("PointParams");
void pointParamsSchema;
const spec = ${JSON.stringify(consumerPlotSpec)};
const logScale = scaleXLog10();
assert.deepEqual(logScale, scale_x_log10());
assert.equal(coordTransform, coord_transform);
assert.equal(coordFixed, coord_fixed);
assert.equal(coordEqual, coord_equal);
assert.equal(coordEqual, coordFixed);
assert.deepEqual(coordFixed(), { type: "fixed" });
assert.equal(scaleColorBinned, scaleColourBinned);
assert.equal(scaleColorBinned, scale_colour_binned);
assert.equal(scaleShapeDiscrete, scale_shape_discrete);
assert.equal(guideLegend, guide_legend);
assert.deepEqual(scaleSizeContinuous({ range: [2, 8] }), { size: { type: "sequential", range: [2, 8] } });
assert.deepEqual(coordTransform({ x: "log10" }), { type: "transform", x: { transform: "log10" } });
assert.equal(normalize({ data: spec.data, layers: spec.layers, scales: logScale }).scales.x.type, "linear");
assert.equal(normalize({ data: spec.data, layers: spec.layers, scales: logScale }).scales.x.transform, "log10");
const binnedSpec = {
  data: { values: [{ x: 1, y: 1 }, { x: 9, y: 2 }, { x: 11, y: 3 }] },
  layers: [{ geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } }],
  scales: scaleXBinned({ breaks: [0, 10, 20] }),
};
const colorSpec = {
  data: { values: [{ x: 1, y: 1, score: 1 }, { x: 2, y: 2, score: 10 }, { x: 3, y: 3, score: 100 }] },
  layers: [{ geom: "point", aes: { x: { field: "x" }, y: { field: "y" }, color: { field: "score" } } }],
  scales: scaleColorBinned({ breaks: [1, 10, 100] }),
  guides: { color: guideColorsteps({ position: "bottom" }) },
};
const temporalSpec = {
  data: { values: [{ year: "1835", value: 12 }, { year: "2026", value: 31 }] },
  layers: [{ geom: "line", aes: { x: { field: "year" }, y: { field: "value" } } }],
  scales: { x: { type: "time", dateBreaks: "50 years", dateLabels: "%Y", locale: "en-GB" } },
};
assert.equal(validate(spec).ok, true);
assert.equal(validate(temporalSpec).ok, true);
assert.equal(validate(binnedSpec).ok, true);
assert.equal(validate(colorSpec).ok, true);
const colorModel = runPipeline(colorSpec, { width: 480, height: 320 });
assert.equal(colorModel.scales.color.kind, "binned");
assert.equal(colorModel.guidePlans.some((plan) => plan.type === "colorsteps"), true);
const binnedModel = runPipeline(binnedSpec, { width: 480, height: 320 });
assert.equal(binnedModel.scales.x.type, "linear");
assert.match(renderToSVGString(spec, { width: 480, height: 320 }), /<svg/);
assert.match(renderToSVGString(temporalSpec, { width: 480, height: 320 }), /1835|1850/);
console.log("consumer smoke passed");
`,
  );
}
