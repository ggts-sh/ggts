import { expect, test } from "@playwright/test";

import {
  GALLERY_FILTER_JOURNEY_CATEGORY,
  GALLERY_FILTER_JOURNEY_QUERY,
} from "../fixtures/gallery-filter-journey";

async function expectNoOverflow(page: import("@playwright/test").Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}

for (const route of ["/", "/examples/interactions/inspection"]) {
  test(`${route} chart load waits for page hydration`, async ({ page }) => {
    let releaseBootstrap!: () => void;
    const bootstrap = new Promise<void>((resolve) => {
      releaseBootstrap = resolve;
    });
    await page.route("**/_app/immutable/entry/*.js", async (request) => {
      await bootstrap;
      await request.continue();
    });
    await page.goto(route, { waitUntil: "commit" });
    const button = page.getByRole("button", { name: "Load interactive chart" });
    try {
      await expect(button).toBeDisabled();
    } finally {
      releaseBootstrap();
    }
    await expect(button).toBeEnabled();
    await button.click();
    await expect(page.locator('.gg-plot-root[data-gg-ready="true"]')).toHaveCount(1, {
      timeout: 60_000,
    });
  });
}

test("homepage restores the product description and hero benchmark tabs", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/?theme=light");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "ggts is a fast agent-native implementation of the grammar of graphics in TypeScript",
  );
  const hero = page.locator(".home-hero");
  await expect(hero.getByRole("tab", { name: "10k points", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(hero.locator("select, .code-tabs")).toHaveCount(0);
  await expect(page.getByText("Built for coding agents.", { exact: false })).toHaveCount(0);
  await expect(page.getByText("The grammar you want.", { exact: false })).toHaveCount(0);
  await expect(page.getByText("Render thousands of points without", { exact: false })).toHaveCount(
    0,
  );
  await expect(page.locator(".site-footer p")).toHaveText(
    "ggts is a fast agent-native implementation of the layered grammar of graphics, inspired by ggplot2",
  );
  await expect(page.locator(".home-featured ol li")).toHaveCount(6);
  await expect(page.locator(".home-featured header a")).toHaveText("Gallery");
  await expect(hero.locator("img:visible")).toHaveCount(1);
  await expectNoOverflow(page);
});

async function expectHomeSectionOrder(page: import("@playwright/test").Page): Promise<void> {
  const boxes = await page.evaluate(() =>
    [".home-hero h1", ".home-hero .bench-tabs", ".home-featured", ".code-path"].map((selector) => {
      const rect = document.querySelector(selector)!.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    }),
  );
  for (let index = 1; index < boxes.length; index += 1) {
    expect(boxes[index]!.top).toBeGreaterThan(boxes[index - 1]!.bottom - 1);
  }
}

test("homepage puts benchmark tabs before the gallery and code path", async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await page.goto("/?theme=light");
  await expectHomeSectionOrder(page);
  await expectNoOverflow(page);
});

test("homepage code-path section SSRs heading and a static chart shell", async ({ request }) => {
  const response = await request.get("/");
  const html = await response.text();
  // Section chrome is not gated on the dynamic plot import.
  expect(html).toContain("Svelte for builders, JSON for embedded agents.");
  expect(html).toContain('id="code-path-heading"');
  // Static shell ships before live GGPlot hydrates.
  expect(html).toContain("grammar-static");
  expect(html).toContain("Flipper length mm");
});

test("homepage grammar chart upgrades to full interactive layers on intent", async ({ page }) => {
  // Full palmerPenguins (333) + loess is heavier than a small specimen; cold CI
  // hydrate already sits near the 60s project budget.
  test.setTimeout(120_000);
  await page.goto("/");
  // Code-path chrome is SSR'd immediately — not blocked on the plot chunk.
  await expect(
    page.getByRole("heading", { name: "Svelte for builders, JSON for embedded agents." }),
  ).toBeVisible();
  const output = page.locator(".grammar-output");
  const plot = output.locator(".gg-plot-root");
  // Keyboard path: static SVG has no tab stops; the load button is the focus
  // affordance (hover still works via observeUserIntent).
  await page.getByRole("button", { name: "Load interactive chart" }).click();
  await expect(plot).toHaveAttribute("data-gg-ready", "true", {
    timeout: 60_000,
  });
  // Full chart: points, legend, smooth paths, and inspect capture.
  await expect(output.locator(".gg-points")).toHaveCount(1);
  await expect(output.locator(".gg-legend")).toHaveCount(1);
  await expect(output.locator(".gg-paths")).toHaveCount(1);
  await expect(output.locator(".gg-capture")).toBeVisible();
  // Labs match the SSR shell — no flash of raw field names on the axes.
  // After keyboard upgrade, focus lands in .gg-capture (may open inspect UI
  // that lists field tokens elsewhere); only axis titles are the flash risk.
  await expect(output.locator(".gg-axis-title", { hasText: "Flipper length mm" })).toBeVisible();
  await expect(output.locator(".gg-axis-title", { hasText: "Body mass g" })).toBeVisible();
  await expect(output.locator(".gg-axis-title", { hasText: "flipperLengthMm" })).toHaveCount(0);
});

