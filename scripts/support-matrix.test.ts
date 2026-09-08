import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  loadSupportMatrix,
  requiredConsumerRows,
  nightlyConsumerRows,
  prDefaultConsumerRows,
  validateSupportMatrix,
} from "./support-matrix.js";

const root = join(import.meta.dir, "..");

/** Parse `v1.61.1-noble` → parts. Throws on unexpected shape. */
export function parsePlaywrightContainerTag(tag: string): {
  major: number;
  minor: number;
  patch: number;
  distro: string;
} {
  const m = /^v(\d+)\.(\d+)\.(\d+)-([a-z0-9]+)$/.exec(tag.trim());
  if (!m) throw new Error(`unexpected Playwright container tag: ${tag}`);
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    distro: m[4]!,
  };
}

/**
 * Compare two tags of form `vX.Y.Z-distro` (−1 / 0 / 1). Same distro required.
 * Used so the publisher tag may lead consumers during prepublish (#610).
 */
export function comparePlaywrightContainerTags(a: string, b: string): number {
  const pa = parsePlaywrightContainerTag(a);
  const pb = parsePlaywrightContainerTag(b);
  if (pa.distro !== pb.distro) {
    throw new Error(`Playwright tag distro mismatch: ${a} vs ${b}`);
  }
  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
  if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1;
  return 0;
}

function extractWorkflowEnvTag(yaml: string, key: string): string {
  const m = new RegExp(`^\\s*${key}:\\s*(\\S+)\\s*$`, "m").exec(yaml);
  const value = m?.[1];
  if (value === undefined || value === "") {
    throw new Error(`missing workflow env ${key}`);
  }
  return value;
}

describe("Playwright container tag helpers (issue #610)", () => {
  test("parses and compares vX.Y.Z-distro tags", () => {
    expect(parsePlaywrightContainerTag("v1.61.1-noble")).toEqual({
      major: 1,
      minor: 61,
      patch: 1,
      distro: "noble",
    });
    expect(comparePlaywrightContainerTags("v1.61.1-noble", "v1.61.1-noble")).toBe(0);
    expect(comparePlaywrightContainerTags("v1.62.0-noble", "v1.61.1-noble")).toBe(1);
    expect(comparePlaywrightContainerTags("v1.60.0-noble", "v1.61.1-noble")).toBe(-1);
    expect(() => parsePlaywrightContainerTag("1.61.1-noble")).toThrow(/unexpected/);
    expect(() => comparePlaywrightContainerTags("v1.61.1-noble", "v1.61.1-jammy")).toThrow(
      /distro mismatch/,
    );
  });
});

