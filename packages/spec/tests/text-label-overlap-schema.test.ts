/**
 * Issue #1881: `checkOverlap` param contract for text/label layers.
 * Only text and label opt in; sf variants reject the parameter.
 */
import { describe, expect, it } from "bun:test";

import { validate } from "../src/validate.ts";

function paramsOf(geom: string, params: unknown) {
  const aes = geom.startsWith("sf_")
    ? { label: { field: "label" } }
    : { x: { field: "x" }, y: { field: "y" }, label: { field: "label" } };
  return validate({ aes, layers: [{ geom, params }] });
}

describe("checkOverlap — accepts", () => {
  it("boolean true/false on text and label layers", () => {
    for (const geom of ["text", "label"]) {
      for (const checkOverlap of [true, false]) {
        const result = paramsOf(geom, { checkOverlap });
        expect(result.ok, `${geom} checkOverlap=${checkOverlap}`).toBe(true);
      }
    }
  });

  it("omitted checkOverlap (defaults to false)", () => {
    for (const geom of ["text", "label"]) {
      expect(paramsOf(geom, {}).ok, geom).toBe(true);
    }
  });
});

describe("checkOverlap — rejects", () => {
  it("non-boolean values", () => {
    for (const geom of ["text", "label"]) {
      for (const value of ["true", 1, null, {}]) {
        expect(paramsOf(geom, { checkOverlap: value }).ok, `${geom} ${JSON.stringify(value)}`).toBe(
          false,
        );
      }
    }
  });

  it("on sf_text and sf_label (only text/label opt in)", () => {
    for (const geom of ["sf_text", "sf_label"]) {
      expect(paramsOf(geom, { checkOverlap: true }).ok, geom).toBe(false);
    }
  });
});
