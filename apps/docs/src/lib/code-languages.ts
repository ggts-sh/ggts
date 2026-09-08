/**
 * Docs code-block language helpers. Highlighting uses the shared highlight.js
 * allowlist in scripts/highlight-code (same as guide markdown fences).
 *
 * Relative import (not `$scripts/…`): `scripts/tsconfig.json` typechecks this
 * module via `scripts/code-languages.test.ts`, and that project has no SvelteKit
 * path aliases.
 */
import { highlightCodeToHtml, resolveHighlightLanguage } from "../../../../scripts/highlight-code";

/**
 * Infer a highlight language from a code-tab label when no explicit language prop is set
 * (e.g. "Builder (TS)", "Spec (JSON)", "Svelte").
 */
export function languageFromCodeTabLabel(label?: string): string {
  if (label === undefined) return "plaintext";
  const lower = label.toLowerCase();
  if (lower.includes("react")) return "tsx";
  if (lower.includes("svelte")) return "svelte";
  if (lower.includes("json") || lower.includes("spec")) return "json";
  if (lower.includes("ts") || lower.includes("builder") || lower.includes("type")) {
    return "typescript";
  }
  return "plaintext";
}

/**
 * Normalize a fence / prop language to a stable id. Unknown or empty names
 * become `"plaintext"` (escaped, no tokens).
 */
export function resolveCodeLanguage(lang?: string): string {
  if (lang === undefined || lang.trim() === "") return "plaintext";
  const key = lang.trim().toLowerCase();
  if (key === "plaintext" || key === "text") return "plaintext";
  if (resolveHighlightLanguage(key) !== undefined) return key;
  return "plaintext";
}

/**
 * Full `<pre><code class="hljs …">` HTML for docs CopyCode / CodeTabs.
 * Token spans come from highlight.js; unknown languages are escaped plaintext.
 */
export function highlightDocsBlock(source: string, lang?: string): string {
  const id = resolveCodeLanguage(lang);
  const fenceLang = id === "plaintext" ? "" : id;
  const body = highlightCodeToHtml(source, fenceLang);
  const languageClass = fenceLang === "" ? ' class="hljs"' : ` class="hljs language-${fenceLang}"`;
  return `<pre class="hljs"><code${languageClass}>${body}</code></pre>`;
}
