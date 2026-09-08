import { describe, expect, test } from "bun:test";

import {
  CONTENT_HASH_SCHEMA,
  contentHashCacheKey,
  parseSuccessMarker,
  serializeSuccessMarker,
  successMarkerPath,
  validateSuccessMarker,
} from "../ci-routing";

describe("contentHashCacheKey", () => {
  test("includes execution, schema, os, and hash; consumer adds matrix dims", () => {
    const key = contentHashCacheKey({
      execution: "unit",
      hash: "abc123",
      os: "Linux",
    });
    expect(key).toBe(`ggsvelte-ch-v${CONTENT_HASH_SCHEMA}-unit-Linux-abc123`);

    const consumerKey = contentHashCacheKey({
      execution: "consumer",
      hash: "deadbeef",
      os: "Windows",
      matrix: {
        node: "22",
        packageManager: "npm",
        packageManagerVersion: "10",
        svelte: "5.0.0",
        react: "18.2.0",
      },
    });
    expect(consumerKey).toContain("consumer");
    expect(consumerKey).toContain("Windows");
    expect(consumerKey).toContain("node22");
    expect(consumerKey).toContain("npm");
    expect(consumerKey).toContain("svelte5.0.0");
    expect(consumerKey).toContain("react18.2.0");
    expect(consumerKey).toContain("deadbeef");
  });

  test("consumer key includes resolved runtime node and package-manager versions", () => {
    const base = {
      execution: "consumer" as const,
      hash: "deadbeef",
      os: "Linux",
      matrix: {
        node: "22",
        packageManager: "npm",
        packageManagerVersion: "bundled with Node",
        svelte: "5.56.5",
        react: "19.2.0",
      },
    };
    const a = contentHashCacheKey({
      ...base,
      runtime: { nodeVersion: "v22.14.0", packageManagerVersion: "10.9.2" },
    });
    const b = contentHashCacheKey({
      ...base,
      runtime: { nodeVersion: "v22.15.0", packageManagerVersion: "10.9.2" },
    });
    const c = contentHashCacheKey({
      ...base,
      runtime: { nodeVersion: "v22.14.0", packageManagerVersion: "10.9.3" },
    });
    expect(a).toContain("runtime-nodev22.14.0");
    expect(a).toContain("runtime-pm10.9.2");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("sharded executions cache independently", () => {
  // Component suites fan out over matrix shards (vitest --shard / playwright
  // --shard). Each leg runs on its own runner but hashes the same content, so
  // shard identity MUST reach the cache key and the success marker. Without it
  // a passing shard 1 would write the marker that a failing shard 2 later
  // restores as a hit — a false green on the next run with identical content.
  test("shard index and total change the cache key", () => {
    const base = { execution: "component_svelte_fx" as const, hash: "abc123", os: "Linux" };
    const unsharded = contentHashCacheKey(base);
    const one = contentHashCacheKey({ ...base, shard: { index: 1, total: 3 } });
    const two = contentHashCacheKey({ ...base, shard: { index: 2, total: 3 } });
    const twoOfFour = contentHashCacheKey({ ...base, shard: { index: 2, total: 4 } });

    expect(one).toContain("shard1of3");
    expect(one).not.toBe(two);
    expect(one).not.toBe(unsharded);
    // Re-shaping the fan-out must not let an old leg's marker validate.
    expect(two).not.toBe(twoOfFour);
    // The unsharded key stays byte-identical so unsharded executions keep
    // their existing caches when this dimension is added.
    expect(unsharded).toBe(`ggsvelte-ch-v${CONTENT_HASH_SCHEMA}-component_svelte_fx-Linux-abc123`);
  });

  test("shard gets its own success-marker path", () => {
    expect(successMarkerPath("component_svelte_fx")).toBe(
      ".ci-content-hash/component_svelte_fx.ok",
    );
    expect(successMarkerPath("component_svelte_fx", { index: 2, total: 3 })).toBe(
      ".ci-content-hash/component_svelte_fx-2of3.ok",
    );
  });

  test("a marker from another shard does not validate", () => {
    const marker = parseSuccessMarker(
      serializeSuccessMarker({
        schema: CONTENT_HASH_SCHEMA,
        execution: "component_svelte_fx",
        hash: "abc",
        shard: { index: 1, total: 3 },
      }),
    );
    expect(marker).toEqual({
      schema: CONTENT_HASH_SCHEMA,
      execution: "component_svelte_fx",
      hash: "abc",
      shard: { index: 1, total: 3 },
    });

    const expected = { execution: "component_svelte_fx" as const, hash: "abc" };
    expect(validateSuccessMarker(marker, { ...expected, shard: { index: 1, total: 3 } })).toBe(
      true,
    );
    // The false-green this guards: shard 1's marker satisfying shard 2.
    expect(validateSuccessMarker(marker, { ...expected, shard: { index: 2, total: 3 } })).toBe(
      false,
    );
    expect(validateSuccessMarker(marker, { ...expected, shard: { index: 1, total: 4 } })).toBe(
      false,
    );
    // An unsharded expectation must not accept a sharded marker, or vice versa.
    expect(validateSuccessMarker(marker, expected)).toBe(false);
    const unsharded = parseSuccessMarker(
      serializeSuccessMarker({
        schema: CONTENT_HASH_SCHEMA,
        execution: "component_svelte_fx",
        hash: "abc",
      }),
    );
    expect(validateSuccessMarker(unsharded, { ...expected, shard: { index: 1, total: 3 } })).toBe(
      false,
    );
    expect(validateSuccessMarker(unsharded, expected)).toBe(true);
  });
});
