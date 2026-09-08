/**
 * Minimal reference-page code snippets for geom / stat / position detail pages.
 *
 * Plot-level aes must match what the layer's default stat actually consumes —
 * bar/count/bin geoms publish y, so mapping aes.y in the sample contradicts the
 * lede ("Do not map aes.y").
 */

/** Default stats that compute y (or stack height) from x alone. */
const X_ONLY_STATS = new Set(["count", "bin", "density", "bindot", "ecdf"]);

/**
 * Plot-level aes object literal for a geom reference snippet.
 * Prefer the channels the default stat needs; never invent a y when the
 * description tells authors not to map one.
 */
export function plotAesLiteral(geom: string, defaultStat: string): string {
  if (geom === "qq" || geom === "qq_line") {
    return 'aes={{ sample: "sample" }}';
  }
  if (geom === "hline") {
    // Annotation form uses params.yintercept; plot aes is optional.
    return "";
  }
  if (geom === "vline") {
    return "";
  }
  if (geom === "blank") {
    return 'aes={{ x: "x", y: "y" }}';
  }
  if (X_ONLY_STATS.has(defaultStat)) {
    return 'aes={{ x: "x" }}';
  }
  return 'aes={{ x: "x", y: "y" }}';
}

function plotOpenTag(aesLiteral: string): string {
  if (aesLiteral === "") {
    return "<GGPlot data={rows}>";
  }
  return `<GGPlot data={rows} ${aesLiteral}>`;
}

/** Svelte import + plot shell for a geom detail page. */
export function buildGeomSvelteSnippet(
  component: string,
  geom: string,
  defaultStat: string,
  params: readonly { name: string; required: boolean }[],
): string {
  const required = params.filter((p) => p.required).map((p) => p.name);
  const aes = plotAesLiteral(geom, defaultStat);
  const open = plotOpenTag(aes);
  if (required.length === 0) {
    return `import { GGPlot, ${component} } from "@ggts-sh/svelte";\n\n${open}\n  <${component} />\n</GGPlot>`;
  }
  const props = "\n" + required.map((p) => `  ${p}={/* … */}`).join("\n") + "\n";
  return `import { GGPlot, ${component} } from "@ggts-sh/svelte";\n\n${open}\n  <${component}${props}/>\n</GGPlot>`;
}

/** JSON layer object for a geom detail page (required params only). */
export function buildGeomJsonSnippet(
  geom: string,
  defaultStat: string,
  params: readonly { name: string; required: boolean }[],
): string {
  const required = params.filter((p) => p.required).map((p) => p.name);
  const paramsObj =
    required.length === 0
      ? ""
      : `,\n  "params": { ${required.map((p) => `"${p}": /* … */`).join(", ")} }`;
  return `{\n  "geom": "${geom}"${defaultStat === "identity" ? "" : `,\n  "stat": "${defaultStat}"`}${paramsObj}\n}`;
}
