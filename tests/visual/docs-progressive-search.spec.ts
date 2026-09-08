import { expect, test } from "@playwright/test";

async function expectNoDocumentOverflow(page: import("@playwright/test").Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}

test("Getting started is a markdown guide with install and a complete file", async ({ page }) => {
  await page.goto("/guide/getting-started?theme=light");

  const guide = page.locator("article.guide.prose");
  await expect(guide.getByRole("heading", { level: 1 })).toHaveText("Getting started");
  await expect(guide.getByRole("heading", { level: 2, name: "Choose your surface" })).toBeVisible();
  await expect(
    guide.getByRole("heading", { level: 2, name: "A complete Svelte file" }),
  ).toBeVisible();
  await expect(guide.locator("pre code").first()).toContainText("npm install @ggts-sh/react");
  await expect(guide.locator("pre code").filter({ hasText: "kyotoSakura" }).first()).toContainText(
    'import { kyotoSakura } from "@ggts-sh/core/data"',
  );
  await expectNoDocumentOverflow(page);
});

test("Docs landing and sidebar expose the full path without duplicate Reference", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/docs?theme=light");

  // Flat chapter index — only Reference keeps a section heading.
  const index = page.getByRole("navigation", { name: "Documentation guides" });
  await expect(index.getByRole("heading", { level: 2 })).toHaveText(["Reference"]);
  await expect(index.getByRole("heading", { name: "Start" })).toHaveCount(0);
  await expect(index.getByRole("heading", { name: "Core grammar" })).toHaveCount(0);
  await expect(index.getByRole("heading", { name: "Interaction" })).toHaveCount(0);
  await expect(index.getByRole("heading", { name: "Production" })).toHaveCount(0);
  await expect(index.getByRole("heading", { name: "Release" })).toHaveCount(0);
  await expect(index.getByRole("link", { name: /Getting started/ })).toBeVisible();
  await expect(index.getByRole("link", { name: /Data and mappings/ })).toHaveCount(0);
  await expect(index.getByRole("link", { name: /Dates without preprocessing/ })).toBeVisible();
  // Accessible name includes the description span after the title.
  await expect(index.getByRole("link", { name: /^Interactions\b/ })).toBeVisible();
  await expect(index.getByRole("link", { name: /^Production\b/ })).toBeVisible();
  await expect(index.getByRole("link", { name: /Errors reference/ })).toBeVisible();
  await expect(index.getByRole("link", { name: /Upgrade guide/ })).toBeVisible();
  await expect(index.getByRole("link", { name: /Migrating pre-0.1/ })).toHaveCount(0);

  const sidebar = page.getByRole("navigation", { name: "Guide chapters" });
  await expect(sidebar.getByRole("heading", { level: 2 })).toHaveText(["Reference"]);
  await expect(sidebar.getByRole("heading", { name: "Start" })).toHaveCount(0);
  await expect(sidebar.getByRole("heading", { name: "Core grammar" })).toHaveCount(0);
  // Overview + consolidated guide/reference chapters (Scales + Coords + Labs/Axes/Labels + Themes/Palettes).
  await expect(sidebar.getByRole("link")).toHaveCount(27);
  await expect(sidebar.getByRole("link", { name: "Dates without preprocessing" })).toBeVisible();
  await expectNoDocumentOverflow(page);

  await page.goto("/guide/errors?theme=light");
  await expect(
    page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Reference" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Docs" }),
  ).not.toHaveAttribute("aria-current", "page");

  await page.goto("/guide/interaction-reference?theme=light");
  await expect(
    page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Reference" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Reference");
});

test("prerendered Docs and getting-started remain useful without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/docs?theme=light");
  await expect(page.getByRole("navigation", { name: "Documentation guides" })).toContainText(
    "Getting started",
  );
  await page.goto("/guide/getting-started?theme=light");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Getting started");
  await expect(page.locator("pre code").first()).toContainText("npm install @ggts-sh/react");
  await expect(page.locator("pre code").filter({ hasText: "kyotoSakura" }).first()).toContainText(
    'import { kyotoSakura } from "@ggts-sh/core/data"',
  );
  await context.close();
});

test("CLI reference renders every implementation-owned option anchor", async ({ page }) => {
  await page.goto("/reference/cli?theme=light");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Command-line reference");
  for (const anchor of ["width", "height", "data", "max-marks", "version", "help"]) {
    await expect(page.locator(`#${anchor}`)).toBeVisible();
  }
  await expect(page.locator("#max-marks")).toContainText("--max-marks");
  await expectNoDocumentOverflow(page);
});

