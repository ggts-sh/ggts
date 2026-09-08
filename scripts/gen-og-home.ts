/**
 * Render the site-wide Open Graph / Twitter large-image card for ggts.sh.
 *
 * Layout mirrors the homepage hero (headline + sandbox example),
 * framed for the standard 1200×630 social card crop used by WhatsApp, Slack,
 * iMessage, Discord, Facebook, LinkedIn, and X.
 *
 *   bun scripts/gen-og-home.ts          # rewrite apps/docs/static/og/home-v5.png
 *   bun scripts/gen-og-home.ts --check  # assert committed PNG dimensions + IHDR
 *
 * Bump OG_HOME_FILENAME in docs-seo-image.ts (home-v5.png …) when iterating the
 * design so scrapers cannot serve a stale cached card after deploy.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";
import { registerAll, renderToSVGString } from "@ggts-sh/core";
import { SANDBOX_SPEC } from "./agent-quickstart";

import {
  OG_HOME_FILENAME,
  OG_HOME_HEIGHT,
  OG_HOME_PATH,
  OG_HOME_WIDTH,
  readPngSize,
} from "./docs-seo-image";

const ROOT = resolve(import.meta.dir, "..");
const OUT_FILE = join(ROOT, "apps", "docs", "static", "og", OG_HOME_FILENAME);

function cardHtml(chartSvg: string): string {
  // Render the same complete chart used in the sandbox quickstart.
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    @font-face {
      font-family: "Roboto Condensed";
      font-style: normal;
      font-weight: 300 700;
      font-display: block;
      src: local("Roboto Condensed"), local("Arial Narrow"), local("Arial");
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: ${String(OG_HOME_WIDTH)}px;
      height: ${String(OG_HOME_HEIGHT)}px;
      overflow: hidden;
      background: #ffffff;
      color: #1a1a1a;
      font-family: "Roboto Condensed", "Arial Narrow", Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .card {
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
      align-items: center;
      gap: 48px;
      width: 100%;
      height: 100%;
      padding: 56px 64px;
    }
    .brand {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin: 0 0 28px;
      color: #1a1a1a;
    }
    h1 {
      margin: 0;
      font-size: 52px;
      line-height: 1.05;
      letter-spacing: -0.035em;
      font-weight: 700;
      max-width: 14ch;
    }
    .fast {
      color: #4269d0;
      font-style: italic;
    }
    .url {
      margin-top: 36px;
      font-size: 20px;
      font-weight: 600;
      color: #5c6570;
      letter-spacing: -0.01em;
    }
    .panel {
      border: 1px solid #d8dee6;
      border-radius: 16px;
      padding: 20px 18px 12px;
      background: #ffffff;
      box-shadow: 0 1px 0 rgba(15, 23, 42, 0.04);
    }
    .tabs {
      display: flex;
      gap: 22px;
      margin: 0 0 14px 6px;
      font-size: 15px;
      font-weight: 600;
      color: #8a93a0;
    }
    .tabs .active {
      color: #4269d0;
      border-bottom: 2px solid #4269d0;
      padding-bottom: 4px;
    }
    .chart {
      width: 100%;
      line-height: 0;
    }
    .chart svg {
      width: 100%;
      height: auto;
      display: block;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="copy">
      <p class="brand">ggts</p>
      <h1>ggplot2’s grammar for <span class="fast">TypeScript</span></h1>
      <p class="url">Built for coding agents.<br>CLI · React · Svelte<br><br>ggts.sh</p>
    </div>
    <div class="visual">
      <div class="tabs" aria-hidden="true">
        <span class="active">One spec</span>
        <span>Every surface</span>
      </div>
      <div class="panel">
        <div class="chart">${chartSvg}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function renderOgHome(outFile: string = OUT_FILE): Promise<void> {
  registerAll();
  const html = cardHtml(renderToSVGString(SANDBOX_SPEC, { width: 480, height: 380 }));
  const tmp = mkdtempSync(join(tmpdir(), "ggsvelte-og-"));
  const htmlPath = join(tmp, "card.html");
  writeFileSync(htmlPath, html);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: OG_HOME_WIDTH, height: OG_HOME_HEIGHT },
      deviceScaleFactor: 1,
      colorScheme: "light",
      reducedMotion: "reduce",
    });
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    mkdirSync(dirname(outFile), { recursive: true });
    await page.screenshot({
      path: outFile,
      type: "png",
      animations: "disabled",
      caret: "hide",
      clip: { x: 0, y: 0, width: OG_HOME_WIDTH, height: OG_HOME_HEIGHT },
    });
  } finally {
    await browser.close();
    rmSync(tmp, { recursive: true, force: true });
  }
}

function checkCommitted(): void {
  if (!existsSync(OUT_FILE)) {
    throw new Error(`missing ${OUT_FILE}; run bun scripts/gen-og-home.ts`);
  }
  const size = readPngSize(readFileSync(OUT_FILE));
  if (size.width !== OG_HOME_WIDTH || size.height !== OG_HOME_HEIGHT) {
    throw new Error(
      `og home card is ${String(size.width)}×${String(size.height)}; expected ${String(OG_HOME_WIDTH)}×${String(OG_HOME_HEIGHT)}`,
    );
  }
  console.log(`ok ${OG_HOME_PATH} ${String(size.width)}×${String(size.height)}`);
}

if (import.meta.main) {
  if (process.argv.includes("--check")) {
    checkCommitted();
  } else {
    await renderOgHome();
    checkCommitted();
    console.log(`wrote ${OUT_FILE}`);
  }
}
