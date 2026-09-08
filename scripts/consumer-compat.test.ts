import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  commandExecutable,
  commandInvocation,
  commandPlan,
  fixtureManifest,
  packagePackInvocation,
  packageTarballNames,
  resolveConsumerOptions,
  writeConsumerFixture,
} from "./consumer-compat.js";
import { writeReactConsumerFixture } from "./consumer-compat-react-fixture.js";
import { QUICKSTART_PAGE_SVELTE } from "./quickstart.js";
import { loadSupportMatrix } from "./support-matrix.js";

describe("packed consumer compatibility harness", () => {
  test("installs every publishable tarball rather than workspace source", () => {
    expect(
      packageTarballNames({
        spec: "0.2.0",
        core: "0.2.0",
        compose: "0.2.0",
        svelte: "0.2.1",
        cli: "0.2.1",
        react: "0.2.1",
        skill: "0.2.1",
      }),
    ).toEqual([
      "ggts-sh-spec-0.2.0.tgz",
      "ggts-sh-core-0.2.0.tgz",
      "ggts-sh-compose-0.2.0.tgz",
      "ggts-sh-svelte-0.2.1.tgz",
      "ggts-sh-react-0.2.1.tgz",
      "ggts-sh-cli-0.2.1.tgz",
      "ggts-sh-skill-0.2.1.tgz",
    ]);
  });

  test("uses executable package-manager shims without enabling a shell on Windows", () => {
    expect(commandExecutable("npm", "win32")).toBe("npm.cmd");
    expect(commandExecutable("pnpm", "win32")).toBe("pnpm.cmd");
    expect(commandExecutable("bun", "win32")).toBe("bun");
    expect(commandExecutable("npm", "linux")).toBe("npm");
  });

  test("packs release-shaped artifacts with npm, matching changesets publish", () => {
    expect(packagePackInvocation("/artifacts", "linux")).toEqual({
      command: "npm",
      args: ["pack", ".", "--pack-destination", "/artifacts", "--ignore-scripts", "--silent"],
    });
    expect(packagePackInvocation("C:\\artifacts", "win32").command).toBe("npm.cmd");
  });

  test("reads matrix options from the environment without shell-specific expansion", () => {
    expect(
      resolveConsumerOptions([], {
        PACKAGE_MANAGER: "pnpm",
        PACKAGE_MANAGER_VERSION: "11.13.0",
        SVELTE_VERSION: "5.56.5",
      }),
    ).toEqual({
      packageManager: "pnpm",
      packageManagerVersion: "11.13.0",
      svelteVersion: "5.56.5",
      reactVersion: loadSupportMatrix().react.minimum,
    });
  });

  test("default Svelte version matches the support-matrix floor", () => {
    expect(resolveConsumerOptions([], {}).svelteVersion).toBe(loadSupportMatrix().svelte.minimum);
  });

  test("invokes the pinned pnpm CLI without relying on an installer-generated shim", () => {
    expect(commandInvocation("pnpm", ["--version"], "/repo", "linux")).toEqual({
      command: "node",
      args: [join("/repo", "node_modules", "pnpm", "bin", "pnpm.mjs"), "--version"],
    });
  });

  test.each(["npm", "pnpm", "bun"] as const)(
    "%s plan installs, checks, builds, renders, and exercises the CLI",
    (packageManager) => {
      const plan = commandPlan(packageManager, "9.8.7");
      expect(plan[0]?.label).toBe("install packed consumer");
      expect(plan.map((step) => step.label)).toEqual([
        "install packed consumer",
        "sync and type-check SvelteKit consumer",
        "build and prerender SvelteKit consumer",
        "verify prerendered Quickstart",
        "runtime and SSR smoke",
        "CLI version",
        "CLI file input",
        "CLI stdin",
        "CLI check",
      ]);
      expect(plan.find((step) => step.label === "CLI version")?.expect).toBe("9.8.7");
    },
  );

  test("writes the exact documented Quickstart as the SvelteKit route", () => {
    const directory = mkdtempSync(join(tmpdir(), "ggsvelte-consumer-fixture-"));
    try {
      writeConsumerFixture(
        directory,
        "5.33.1",
        [
          "/tmp/ggts-sh-spec-0.tgz",
          "/tmp/ggts-sh-core-0.tgz",
          "/tmp/ggts-sh-compose-0.tgz",
          "/tmp/ggts-sh-svelte-0.tgz",
          "/tmp/ggts-sh-cli-0.tgz",
          "/tmp/ggts-sh-skill-0.tgz",
        ],
        "npm",
      );
      expect(readFileSync(join(directory, "src", "routes", "+page.svelte"), "utf8")).toBe(
        `${QUICKSTART_PAGE_SVELTE}\n`,
      );
      const tsconfig = JSON.parse(readFileSync(join(directory, "tsconfig.json"), "utf8")) as {
        compilerOptions: { lib: string[] };
      };
      expect(tsconfig.compilerOptions.lib).toEqual(["ES2024", "DOM", "DOM.Iterable"]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("names every local tarball in the consumer manifest", () => {
    const manifest = fixtureManifest(
      "0.0.0-fixture",
      [
        join("artifacts", "ggts-sh-spec-0.0.0.tgz"),
        join("artifacts", "ggts-sh-core-0.0.0.tgz"),
        join("artifacts", "ggts-sh-compose-0.0.0.tgz"),
        join("artifacts", "ggts-sh-svelte-0.0.0.tgz"),
        join("artifacts", "ggts-sh-cli-0.0.0.tgz"),
        join("artifacts", "ggts-sh-skill-0.0.0.tgz"),
      ],
      "/consumer",
    );
    expect(manifest.dependencies.svelte).toBe("0.0.0-fixture");
    expect(manifest.dependencies["@ggts-sh/spec"]).toContain("ggts-sh-spec-0.0.0.tgz");
    expect(manifest.dependencies["@ggts-sh/core"]).toContain("ggts-sh-core-0.0.0.tgz");
    expect(manifest.dependencies["@ggts-sh/compose"]).toContain("ggts-sh-compose-0.0.0.tgz");
    expect(manifest.dependencies["@ggts-sh/svelte"]).toContain("ggts-sh-svelte-0.0.0.tgz");
    expect(manifest.dependencies["@ggts-sh/cli"]).toContain("ggts-sh-cli-0.0.0.tgz");
    expect(manifest.devDependencies).toMatchObject({
      "@sveltejs/adapter-static": "3.0.10",
      "@sveltejs/kit": "2.20.8",
      "@sveltejs/vite-plugin-svelte": "5.1.1",
      "@types/node": "22.15.3",
      "svelte-check": "4.7.3",
      typescript: "6.0.3",
      vite: "6.4.3",
    });
    expect(manifest.scripts).toEqual({
      check: "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings",
      build: "vite build",
    });
  });
});

test("React consumers use their packed adapter and skill with no Svelte dependency", () => {
  const directory = mkdtempSync(join(tmpdir(), "react-consumer-"));
  try {
    writeReactConsumerFixture(
      directory,
      "18.2.0",
      ["spec", "core", "compose", "react", "cli", "skill"].map(
        (name) => `/tmp/ggts-sh-${name}-0.tgz`,
      ),
      "pnpm",
    );
    const manifest: unknown = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
    expect(manifest).toMatchObject({
      dependencies: {
        react: "18.2.0",
        "react-dom": "18.2.0",
        "@ggts-sh/react": "file:../ggts-sh-react-0.tgz",
        "@ggts-sh/skill": "file:../ggts-sh-skill-0.tgz",
      },
    });
    expect(manifest).not.toHaveProperty("dependencies.svelte");
    expect(manifest).not.toHaveProperty("dependencies.@ggts-sh/svelte");
    expect(readFileSync(join(directory, "pnpm-workspace.yaml"), "utf8")).toContain(
      "@ggts-sh/react",
    );
    expect(commandPlan("pnpm", "0", "react").map((step) => step.label)).toContain(
      "type-check React consumer",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
