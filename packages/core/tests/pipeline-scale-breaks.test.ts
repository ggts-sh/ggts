/**
 * PR 3 — explicit continuous breaks outside the trained domain are filtered
 * AND surfaced (red-first).
 *
 * The plan (error/diagnostic contract) requires `scale-break-outside-domain` as
 * a warning, "explicit breaks are filtered, matching temporal-break-outside-
 * domain ownership." Layout already drops out-of-domain continuous breaks
 * (layout.ts) — but silently. This suite pins the warning so a dropped break is
 * observable, consistent with the rendered tick set.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg, scaleXContinuous } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";

const size = { width: 640, height: 400 };
const rows = [
  { x: 1, y: 1 },
  { x: 5, y: 2 },
  { x: 9, y: 3 },
];

describe("scale-break-outside-domain", () => {
  it("warns when an explicit break falls outside the trained display domain", () => {
    // Break at 1000 is far outside the ~[1,9] (5%-expanded) domain.
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .scales(scaleXContinuous({ breaks: [1, 5, 1000] }))
        .spec(),
      size,
    );
    const warning = model.warnings.find((w) => w.code === "scale-break-outside-domain");
    expect(warning).toBeDefined();
    expect(warning!.message).toContain("1000");
  });

  it("is silent when every explicit break is inside the domain", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .scales(scaleXContinuous({ breaks: [1, 5, 9] }))
        .spec(),
      size,
    );
    expect(model.warnings.find((w) => w.code === "scale-break-outside-domain")).toBeUndefined();
  });
});
