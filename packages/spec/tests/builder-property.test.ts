/**
 * Property test (plan M0c): EVERY builder output validates against the
 * emitted JSON Schema artifact (ajv) and the TypeBox runtime. Random builder
 * chains from a seeded PRNG — deterministic, reproducible failures.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import Schema from "typebox/schema";
import { Ajv2020 } from "ajv/dist/2020.js";

import { gg } from "../src/builder.ts";
import type { AesInput } from "../src/normalize.ts";
import { PlotSpecSchema } from "../src/schema.ts";

// Mulberry32 — tiny seeded PRNG (deterministic across runs/platforms).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIELDS = ["x", "y", "value", "cls", "grp"] as const;
const CHANNEL_POOL = [
  "x",
  "y",
  "color",
  "fill",
  "size",
  "linewidth",
  "alpha",
  "group",
  "label",
] as const;

function randomAes(rnd: () => number): AesInput {
  const out: Record<string, unknown> = {};
  for (const channel of CHANNEL_POOL) {
    const roll = rnd();
    if (roll < 0.45) continue; // absent
    if (roll < 0.7) out[channel] = FIELDS[Math.floor(rnd() * FIELDS.length)]; // bare string
    else if (roll < 0.8) out[channel] = { field: FIELDS[Math.floor(rnd() * FIELDS.length)]! };
    else if (roll < 0.9) {
      out[channel] =
        rnd() < 0.5
          ? { value: Math.round(rnd() * 100) / 10 }
          : { value: "steelblue", scale: rnd() < 0.5 };
    } else out[channel] = null;
  }
  return out;
}

function randomBuilder(rnd: () => number) {
  const dataRoll = rnd();
  const data =
    dataRoll < 0.4
      ? [
          { x: 1, y: 2, cls: "a" },
          { x: 2, y: 3, cls: "b" },
        ]
      : dataRoll < 0.8
        ? { x: [1, 2, 3], y: [4, null, 6], cls: ["a", "b", "a"] }
        : { name: "cars" };
  let builder = rnd() < 0.9 ? gg(data, randomAes(rnd)) : gg(data);
  const layerCount = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < layerCount; i++) {
    if (rnd() < 0.5) {
      builder = builder.geomPoint({
        ...(rnd() < 0.5 && { alpha: Math.round(rnd() * 10) / 10 }),
        ...(rnd() < 0.5 && { size: 1 + Math.round(rnd() * 40) / 10 }),
        ...(rnd() < 0.3 && {
          shape: (["circle", "square", "triangle"] as const)[Math.floor(rnd() * 3)]!,
        }),
        ...(rnd() < 0.5 && { aes: randomAes(rnd) }),
      });
    } else {
      builder = builder.geomLine({
        ...(rnd() < 0.5 && { alpha: Math.round(rnd() * 10) / 10 }),
        ...(rnd() < 0.5 && { linewidth: 0.5 + Math.round(rnd() * 30) / 10 }),
        ...(rnd() < 0.3 && { curve: rnd() < 0.5 ? ("linear" as const) : ("step" as const) }),
        ...(rnd() < 0.5 && { aes: randomAes(rnd) }),
      });
    }
  }
  if (rnd() < 0.4) builder = builder.labs({ title: "T", ...(rnd() < 0.5 && { x: "X" }) });
  return builder;
}

describe("builder property test", () => {
  // TypeBox 1.x: building Cyclic `$defs` graphs + Schema.Compile is front-loaded;
  // allow headroom over bun's 5s default when this file loads cold.
  it(
    "every builder output validates against the emitted JSON Schema (ajv + TypeBox), 250 seeded cases",
    () => {
      const artifact = JSON.parse(
        readFileSync(join(import.meta.dir, "..", "schema", "v0.json"), "utf8"),
      ) as object;
      const ajv = new Ajv2020({ strict: false });
      const validateAjv = ajv.compile(artifact);
      // Dynamic Value.Check on large Cyclic schemas is ~15ms/check; Compile is ~0.1ms.
      const validateTb = Schema.Compile(PlotSpecSchema);
      const rnd = mulberry32(0xc0ffee);
      for (let i = 0; i < 250; i++) {
        const spec = randomBuilder(rnd).spec();
        const ajvOk = validateAjv(spec);
        if (!ajvOk) {
          throw new Error(
            `case ${i}: ajv rejected builder output:\n${JSON.stringify(spec, null, 2)}\n` +
              JSON.stringify(validateAjv.errors, null, 2),
          );
        }
        expect(validateTb.Check(spec)).toBe(true);
      }
    },
    { timeout: 60_000 },
  );
});
