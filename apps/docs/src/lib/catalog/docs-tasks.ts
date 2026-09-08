export interface DocsTask {
  label: string;
  description: string;
  hrefs: readonly [string, ...string[]];
}

export const DOCS_TASKS = [
  {
    label: "Getting started",
    description: "Install @ggts-sh/svelte and render one chart from a Svelte file.",
    hrefs: ["/guide/getting-started"],
  },
  {
    label: "Scales, themes, color",
    description: "Axes, legends, chart themes, and categorical or sequential color.",
    hrefs: ["/guide/scales-guides"],
  },
  {
    label: "Interaction",
    description: "Inspect, pin, select, zoom, and linked semantic state.",
    hrefs: ["/guide/interactions"],
  },
  {
    label: "Layout and export",
    description: "Container sizing, SVG/canvas rendering, SSR, and headless SVG.",
    hrefs: ["/guide/production"],
  },
  {
    label: "Diagnostics",
    description: "Validation, render, interaction, and CLI error codes.",
    hrefs: ["/guide/errors"],
  },
] as const satisfies readonly DocsTask[];