test("homepage grammar inspect draws xy crosshair and supports legend focus", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/?theme=dark");
  const output = page.locator(".grammar-output");
  // Intent-gated: load button pulls the chart stack for keyboard users.
  await page.getByRole("button", { name: "Load interactive chart" }).click();
  await expect(output.locator(".gg-plot-root")).toHaveAttribute("data-gg-ready", "true", {
    timeout: 60_000,
  });
  await expect(output.locator(".gg-capture")).toBeVisible();

  const capture = output.locator(".gg-capture");
  await capture.focus();
  await capture.press("ArrowRight");
  const tooltip = output.locator(".gg-tooltip");
  await expect(tooltip).toBeVisible();
  // Species is carried on identity points; blank "-" means we hit the smooth
  // path under auto mode "x" instead of a point.
  await expect(tooltip.getByText("species")).toBeVisible();
  await expect(tooltip.getByText("-")).toHaveCount(0);
  // mode "xy": full numeric crosshair — each axis is gapped at the hover ring
  // (two segments per axis when the focus is interior).
  await expect(output.locator(".gg-crosshair")).toHaveCount(4);

  // legendFocus: discrete color entries are keyboard-reachable targets.
  const legendTarget = output.locator("[data-gg-legend-target]").first();
  await expect(legendTarget).toBeVisible();
  await legendTarget.focus();
  await expect(legendTarget).toBeFocused();
});

test("homepage mobile order puts benchmark tabs before examples", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/?theme=light");
  await expectHomeSectionOrder(page);
  await expect(page.locator(".home-featured ol li")).toHaveCount(6);
  await expectNoOverflow(page);
});

test("code tabs share the manual-copy fallback", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new DOMException("Denied", "NotAllowedError")),
      },
    });
  });
  await page.goto("/");
  const codePath = page.locator(".code-path");
  const tabs = codePath.getByRole("tablist", { name: "Code representations" }).getByRole("tab");
  await expect(tabs).toHaveText(["React", "Svelte", "Spec (JSON)"]);
  await codePath.getByRole("button", { name: "Copy code" }).click();
  await expect(page.locator(".code-path [role=status]")).toHaveText(
    "Clipboard unavailable. Code selected for manual copy.",
  );
});

test("home grammar chart keeps static dimensions through live upgrade", async ({ page }) => {
  // Wider than the 832px shell cap so an uncapped container-responsive live
  // plot would visibly stretch (the default 800px viewport cannot show it).
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const shell = page.locator(".grammar-output");
  await expect(shell).toBeVisible();
  const column = await page.locator(".code-path-chart").boundingBox();
  const before = await shell.boundingBox();
  expect(before).not.toBeNull();
  expect(column).not.toBeNull();
  expect(column!.width).toBeGreaterThan(832);
  // Cap is DOCS_STATIC_PLOT_WIDTH_PX (832); static svg renders at exactly that.
  expect(Math.round(before!.width)).toBe(832);
  // pointerenter intent upgrades the shell to the live plot.
  await shell.hover();
  await expect(shell.locator(".gg-plot-root")).toBeVisible({ timeout: 15_000 });
  const after = await shell.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.round(after!.width)).toBe(Math.round(before!.width));
  expect(Math.round(after!.height)).toBe(Math.round(before!.height));
  expect(after!.width).toBeLessThan(column!.width);
});

test("gallery exposes every generated preview exactly once", async ({ page }) => {
  await page.goto("/examples");
  // One meta.json per example under examples/ (grows when new specimens land).
  // Total previews − 3 interaction expositions; includes line/function (#797),
  // label/basic (#792), hex/basic (#800), bin2d/basic (#799),
  // polygon/regions (#807), boxplot/violin (#798), point/count (#795),
  // interval-family identity specimens (errorbar/caps, linerange/stems,
  // pointrange/midpoints, crossbar/boxes), sparse mark specimens
  // (jitter/spread, spoke/rays, rug/ticks, step/stairs, qq/cloud,
  // qq_line/match), line/labor-cost-of-wheat (Playfair ratio companion).
  // Drops to 91 when point/style-scales was retired (its Minard content is
  // subsumed by path/trajectory, #1460). Drops to 90 after deleting synthetic
  // point/canvas-scatter and color/continuous; +1 labor-cost → 91.
  const exampleCount = 91;
  await expect(page.locator(".example-grid li")).toHaveCount(exampleCount);
  await expect(page.locator('img[src*="/previews/"]')).toHaveCount(exampleCount);
});