describe("consumer support matrix", () => {
  test("PR default tier is a single Linux required row (issue #246)", () => {
    const matrix = loadSupportMatrix();
    const pr = prDefaultConsumerRows(matrix);
    expect(pr).toHaveLength(1);
    expect(pr[0]?.os).toBe("ubuntu-latest");
    expect(requiredConsumerRows(matrix).some((r) => r.os === "ubuntu-latest")).toBe(true);
  });

  test("is valid and has a bounded required/full nightly split", () => {
    const matrix = loadSupportMatrix(root);
    expect(validateSupportMatrix(matrix)).toEqual([]);
    expect(requiredConsumerRows(matrix).length).toBeGreaterThanOrEqual(4);
    expect(requiredConsumerRows(matrix).length).toBeLessThanOrEqual(6);
    expect(nightlyConsumerRows(matrix).length).toBeGreaterThan(requiredConsumerRows(matrix).length);
    expect(nightlyConsumerRows(matrix).length).toBeLessThanOrEqual(12);
  });

  test("rejects moving release boundaries out of the required/nightly tiers", () => {
    const matrix = loadSupportMatrix(root);
    const withoutRequiredNode = structuredClone(matrix);
    withoutRequiredNode.required = withoutRequiredNode.required.map((row) => ({
      ...row,
      node: "24",
    }));
    expect(validateSupportMatrix(withoutRequiredNode)).toContain(
      "required matrix must cover Node 22",
    );

    const withoutCanary = structuredClone(matrix);
    withoutCanary.nightly = withoutCanary.nightly.map((row) => ({ ...row, node: "24" }));
    expect(validateSupportMatrix(withoutCanary)).toContain("nightly matrix must cover Node 26");
  });

  test("keeps publishable manifests aligned with the declared Node and Svelte support", () => {
    const matrix = loadSupportMatrix(root);
    for (const dir of ["spec", "core", "compose", "svelte", "react", "cli"]) {
      const manifest = JSON.parse(
        readFileSync(join(root, "packages", dir, "package.json"), "utf8"),
      ) as {
        engines?: { node?: string };
        peerDependencies?: { svelte?: string; react?: string; "react-dom"?: string };
      };
      expect(manifest.engines?.node).toBe(matrix.node.range);
      if (dir === "svelte") expect(manifest.peerDependencies?.svelte).toBe(matrix.svelte.range);
      if (dir === "react") {
        expect(manifest.peerDependencies?.react).toBe(matrix.react.range);
        expect(manifest.peerDependencies?.["react-dom"]).toBe(matrix.react.range);
      }
    }
  });

  test("covers every installer, Svelte boundary, supported OS, and Node boundary", () => {
    const matrix = loadSupportMatrix(root);
    const rows = [...requiredConsumerRows(matrix), ...nightlyConsumerRows(matrix)];
    // Set<string> on both sides: the expected side is Object.keys, which cannot
    // narrow to the PackageManager union, and the point of the assertion is that
    // the two key sets are equal.
    expect(new Set<string>(rows.map((row) => row.packageManager))).toEqual(
      new Set(Object.keys(matrix.packageManagers)),
    );
    expect(new Set(rows.map((row) => row.svelte))).toEqual(
      new Set([matrix.svelte.minimum, matrix.svelte.current]),
    );
    expect(new Set(rows.map((row) => row.react))).toEqual(
      new Set([matrix.react.minimum, matrix.react.current]),
    );
    expect(new Set(rows.map((row) => row.os))).toEqual(new Set(matrix.operatingSystems));
    expect(new Set(rows.map((row) => row.node))).toEqual(
      new Set([...matrix.node.tested, matrix.node.canary]),
    );
  });

  test("keeps browser and contributor tool pins aligned", () => {
    const matrix = loadSupportMatrix(root);
    const rootManifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      packageManager: string;
      devDependencies: Record<string, string>;
    };
    const svelteManifest = JSON.parse(
      readFileSync(join(root, "packages/svelte/package.json"), "utf8"),
    ) as { devDependencies: Record<string, string> };
    const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
    // Consumers (matrix + package pins + ci.yml) must move in lockstep.
    // The publisher (build-ci-image.yml) may equal consumers in steady state,
    // or *lead* them after a step-1 prepublish of the next Playwright tag
    // (issue #610). It must never lag: a lagging publisher means main would
    // never publish the tag consumers already pull.
    // See CONTRIBUTING.md "Bumping Playwright / the CI runner image".
    const buildCiImage = readFileSync(join(root, ".github/workflows/build-ci-image.yml"), "utf8");
    const dockerfile = readFileSync(join(root, ".github/docker/ci-runner/Dockerfile"), "utf8");
    const consumerTag = `v${matrix.browsers.playwright}-noble`;
    const publisherTag = extractWorkflowEnvTag(buildCiImage, "PLAYWRIGHT_TAG");
    expect(rootManifest.packageManager).toBe(`bun@${matrix.packageManagers.bun}`);
    expect(rootManifest.devDependencies["@types/bun"]).toBe(`^${matrix.packageManagers.bun}`);
    expect(rootManifest.devDependencies["@playwright/test"]).toBe(matrix.browsers.playwright);
    expect(rootManifest.devDependencies["pnpm"]).toBe(matrix.packageManagers.pnpm);
    expect(svelteManifest.devDependencies["playwright"]).toBe(matrix.browsers.playwright);
    expect(ci).toContain(`PLAYWRIGHT_CONTAINER_TAG: ${consumerTag}`);
    expect(comparePlaywrightContainerTags(publisherTag, consumerTag)).toBeGreaterThanOrEqual(0);
    // Dockerfile ARG default tracks the publisher (build-arg overrides it;
    // keeping the default aligned avoids silent rebuilds against a stale base).
    expect(dockerfile).toContain(`ARG PLAYWRIGHT_TAG=${publisherTag}`);
  });

  test("keeps live bun pins aligned with the support matrix", () => {
    const bun = loadSupportMatrix(root).packageManagers.bun;
    const mise = readFileSync(join(root, "mise.toml"), "utf8");
    const setupBun = readFileSync(join(root, ".github/actions/ci-setup-bun/action.yml"), "utf8");
    const pages = readFileSync(join(root, "apps/docs/deployment/cloudflare-pages.json"), "utf8");
    const contributing = readFileSync(join(root, "CONTRIBUTING.md"), "utf8");
    expect(mise).toContain(`bun = "${bun}"`);
    expect(setupBun).toContain(`default: "${bun}"`);
    expect(pages).toContain(`"BUN_VERSION": "${bun}"`);
    expect(contributing).toContain(`bun ${bun}`);
    expect(contributing).toContain(`${bun} (pinned)`);
    const workflowDir = join(root, ".github/workflows");
    const literalPins: string[] = [];
    for (const name of readdirSync(workflowDir)) {
      if (!name.endsWith(".yml")) continue;
      const text = readFileSync(join(workflowDir, name), "utf8");
      for (const match of text.matchAll(/bun-version:\s*(\S+)/g)) {
        const value = match[1]!.replaceAll('"', "");
        if (value.startsWith("${{")) continue;
        literalPins.push(`${name}:${value}`);
        expect(value, name).toBe(bun);
      }
    }
    expect(literalPins.length).toBeGreaterThan(0);
  });

  test("keeps the README support claim aligned with the matrix", () => {
    const matrix = loadSupportMatrix(root);
    const readme = readFileSync(join(root, "README.md"), "utf8");
    const svelteFloorLabel = matrix.svelte.minimum.replace(/\.0$/, "");
    expect(readme).toContain(`Node.js ${matrix.node.tested[0]}+`);
    expect(readme).toContain(`Svelte ${svelteFloorLabel}+`);
    expect(readme).toContain(
      `React DOM ${matrix.react.minimum.replace(/\.0$/, "")} or ${matrix.react.current.split(".")[0]}`,
    );
  });
});
