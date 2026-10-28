/**
 * The alias table is the source of truth for which geom names normalize()
 * rewrites away (#1042). These tests drive normalize() rather than compare the
 * constant to a hand-written list, so the table cannot drift from the rewrite
 * it documents, and an alias whose target is itself an alias fails here.
 */
import { describe, expect, it } from "bun:test";

import { ALIAS_GEOMS, GEOM_ALIASES, KNOWN_GEOMS } from "../src/schema-catalog.ts";
import { normalize } from "../src/normalize.ts";
import { validate } from "../src/validate.ts";
import type { SpecInput } from "../src/normalize.ts";

/** Minimal x/y mapping so every alias normalizes without a required-channel gap. */
const xy = { x: "x", y: "y" } as const;

describe("geom aliases (#1042)", () => {
  it("rewrites every listed alias to its table target", () => {
    for (const alias of ALIAS_GEOMS) {
      const spec = normalize({ layers: [{ geom: alias, aes: xy }] });
      expect(spec.layers[0]?.geom).toBe(GEOM_ALIASES[alias]);
    }
  });

  it("never rewrites an alias to another alias", () => {
    for (const alias of ALIAS_GEOMS) {
      expect(ALIAS_GEOMS).not.toContain(GEOM_ALIASES[alias]);
    }
  });

  it("leaves every non-alias geom name alone", () => {
    const canonical = KNOWN_GEOMS.filter((geom) => !ALIAS_GEOMS.includes(geom));
    for (const geom of canonical) {
      const spec = normalize({ layers: [{ geom, aes: xy }] } as SpecInput);
      expect(spec.layers[0]?.geom).toBe(geom);
    }
  });

  it("lists aliases that are real geom names", () => {
    for (const alias of ALIAS_GEOMS) expect(KNOWN_GEOMS).toContain(alias);
  });

  /**
   * normalize() never throws on an unknown geom — it passes the name through so
   * validate() can reject it with a did-you-mean error. A name that collides
   * with an inherited Object property must take that same path: a prototype
   * lookup would hand back a function where the geom string belongs.
   */
  it("passes an unknown geom through, even one named after an Object property", () => {
    for (const geom of ["constructor", "toString", "valueOf", "hasOwnProperty", "poimt"]) {
      const spec = normalize({ layers: [{ geom, aes: xy }] } as SpecInput);
      expect(spec.layers[0]?.geom).toBe(geom);
    }
  });

  /**
   * Same prototype-chain trap on the defaults lookup one line down. Without an
   * own-key check, GEOM_DEFAULTS["constructor"] is a function, so the `??`
   * fallback never fires and the layer loses stat and position — which sends
   * validate() down a shape error instead of the did-you-mean it promises.
   */
  it("fills identity defaults for an unknown geom named after an Object property", () => {
    for (const geom of ["constructor", "toString", "poimt"]) {
      const spec = normalize({ layers: [{ geom, aes: xy }] } as SpecInput);
      expect(spec.layers[0]?.stat).toBe("identity");
      expect(spec.layers[0]?.position).toBe("identity");
    }
  });

  it("keeps a constant rule linetype through the hline and vline rewrites (#1825)", () => {
    const spec = normalize({
      layers: [
        { geom: "hline", params: { yintercept: 7.3, linetype: "dashed" } },
        { geom: "vline", params: { xintercept: 2, linetype: "dotted" } },
        { geom: "rule", params: { yintercept: 1, linetype: "longdash" } },
      ],
    });
    expect(spec.layers.map((layer) => [layer.geom, layer.params])).toEqual([
      ["rule", { yintercept: 7.3, linetype: "dashed" }],
      ["rule", { xintercept: 2, linetype: "dotted" }],
      ["rule", { yintercept: 1, linetype: "longdash" }],
    ]);
    expect(validate(spec).ok).toBe(true);
    const bad = validate(
      normalize({
        layers: [{ geom: "hline", params: { yintercept: 1, linetype: "wavy" } }],
      } as SpecInput),
    );
    expect(bad.ok).toBe(false);
  });

  it("rejects an unknown geom with the did-you-mean error, whatever it is named", () => {
    for (const geom of ["constructor", "toString", "poimt"]) {
      const result = validate(normalize({ layers: [{ geom, aes: xy }] } as SpecInput));
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.errors.map((error) => error.code)).toContain("unknown-geom");
    }
  });
});
