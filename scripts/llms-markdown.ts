/**
 * Minimal markdown renderer for guide sections (headings, paragraphs, fenced
 * code, inline code, links, unordered lists). Shared by docs pages and llms
 * surfaces via gen-llms.
 */
import { GUIDE_COPY_ICON_SVG } from "../apps/docs/src/lib/guide-code-copy";
import { highlightCodeToHtml } from "./highlight-code";

// Minimal markdown renderer (headings, paragraphs, fenced code, inline code,
// links, unordered lists) — enough for the guide sections below, nothing more.
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
function inline(s: string, base: string): string {
  let out = escapeHtml(s);
  out = out.replaceAll(/`([^`]+)`/g, (_m, code: string) => `<code>${code}</code>`);
  out = out.replaceAll(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, text: string, href: string) =>
      `<a href="${href.startsWith("/") ? `${base}${href}` : href}">${text}</a>`,
  );
  out = out.replaceAll(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return out;
}

function createHeadingId(): (text: string) => string {
  const headingCounts = new Map<string, number>();
  return (text: string): string => {
    const stem =
      text
        .replaceAll(/`([^`]+)`/g, "$1")
        .toLowerCase()
        .normalize("NFKD")
        .replaceAll(/[\u0300-\u036F]/g, "")
        .replaceAll(/[^a-z0-9]+/g, "-")
        .replaceAll(/^-|-$/g, "") || "section";
    const count = (headingCounts.get(stem) ?? 0) + 1;
    headingCounts.set(stem, count);
    return count === 1 ? stem : `${stem}-${String(count)}`;
  };
}

export interface MarkdownHeading {
  level: number;
  id: string;
  title: string;
}

/** Extract the exact heading ids used by renderMarkdown for page navigation. */
export function extractMarkdownHeadings(md: string): MarkdownHeading[] {
  const headingId = createHeadingId();
  const headings: MarkdownHeading[] = [];
  for (const line of md.split("\n")) {
    const heading = /^(#{1,4}) (.*)$/.exec(line);
    if (heading === null) continue;
    const rawTitle = heading[2]!;
    headings.push({
      level: heading[1]!.length,
      id: headingId(rawTitle),
      title: rawTitle
        .replaceAll(/`([^`]+)`/g, "$1")
        .replaceAll(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replaceAll("**", ""),
    });
  }
  return headings;
}

/** Render the markdown subset used by the guide sections to HTML. */
export function renderMarkdown(md: string, base = ""): string {
  const lines = md.split("\n");
  const html: string[] = [];
  let paragraph: string[] = [];
  let list: string[] | null = null;
  let code: string[] | null = null;
  let codeLang = "";
  let codeCopy = false;
  let copyCodeCount = 0;
  const headingId = createHeadingId();

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      html.push(`<p>${inline(paragraph.join(" "), base)}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list !== null) {
      html.push(`<ul>${list.map((li) => `<li>${inline(li, base)}</li>`).join("")}</ul>`);
      list = null;
    }
  };
  const renderCode = (source: string): string => {
    const languageClass = codeLang === "" ? ' class="hljs"' : ` class="hljs language-${codeLang}"`;
    const highlighted = highlightCodeToHtml(source, codeLang);
    const pre = `<pre><code${languageClass}>${highlighted}</code></pre>`;
    if (!codeCopy) return pre;
    const id = `guide-code-${String(++copyCodeCount)}`;
    return `<div class="guide-code-copy"><button type="button" data-copy-code="${id}" aria-label="Copy code" aria-describedby="${id}-status">${GUIDE_COPY_ICON_SVG}</button><pre id="${id}"><code${languageClass}>${highlighted}</code></pre><span id="${id}-status" role="status" class="visually-hidden"></span></div>`;
  };

  for (const line of lines) {
    if (code !== null) {
      if (line.startsWith("```")) {
        html.push(renderCode(code.join("\n")));
        code = null;
      } else {
        code.push(line);
      }
      continue;
    }
    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      const [language = "", ...flags] = line.slice(3).trim().split(/\s+/);
      codeLang = /^[a-z0-9-]*$/i.test(language) ? language : "";
      codeCopy = flags.includes("copy");
      code = [];
      continue;
    }
    const heading = /^(#{1,4}) (.*)$/.exec(line);
    if (heading !== null) {
      flushParagraph();
      flushList();
      const level = heading[1]!.length;
      const id = headingId(heading[2]!);
      // Keep links from pre-rename package documentation usable.
      if (id.startsWith("ggts-sh-")) {
        html.push(`<span id="${id.replace("ggts-sh-", "ggsvelte-")}"></span>`);
      }
      html.push(`<h${level} id="${id}">${inline(heading[2]!, base)}</h${level}>`);
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      list ??= [];
      list.push(line.slice(2));
      continue;
    }
    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }
    if (list !== null && line.startsWith("  ")) {
      list[list.length - 1] += " " + line.trim();
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  if (code !== null) html.push(renderCode(code.join("\n")));
  return html.join("\n");
}

// ---------------------------------------------------------------------------
