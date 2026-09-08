/**
 * The minimal markdown renderer backing every guide surface: heading
 * fragments, HTML escaping, link prefixing, and the allowlisted copy fences.
 */
import { describe, expect, it } from "bun:test";

import { renderMarkdown } from "../gen-llms.ts";

describe("renderMarkdown", () => {
  it("renders headings, paragraphs, lists, code, inline code, links", () => {
    const html = renderMarkdown(
      "# T\n\npara with `code` and [x](/y)\n\n- a\n- b\n\n```ts\nconst a = 1 < 2;\n```\n",
    );
    expect(html).toContain('<h1 id="t">T</h1>');
    expect(html).toContain('<p>para with <code>code</code> and <a href="/y">x</a></p>');
    expect(html).toContain("<ul><li>a</li><li>b</li></ul>");
    expect(html).toContain('<pre><code class="hljs language-ts">');
    expect(html).toContain('hljs-keyword">const</span>');
    expect(html).toContain('hljs-number">1</span>');
    expect(html).toContain("&lt;");
  });

  it("escapes HTML everywhere", () => {
    expect(renderMarkdown("<script>alert(1)</script>")).not.toContain("<script>");
  });

  it("prefixes root-relative guide links for project-hosted docs", () => {
    const html = renderMarkdown(
      "[docs](/guide/errors) [external](https://example.com)",
      "/ggsvelte",
    );
    expect(html).toContain('href="/ggsvelte/guide/errors"');
    expect(html).toContain('href="https://example.com"');
  });

  it("renders allowlisted copy fences with accessible icon controls and status", () => {
    const html = renderMarkdown('```json fragment copy\n{"x": 1}\n```');
    expect(html).toContain('<button type="button" data-copy-code="guide-code-1"');
    expect(html).toContain('aria-label="Copy code"');
    expect(html).toContain('aria-describedby="guide-code-1-status"');
    expect(html).toContain("<svg");
    expect(html).not.toContain(">Copy code</button>");
    expect(html).toContain('<pre id="guide-code-1"><code class="hljs language-json">');
    expect(html).toContain("hljs-");
    expect(html).toContain('<span id="guide-code-1-status" role="status" class="visually-hidden">');
  });

  it("never stamps a classification label over a code block", () => {
    for (const fence of [
      '```json fragment copy\n{"x": 1}\n```',
      "```svelte complete\n<script></script>\n```",
      "```sh complete\nbun add @ggts-sh/svelte\n```",
      "```ts\nconst x = 1;\n```",
    ]) {
      const html = renderMarkdown(fence);
      expect(html).not.toContain("guide-code-classification");
      expect(html).not.toMatch(/>(Fragment|Complete file|Complete command|Complete example)</);
    }
  });

  it("adds stable unique heading fragments", () => {
    const html = renderMarkdown("# Events\n\n## `onselect` event\n\n## `onselect` event");
    expect(html).toContain('<h1 id="events">Events</h1>');
    expect(html).toContain('<h2 id="onselect-event"><code>onselect</code> event</h2>');
    expect(html).toContain('<h2 id="onselect-event-2"><code>onselect</code> event</h2>');
  });
});

it("preserves pre-rename lifecycle package anchors", () => {
  const html = renderMarkdown("## @ggts-sh/svelte");
  expect(html).toContain('id="ggts-sh-svelte"');
  expect(html).toContain('id="ggsvelte-svelte"');
});
