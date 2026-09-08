import { describe, expect, it } from "bun:test";
import { read } from "./test-helpers";

describe("R0 release wiring — packages", () => {
  it("versions only publishable packages", () => {
    const config = JSON.parse(read(".changeset/config.json")) as {
      $schema?: string;
      format?: string | false;
      ignore?: string[];
      fixed?: string[][];
      linked?: string[][];
      privatePackages?: boolean | { version?: boolean; tag?: boolean };
    };
    expect(config.privatePackages).toBe(false);
    // CLI v3 `format: auto` can pick oxfmt (also installed). Prettier is the
    // documented markdown formatter, so keep changelog generation on it.
    expect(config.format).toBe("prettier");
    expect(config.$schema).toContain("@changesets/config@4.0.0");
    expect(config.ignore).toEqual(["@ggsvelte-spike/*"]);
    // fixed (not linked): any release bumps all publishable packages so
    // lockstep versions stay equal even when only one package has a changeset.
    expect(config.fixed).toEqual([
      [
        "@ggsvelte/spec",
        "@ggsvelte/core",
        "@ggsvelte/compose",
        "@ggsvelte/svelte",
        "@ggsvelte/react",
        "@ggsvelte/cli",
        "@ggsvelte/skill",
      ],
    ]);
    expect(config.linked ?? []).toEqual([]);
  });

  it("ships the CLI bins without npm manifest normalization", () => {
    const svelteManifest = JSON.parse(read("packages/svelte/package.json")) as {
      bin?: Record<string, string>;
    };
    expect(svelteManifest.bin).toEqual({
      "ggsvelte-codemod": "bin/ggsvelte-codemod.js",
    });
    const cliManifest = JSON.parse(read("packages/cli/package.json")) as {
      bin?: Record<string, string>;
    };
    expect(cliManifest.bin).toEqual({
      ggts: "bin/ggts.js",
      "ggsvelte-render": "bin/ggsvelte-render.js",
    });
  });

  it("keeps every bin's entry file present and executable-shaped", () => {
    // A bin whose target is missing installs a broken command; npm does not
    // validate the path, so this is the only gate that would catch it.
    for (const path of [
      "packages/svelte/bin/ggsvelte-codemod.js",
      "packages/cli/bin/ggsvelte-render.js",
      "packages/cli/bin/ggts.js",
    ]) {
      const source = read(path);
      expect(source.startsWith("#!/usr/bin/env node"), `${path} needs a shebang`).toBe(true);
    }
  });
});
