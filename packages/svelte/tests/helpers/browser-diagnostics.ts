/**
 * Opt-in diagnostics for the intermittent CI failure "[vitest] Browser
 * connection was closed while running tests" (issue #1924).
 *
 * `diagnosticPlaywright()` returns the normal vitest Playwright provider, with
 * one change: after vitest opens the page of a worker, this module listens for
 * events that say whether Chromium crashed, closed the page, or only cut the
 * WebSocket connections, and prints each one as a `[browser-diag]` line. It
 * changes no test and no timeout. Enable it with GGTS_BROWSER_DIAGNOSTICS=1.
 */
import { readFileSync, readdirSync } from "node:fs";

import { playwright, type PlaywrightBrowserProvider } from "@vitest/browser-playwright";
import type { Page } from "playwright";

function log(sessionId: string, ...message: unknown[]): void {
  console.error(
    `[browser-diag] ${new Date().toISOString()} session=${sessionId.slice(0, 8)}`,
    ...message,
  );
}

/** Load, free memory, and resident memory of the Chromium processes (Linux). */
function readHostSnapshot(): string {
  const load = readFileSync("/proc/loadavg", "utf8").split(" ").slice(0, 3).join(" ");
  const meminfo = readFileSync("/proc/meminfo", "utf8");
  const availableKb = Number(/MemAvailable:\s+(\d+)/.exec(meminfo)?.[1]);
  let chromiumProcesses = 0;
  let chromiumKb = 0;
  for (const entry of readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const status = readFileSync(`/proc/${entry}/status`, "utf8");
      if (!/^Name:\s+chrom/m.test(status)) continue;
      chromiumProcesses += 1;
      chromiumKb += Number(/VmRSS:\s+(\d+)/.exec(status)?.[1] ?? 0);
    } catch {
      // The process ended between readdir and read; skip it.
    }
  }
  return `load=${load} availableMB=${Math.round(availableKb / 1024)} chromiumProcesses=${chromiumProcesses} chromiumRssMB=${Math.round(chromiumKb / 1024)}`;
}

/** A diagnostic must never fail a test run, so a read error becomes part of the log line. */
function hostSnapshot(): string {
  try {
    return readHostSnapshot();
  } catch (error) {
    return `snapshot unavailable: ${String(error)}`;
  }
}

async function watchPage(page: Page, sessionId: string): Promise<void> {
  page.on("crash", () => {
    log(sessionId, "page crash", hostSnapshot());
  });
  page.on("close", () => {
    log(sessionId, "page close");
  });
  page.on("pageerror", (error) => {
    log(sessionId, "page error", error.message);
  });
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) log(sessionId, "main frame navigated", frame.url());
  });
  const cdp = await page.context().newCDPSession(page);
  cdp.on("Inspector.targetCrashed", () => {
    log(sessionId, "renderer crashed", hostSnapshot());
  });
  cdp.on("Inspector.detached", ({ reason }) => {
    log(sessionId, "inspector detached", reason);
  });
  let reported = false;
  cdp.on("Log.entryAdded", ({ entry }) => {
    // The first failed WebSocket of a page marks the moment the connection is lost.
    if (reported || entry.source !== "network" || !entry.text.includes("WebSocket connection"))
      return;
    reported = true;
    log(sessionId, "WebSocket connection lost", hostSnapshot(), entry.text.slice(0, 160));
  });
  await cdp.send("Inspector.enable");
  await cdp.send("Log.enable");
}

export function diagnosticPlaywright(): ReturnType<typeof playwright> {
  const provider = playwright();
  return {
    ...provider,
    providerFactory(project) {
      const instance = provider.providerFactory(project) as PlaywrightBrowserProvider;
      const openPage = instance.openPage.bind(instance);
      instance.openPage = async (sessionId, url, options) => {
        await openPage(sessionId, url, options);
        // Only Chromium has the CDP events used above.
        if (instance.browserName !== "chromium") return;
        try {
          await watchPage(instance.getPage(sessionId), sessionId);
        } catch (error) {
          log(sessionId, "diagnostics could not start", String(error));
        }
      };
      return instance;
    },
  };
}
