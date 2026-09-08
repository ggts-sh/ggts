/**
 * Shared syntax highlighting for guide markdown (SSR) and unit tests.
 * Uses highlight.js with a small allowlisted language map; unknown languages
 * fall back to escaped plaintext so untrusted fences never inject markup.
 */
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";

let registered = false;

function ensureRegistered(): void {
  if (registered) return;
  hljs.registerLanguage("bash", bash);
  hljs.registerLanguage("css", css);
  hljs.registerLanguage("javascript", javascript);
  hljs.registerLanguage("json", json);
  hljs.registerLanguage("typescript", typescript);
  // Svelte/HTML fences: tag-aware highlighting via the XML grammar.
  hljs.registerLanguage("xml", xml);
  registered = true;
}

/** Fence aliases used in guide markdown and docs components. */
const LANGUAGE_ALIASES: Record<string, string> = {
  bash: "bash",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  css: "css",
  js: "javascript",
  javascript: "javascript",
  json: "json",
  ts: "typescript",
  tsx: "typescript",
  jsx: "javascript",
  typescript: "typescript",
  html: "xml",
  svelte: "xml",
  xml: "xml",
};

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Resolve a fence language token to a registered highlight.js language id. */
export function resolveHighlightLanguage(lang: string): string | undefined {
  const key = lang.trim().toLowerCase();
  if (key === "") return undefined;
  return LANGUAGE_ALIASES[key];
}

/**
 * Highlight source to HTML token spans (no surrounding pre/code).
 * Returns escaped plaintext when the language is unknown or highlighting fails.
 */
export function highlightCodeToHtml(source: string, lang: string): string {
  ensureRegistered();
  const resolved = resolveHighlightLanguage(lang);
  if (resolved === undefined) return escapeHtml(source);
  try {
    return hljs.highlight(source, { language: resolved, ignoreIllegals: true }).value;
  } catch {
    return escapeHtml(source);
  }
}
