/** A clean packed React consumer: no Svelte package or workspace resolution. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { consumerPlotSpec } from "./consumer-compat-plan.js";
import { REACT_QUICKSTART_SOURCE, SANDBOX_SPEC } from "./agent-quickstart.js";
import { assertRecipeImports } from "./consumer-compat-skill.js";
import type { PackageManager } from "./support-matrix.js";

export function writeReactConsumerFixture(
  directory: string,
  reactVersion: string,
  tarballs: string[],
  packageManager: PackageManager,
): void {
  mkdirSync(directory, { recursive: true });
  const localPackages = Object.fromEntries(
    ["spec", "core", "compose", "react", "cli", "skill"].map((name) => {
      const tarball = tarballs.find((path) => path.includes(`ggsvelte-${name}-`));
      if (tarball === undefined) throw new Error(`consumer fixture missing ${name} tarball`);
      return [`@ggsvelte/${name}`, `file:${relative(directory, tarball).replaceAll("\\", "/")}`];
    }),
  );
  const write = (file: string, source: string) => {
    writeFileSync(join(directory, file), source);
  };
  const json = (file: string, value: unknown) => {
    write(file, `${JSON.stringify(value, null, 2)}\n`);
  };
  const react18 = reactVersion.startsWith("18.");
  json("package.json", {
    name: "ggsvelte-packed-react-consumer",
    private: true,
    type: "module",
    dependencies: { ...localPackages, react: reactVersion, "react-dom": reactVersion },
    devDependencies: {
      "@types/react": react18 ? "18.3.18" : "19.2.0",
      "@types/react-dom": react18 ? "18.3.5" : "19.2.0",
      typescript: "6.0.3",
      vite: "6.4.3",
    },
    scripts: { check: "tsc --noEmit", build: "node build.mjs" },
    ...(packageManager === "bun" ? { overrides: localPackages } : {}),
  });
  if (packageManager === "pnpm") {
    write("pnpm-workspace.yaml", `packages: []\noverrides: ${JSON.stringify(localPackages)}\n`);
  }
  json("tsconfig.json", {
    compilerOptions: {
      target: "ES2023",
      module: "ESNext",
      moduleResolution: "Bundler",
      jsx: "react-jsx",
      lib: ["ES2024", "DOM", "DOM.Iterable"],
      strict: true,
      skipLibCheck: false,
    },
    include: ["main.tsx", "Quickstart.tsx", "skill/**/*.ts", "skill/**/*.tsx"],
  });
  write(
    "index.html",
    '<!doctype html><html lang="en"><head><title>Packed React chart</title></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>\n',
  );
  assertRecipeImports(REACT_QUICKSTART_SOURCE, ["@ggsvelte/react"], "React quickstart");
  write("Quickstart.tsx", REACT_QUICKSTART_SOURCE + "\n");
  write(
    "main.tsx",
    `import { createRoot } from "react-dom/client";
import SalesChart from "./Quickstart.js";
import { GGPlot, GeomPoint, type PortableSpec } from "@ggsvelte/react";
const spec: PortableSpec = ${JSON.stringify(consumerPlotSpec)};
createRoot(document.getElementById("root")!).render(<>
  <SalesChart />
  <GGPlot spec={spec} width={480} height={320} ariaLabel="Packed React chart" />
  <GGPlot data={[{ x: 1, y: 2 }]} aes={{ x: "x", y: "y" }} width={480} height={320}>
    <GeomPoint />
  </GGPlot>
</>);
`,
  );
  write(
    "build.mjs",
    `import { build } from "vite";
await build();
await build({
  ssr: { noExternal: ["@ggsvelte/react", "@ggsvelte/core", "@ggsvelte/compose", "@ggsvelte/spec"] },
  build: {
    ssr: "ssr-probe.mjs",
    outDir: "dist-ssr",
    rollupOptions: { output: { entryFileNames: "ssr.mjs" } },
  },
});
`,
  );
  write(
    "ssr-probe.mjs",
    `import { strict as assert } from "node:assert";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { GGPlot, GeomPoint, GeomLine } from "@ggsvelte/react";
const data = [{ x: 1, y: 2, group: "A" }, { x: 2, y: 3, group: "A" }, { x: 3, y: 4, group: "B" }];
const aes = { x: "x", y: "y", color: "group" };
for (const geom of [GeomPoint, GeomLine]) {
  const html = renderToString(createElement(GGPlot, { data, aes, width: 480, height: 320 }, createElement(geom)));
  assert.match(html, /gg-marks/);
  assert.match(html, /data-gg-ready="false"/);
  assert.match(html, geom === GeomPoint ? /gg-points/ : /gg-paths/);
}
console.log("bundled React SSR passed");
`,
  );
  json("plot.json", SANDBOX_SPEC);
  write(
    "headless.mjs",
    `import { strict as assert } from "node:assert";
import { renderToSVGString } from "@ggsvelte/core/render";
assert.match(renderToSVGString(${JSON.stringify(consumerPlotSpec)}, { width: 480, height: 320 }), /<svg/);
`,
  );
  write(
    "smoke.mjs",
    `import { strict as assert } from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { GGPlot, GeomPoint } from "@ggsvelte/react";
const spec = ${JSON.stringify(consumerPlotSpec)};
const sandboxSpec = ${JSON.stringify(SANDBOX_SPEC)};
assert.match(renderToString(createElement(GGPlot, { spec: sandboxSpec, width: 480, height: 320 })), /Annual sales/);
assert.equal(existsSync("node_modules/@ggsvelte/svelte"), false);
assert.match(readFileSync("node_modules/@ggsvelte/skill/SKILL.md", "utf8"), /name:/);
assert.match(readFileSync("dist/index.html", "utf8"), /assets\\//);
for (const plot of [
  createElement(GGPlot, { spec, width: 480, height: 320 }),
  createElement(GGPlot, { data: [{ x: 1, y: 2 }], aes: { x: "x", y: "y" }, width: 480, height: 320 }, createElement(GeomPoint)),
]) assert.match(renderToString(plot), /gg-plot-root/);
// Each runtime runs in isolation, including the production tree-shaken bundle.
assert.equal(spawnSync(process.execPath, ["dist-ssr/ssr.mjs"], { stdio: "inherit" }).status, 0);
// Headless registration must not mask missing React host initialization.
assert.equal(spawnSync(process.execPath, ["headless.mjs"], { stdio: "inherit" }).status, 0);
console.log("consumer smoke passed");
`,
  );
}
