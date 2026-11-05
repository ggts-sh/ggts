import "../setup-register-all.js";
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

import IdentitySwapPlot from "../fixtures/IdentitySwapPlot.svelte";
import { render } from "../helpers/render.js";
import { until } from "../helpers/until.js";

type Inspection = { focus?: { sourceKeys: readonly PropertyKey[] } };

describe("source keys when row identity changes", () => {
  it.each(["key", "inspect", "child"] as const)(
    "drops the old keys when %s changes and the model stays the same",
    async (route) => {
      const models: unknown[] = [];
      const events: Inspection[] = [];
      const { container } = render(IdentitySwapPlot, {
        route,
        onrender: (model: unknown) => {
          models.push(model);
        },
        oninspect: (event: unknown) => {
          const inspection = event as Inspection;
          if (inspection.focus !== undefined) events.push(inspection);
        },
      });
      const capture = container.querySelector(".gg-capture")!;
      const hoverAt = (fraction: number) => {
        const box = capture.getBoundingClientRect();
        capture.dispatchEvent(
          new PointerEvent("pointermove", {
            clientX: box.left + box.width * fraction,
            clientY: box.top + box.height / 2,
            bubbles: true,
          }),
        );
      };

      await until(() => models.length > 0);
      hoverAt(0.3);
      await until(() => events.length > 0);
      expect(events.at(-1)?.focus?.sourceKeys).toContain("r0");
      const model = models.at(-1);
      const hovers = events.length;

      container.querySelector<HTMLButtonElement>("[data-swap]")!.click();
      flushSync();
      hoverAt(0.6);
      await until(() => events.length > hovers);
      expect(models.at(-1)).toBe(model);
      expect(events.at(-1)?.focus?.sourceKeys).not.toContain("r0");
    },
  );
});
