/**
 * Browser harness API for Playwright:
 *   window.competitiveBench.mount(lib, caseId) -> { ms, syncMs, markHint }
 *   window.competitiveBench.replace(lib, caseId) -> { ms }  // full remount with fresh data seed
 *   window.competitiveBench.update(lib, caseId) -> { ms, syncMs } // IN-PLACE update
 *   window.competitiveBench.verifyUpdate(lib, caseId)             // mutation + fresh parity
 *   window.competitiveBench.endUpdate()                    // teardown the live update cell
 *   window.competitiveBench.list() -> { libs, cases }
 *   window.competitiveBench.clear()
 *
 * `ms` is paint-inclusive: after the sync mount we wait for two animation
 * frames so layout/paint can flush (closer to LightningChart-style "visible on
 * screen" than pure JS-only timers). `syncMs` stops when the adapter returns,
 * separating synchronous pipeline/draw work from compositor and host noise.
 *
 * Update axis: the first update(lib, caseId) call for a cell mounts UNTIMED
 * and keeps the handle alive page-side; later calls time handle.update(data)
 * with the same double-rAF pattern. Data alternates between two determinis-
 * tic perturbations of the mount dataset so no lib can no-op on identical
 * input. Switching cells or calling mount()/replace() destroys the live
 * update handle first.
 */
import { assertMountable, ggplotLoaded, mountSync, reactLoaded } from "./adapter-dispatch";
import {
  afterPaint,
  caseById,
  clearMount,
  destroyLive,
  endUpdate,
  ensureUpdateSlot,
  trackLiveHandle,
  type UpdateSlot,
} from "./lifecycle";
import { verifyUpdate } from "./verify-update";
import { CASES, dataForCase, LIBS, perturbForUpdate, type LibId } from "../scenarios";

async function mountLib(
  lib: string,
  caseId: string,
): Promise<{ ms: number; syncMs: number; markHint: number }> {
  const c = caseById(caseId);
  assertMountable(lib, c);
  const mountEl = document.querySelector("#mount") as HTMLElement;
  const status = document.querySelector("#status") as HTMLElement;
  endUpdate();
  destroyLive();
  mountEl.replaceChildren();

  const data = dataForCase(c);
  const t0 = performance.now();
  const result = mountSync(lib as LibId, c.scenario, data, mountEl);
  const syncMs = performance.now() - t0;
  trackLiveHandle(result.handle);
  await afterPaint();
  const ms = performance.now() - t0;
  status.textContent = `${lib} ${caseId} mount=${ms.toFixed(2)}ms marks≈${result.markHint}`;
  return { ms, syncMs, markHint: result.markHint };
}

/** Full remount with the same case (data re-generated). Not an in-place setData. */
async function replaceLib(lib: string, caseId: string): Promise<{ ms: number }> {
  const result = await mountLib(lib, caseId);
  return { ms: result.ms };
}

/**
 * IN-PLACE update (second scoreboard axis). First call for a (lib, caseId)
 * cell mounts once UNTIMED and keeps the handle alive page-side; subsequent
 * calls time handle.update(variantData) paint-inclusive with the same
 * double-rAF pattern as mount. Data alternates between two deterministic
 * perturbations so no lib can no-op on identical input.
 */
async function updateLib(lib: string, caseId: string): Promise<{ ms: number; syncMs: number }> {
  const key = `${lib}::${caseId}`;
  const slot = ensureUpdateSlot(key, () => {
    const c = caseById(caseId);
    assertMountable(lib, c);
    const mountEl = document.querySelector("#mount") as HTMLElement;
    mountEl.replaceChildren();
    const data = dataForCase(c);
    // UNTIMED mount — establishes the live handle this cell updates in place.
    const result = mountSync(lib as LibId, c.scenario, data, mountEl);
    const handle = result.handle;
    if (handle === undefined || typeof handle.update !== "function") {
      throw new Error(`${lib} has no in-place update path (update scoreboard)`);
    }
    return { key, caseData: data, calls: 0, handle: handle as UpdateSlot["handle"] };
  });
  slot.calls += 1;
  const variant = (slot.calls % 2 === 1 ? 1 : 2) as 1 | 2;
  const next = perturbForUpdate(slot.caseData, variant);
  const status = document.querySelector("#status") as HTMLElement;
  const t0 = performance.now();
  slot.handle.update(next);
  const syncMs = performance.now() - t0;
  await afterPaint();
  const ms = performance.now() - t0;
  status.textContent = `${lib} ${caseId} update=${ms.toFixed(2)}ms variant=${variant}`;
  return { ms, syncMs };
}

function listCatalog(): {
  libs: { id: string; browser: boolean; scenarios: string[] }[];
  cases: { id: string; scenario: string; n: number; defaultBrowser: boolean }[];
} {
  return {
    libs: LIBS.map((l) => ({
      id: l.id,
      browser:
        l.browser ||
        (l.id === "ggsvelte-ggplot" && ggplotLoaded()) ||
        (l.id === "ggsvelte-react" && reactLoaded()),
      scenarios: [...l.scenarios],
    })),
    cases: CASES.map((c) => ({
      id: c.id,
      scenario: c.scenario,
      n: c.n,
      defaultBrowser: c.defaultBrowser,
    })),
  };
}

declare global {
  interface Window {
    competitiveBench: {
      mount: typeof mountLib;
      replace: typeof replaceLib;
      /** In-place update scoreboard (previously a deprecated replace alias). */
      update: typeof updateLib;
      endUpdate: typeof endUpdate;
      clear: typeof clearMount;
      list: typeof listCatalog;
      /** Live-SVG patcher parity gate (#1471). */
      /** Every timed update mutates output and reaches fresh-final parity. */
      verifyUpdate: typeof verifyUpdate;
    };
  }
}

window.competitiveBench = {
  mount: mountLib,
  replace: replaceLib,
  update: updateLib,
  endUpdate,
  clear: clearMount,
  list: listCatalog,
  verifyUpdate,
};
