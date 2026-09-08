/**
 * Social-card paths, dimensions, and helpers for docs SEO.
 * Kept free of Playwright and free of generator side-effects so the docs app
 * can import this at prerender time via `docs-seo.ts`.
 */
// Extensionless import: this module is pulled into apps/docs via $scripts/docs-seo
// and svelte-check does not allow `.ts` extensions (unlike scripts/tsconfig).
import { EXAMPLES } from "../examples/manifest";

/** Cache-busting path: bump the version segment when the card content changes. */
export const OG_HOME_FILENAME = "home-v5.png";
export const OG_HOME_PATH = `/og/${OG_HOME_FILENAME}`;
export const OG_HOME_WIDTH = 1200;
export const OG_HOME_HEIGHT = 630;
/** Stable alt — no volatile bench timings (those live in the PNG pixels). */
export const OG_HOME_ALT =
  "ggsvelte: ggplot2’s grammar for TypeScript, with a sales chart shared by the CLI, React, and Svelte.";

export const DEFAULT_SOCIAL = {
  path: OG_HOME_PATH,
  width: OG_HOME_WIDTH,
  height: OG_HOME_HEIGHT,
  alt: OG_HOME_ALT,
} as const;

/** Same mapping as gallery previews / provenance — inlined to avoid importing generators. */
export function previewFilename(id: string): string {
  return `${id.replaceAll("/", "-")}-light.png`;
}

export function readPngSize(buf: Buffer): { width: number; height: number } {
  if (buf.length < 24 || buf.toString("ascii", 1, 4) !== "PNG") {
    throw new Error("not a PNG");
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

export interface SocialImageSource {
  path: string;
  width: number;
  height: number;
  alt: string;
}

/** Map /examples/<id> (or an alias canonical) onto a gallery light preview when present. */
export function socialImageForRoute(route: {
  path: string;
  canonicalPath: string;
}): SocialImageSource {
  // Prefer the canonical path so legacy alias URLs unfurl the real example chart.
  const path = route.canonicalPath;
  if (!path.startsWith("/examples/")) return DEFAULT_SOCIAL;

  const exampleId = path.slice("/examples/".length);
  if (exampleId === "" || exampleId.includes("..") || exampleId.includes("\\")) {
    return DEFAULT_SOCIAL;
  }

  const entry = EXAMPLES.find((example) => example.id === exampleId);
  if (entry === undefined) return DEFAULT_SOCIAL;

  // Dimensions match gallery VR crops (see examples/manifest vrWidth/vrHeight).
  // Do not open PNGs here — import.meta.dir under Vite prerender is fragile, and
  // gallery-lights tests already enforce preview size against these fields.
  return {
    path: `/previews/${previewFilename(entry.id)}`,
    width: entry.vrWidth ?? 640,
    height: entry.vrHeight ?? 400,
    alt: entry.title,
  };
}