test("gallery filtering is URL-addressable, preserves theme, and restores history", async ({
  page,
}) => {
  await page.goto("/examples?theme=dark");
  const search = page.getByRole("searchbox", { name: "Filter" });
  // Shared with scripts/gallery.test.ts — must hit haystack (id/title/tags/section).
  // Chart Labs copy and deleted meta descriptions are not indexed (#765/#773).
  await search.fill(GALLERY_FILTER_JOURNEY_QUERY);
  const q = GALLERY_FILTER_JOURNEY_QUERY;
  await expect(page).toHaveURL(new RegExp(`theme=dark.*q=${q}|q=${q}.*theme=dark`));
  await expect(page.locator(".example-grid li").first()).toBeVisible();
  const linkedCount = await page.locator(".example-grid li").count();
  expect(linkedCount).toBeGreaterThan(0);
  await page.getByLabel("Category").selectOption(GALLERY_FILTER_JOURNEY_CATEGORY);
  await expect(page).toHaveURL(new RegExp(`category=${GALLERY_FILTER_JOURNEY_CATEGORY}`));
  await page.goBack();
  await expect(page.getByLabel("Category")).toHaveValue("");
  await expect(page.locator(".example-grid li").first()).toBeVisible();
});

test("unknown gallery filter values reset without dropping unrelated params", async ({ page }) => {
  await page.goto("/examples?theme=dark&category=unknown&tag=nope");
  await expect(page.getByText("Unsupported filters were reset.")).toBeVisible();
  await expect(page).toHaveURL(/theme=dark/);
  await expect(page).not.toHaveURL(/category=unknown|tag=nope/);
});

test("detail is specimen-first and orders React, Svelte, builder, then JSON", async ({ page }) => {
  await page.goto("/examples/point/scatter-color");
  await expect(page.locator(".gg-example-frame")).toBeVisible();
  const tabs = page.getByRole("tablist", { name: "Code representations" }).getByRole("tab");
  await expect(tabs).toHaveText(["React", "Svelte", "Builder (TS)", "Spec (JSON)"]);
  await expect(page.getByRole("link", { name: "Open in Playground" })).toHaveCount(0);
  await expect(page.locator(".related li")).toHaveCount(3);
});

test("homepage switches four benchmark tabs and sends details to GitHub", async ({
  page,
  request,
}) => {
  for (const theme of ["light", "dark"]) {
    await page.goto(`/?theme=${theme}`);
    const section = page.locator(".home-hero");
    await expect(section.locator("select")).toHaveCount(0);
    const tabs = section.getByRole("tablist", { name: "Benchmark scenarios" }).getByRole("tab");
    await expect(tabs).toHaveText(["10k points", "1k points", "10k update", "30k line update"]);
    const paths = [
      "scatter-10k-mount",
      "scatter-1k-mount",
      "scatter-10k-update",
      "line-30k-update",
    ];
    for (let index = 0; index < paths.length; index += 1) {
      await tabs.nth(index).click();
      await expect(tabs.nth(index)).toHaveAttribute("aria-selected", "true");
      await expect(section.getByRole("tabpanel")).toHaveCount(1);
      const chart = section.locator("img:visible");
      await expect(chart).toHaveCount(1);
      await expect(chart).toHaveAttribute(
        "src",
        new RegExp(`bench-core-${paths[index]}${theme === "dark" ? "-dark-site" : ""}\\.svg\\?v=`),
      );
      await expect(chart).toHaveAttribute("alt", /ggts core SVG/);
      await expect(chart).not.toHaveAttribute("alt", /D3/);
      await expect
        .poll(() =>
          chart.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
        )
        .toBe(true);
    }
    await tabs.first().focus();
    await tabs.first().press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await tabs.nth(1).press("End");
    await expect(tabs.last()).toHaveAttribute("aria-selected", "true");
    await tabs.last().press("Home");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await expect(section.getByRole("link", { name: "Benchmarks on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/ggts-sh/ggts/tree/main/benchmarks/competitive",
    );
    await expectNoOverflow(page);
  }
  expect((await request.get("/benchmarks")).status()).toBe(404);
});

test("gallery React tab exposes the authored inspection example", async ({ page }) => {
  await page.goto("/examples/interaction/tooltip");
  const code = page.locator(".code-section");
  const react = code.getByRole("tab", { name: "React", exact: true });
  await expect(react).toHaveAttribute("aria-selected", "true");
  await expect(code.getByRole("tabpanel")).toContainText("function PenguinInspection");
  await expect(code.getByRole("tabpanel")).toContainText('contentMode="interactive"');
  await expect(code.getByRole("tabpanel")).toContainText("Remember this penguin");
  await code.getByRole("tab", { name: "Svelte", exact: true }).click();
  await expect(code.getByRole("tabpanel")).toContainText("<script lang=");
  await react.click();
  await expect(code.getByRole("tabpanel")).toContainText("function PenguinInspection");
});

for (const [path, width, height] of [
  ["/examples/point/scatter-color", 640, 400],
  ["/examples/interaction/linked-views", 640, 1140],
  ["/examples/interaction/legend-focus", 960, 320],
] as const) {
  test(`VR detail isolates ${path} at canonical geometry`, async ({ page }) => {
    await page.goto(`${path}?vr&theme=light`);
    // Under ?vr, page prose chrome is hidden; the frame stays measurable.
    await expect(page.locator(".example-prose:visible")).toHaveCount(0);
    const frame = page.locator(".gg-example-frame");
    await expect(frame).toBeVisible();
    await expect(frame).toHaveCSS("width", `${String(width)}px`);
    await expect(frame).toHaveCSS("height", `${String(height)}px`);
  });
}