for (const chapter of [
  {
    group: "core grammar",
    path: "/guide/scales-guides",
    heading: "Scales and guides",
    evidence: "/examples/line/time-axis",
  },
  {
    group: "interaction",
    path: "/guide/interactions",
    heading: "Interactions",
    evidence: "/examples/interaction/linked-views",
  },
  {
    group: "production",
    path: "/guide/production",
    heading: "Production",
    evidence: "/reference/cli",
  },
  {
    group: "release",
    path: "/guide/upgrading",
    heading: "Upgrade guide",
    evidence: "/guide/lifecycle#lifecycle-tags",
  },
] as const) {
  test(`${chapter.group} chapter keeps evidence and sequence navigation`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${chapter.path}?theme=light`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(chapter.heading);
    await expect(page.getByRole("navigation", { name: "On this page" }).first()).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Previous and next chapters" }),
    ).toBeVisible();
    await expect(page.locator(`a[href$="${chapter.evidence}"]`).first()).toBeVisible();
    await expect(page.locator(".guide-code-classification")).toHaveCount(0);
    await expectNoDocumentOverflow(page);
  });
}

test("global search implements the combobox/listbox keyboard contract", async ({ page }) => {
  await page.goto("/docs?theme=light");
  const trigger = page.getByRole("button", { name: "Search documentation" }).first();
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Search documentation" });
  const input = dialog.getByRole("combobox", { name: "Search docs" });
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("aria-haspopup", "listbox");
  await expect(input).toHaveAttribute("aria-controls", "docs-search-results");
  await expect(dialog.locator("#docs-search-results")).toHaveAttribute("role", "listbox");
  await expect(dialog.getByRole("link", { name: "Getting started" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Getting started" })).not.toHaveAttribute(
    "role",
    "option",
  );

  await input.fill("scale-scheme-type");
  const options = dialog.getByRole("option");
  await expect(options.first()).toHaveAttribute("href", /\/guide\/errors#scale-scheme-type$/);
  await expect(input).toHaveAttribute("aria-expanded", "true");
  const firstId = await options.first().getAttribute("id");
  await expect(input).toHaveAttribute("aria-activedescendant", firstId!);
  await input.press("End");
  await expect(options.last()).toHaveAttribute("aria-selected", "true");
  await input.press("Home");
  await expect(options.first()).toHaveAttribute("aria-selected", "true");
  await expect(dialog.getByRole("status")).toContainText("result");

  await input.fill("no-such-ggsvelte-contract");
  await expect(input).toHaveAttribute("aria-expanded", "false");
  await expect(dialog.getByText("No matching documentation.", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Diagnostics" })).toBeVisible();
  await input.evaluate((element) => {
    (element as HTMLInputElement).setSelectionRange(4, 4);
  });
  await input.press("Home");
  await expect
    .poll(() => input.evaluate((element) => (element as HTMLInputElement).selectionStart))
    .toBe(0);
  await input.press("End");
  await expect
    .poll(() => input.evaluate((element) => (element as HTMLInputElement).selectionStart))
    .toBe("no-such-ggsvelte-contract".length);
  await input.press("Escape");
  await expect(trigger).toBeFocused();
});

test("search Enter follows the active focused result", async ({ page }) => {
  await page.goto("/docs?theme=light");
  await page.getByRole("button", { name: "Search documentation" }).first().click();
  const input = page.getByRole("combobox", { name: "Search docs" });
  await input.fill("tooltip");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/guide\/interactions#inspection$/);
});

test("global search preserves forced colors, reduced motion, and a clean console", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.goto("/docs?theme=light");
  await page.getByRole("button", { name: "Search documentation" }).first().click();
  const input = page.getByRole("combobox", { name: "Search docs" });
  await input.fill("GGPlot");
  await expect(page.getByRole("option").first()).toBeVisible();
  await expect(input).toBeFocused();
  expect(errors).toEqual([]);
});

test("global search is reachable from compact chrome and survives 200 percent zoom", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 800 });
  await page.goto("/docs?theme=light");
  const trigger = page.getByRole("button", { name: "Search documentation" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await page.getByRole("combobox", { name: "Search docs" }).fill("GGPlot");
  await expect(page.getByRole("option").first()).toContainText("GGPlot");
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await expectNoDocumentOverflow(page);
});

test("mobile getting-started guide remains contained", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/guide/getting-started?theme=light");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Getting started");
  await expect(page.locator("pre code").first()).toBeVisible();
  await expectNoDocumentOverflow(page);
});

test("click-opened search uses modal motion when reduced motion is off", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/docs?theme=light");
  await page.getByRole("button", { name: "Search documentation" }).first().click();
  const dialog = page.locator("dialog.site-search");
  await expect(dialog).toBeVisible();
  const wide = await dialog.evaluate((el) => {
    const style = getComputedStyle(el);
    return { property: style.transitionProperty, transform: style.transform };
  });
  expect(wide.property).toMatch(/opacity/);
  expect(wide.property).toMatch(/transform/);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Search documentation" }).first().click();
  await expect(dialog).toBeVisible();
  const narrow = await dialog.evaluate((el) => getComputedStyle(el).transitionProperty);
  expect(narrow).toMatch(/opacity/);
  expect(narrow.split(",").some((part) => part.trim() === "transform")).toBe(false);
});
