/**
 * Pure packed-consumer command planning (package managers, pack/install steps).
 * Fixture templates: consumer-compat-fixture.ts. CLI harness: consumer-compat.ts.
 */
import { join } from "node:path";

import { loadSupportMatrix, type PackageManager } from "./support-matrix.js";

export interface CommandStep {
  label: string;
  command: string;
  args: string[];
  input?: string;
  expect?: string;
}

export const publishablePackageDirectories = [
  "spec",
  "core",
  "compose",
  "svelte",
  "react",
  "cli",
  "skill",
] as const;

export type PublishablePackageVersions = Readonly<
  Record<(typeof publishablePackageDirectories)[number], string>
>;

/** Minimal point plot used by CLI stdin smoke and fixture `plot.json`. */
export const consumerPlotSpec = {
  data: {
    values: [
      { x: 1, y: 2 },
      { x: 2, y: 3 },
    ],
  },
  layers: [{ geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } }],
};

export function packageTarballNames(versions: PublishablePackageVersions): string[] {
  return publishablePackageDirectories.map(
    (packageDirectory) => `ggsvelte-${packageDirectory}-${versions[packageDirectory]}.tgz`,
  );
}

export function commandExecutable(command: string, platform = process.platform): string {
  if (platform === "win32" && (command === "npm" || command === "pnpm")) {
    return `${command}.cmd`;
  }
  return command;
}

export function resolveConsumerOptions(
  args: string[],
  environment: Record<string, string | undefined>,
) {
  return {
    packageManager: (args[0] ?? environment["PACKAGE_MANAGER"] ?? "npm") as PackageManager,
    // Single-sourced from support-matrix.json — the floor lives in one place.
    svelteVersion: args[1] ?? environment["SVELTE_VERSION"] ?? loadSupportMatrix().svelte.minimum,
    packageManagerVersion: args[2] ?? environment["PACKAGE_MANAGER_VERSION"],
    reactVersion: args[3] ?? environment["REACT_VERSION"] ?? loadSupportMatrix().react.minimum,
  };
}

export function commandInvocation(
  command: string,
  args: string[],
  root: string,
  platform = process.platform,
): { command: string; args: string[] } {
  if (command === "pnpm") {
    return {
      command: "node",
      args: [join(root, "node_modules", "pnpm", "bin", "pnpm.mjs"), ...args],
    };
  }
  return { command: commandExecutable(command, platform), args };
}

export function packagePackInvocation(
  artifacts: string,
  platform = process.platform,
): { command: string; args: string[] } {
  return {
    command: commandExecutable("npm", platform),
    args: ["pack", ".", "--pack-destination", artifacts, "--ignore-scripts", "--silent"],
  };
}

function runner(packageManager: PackageManager, binary: string, args: string[]): CommandStep {
  if (packageManager === "npm") {
    return { label: "", command: "npm", args: ["exec", "--", binary, ...args] };
  }
  if (packageManager === "pnpm") {
    return { label: "", command: "pnpm", args: ["exec", binary, ...args] };
  }
  return { label: "", command: "bun", args: ["run", binary, ...args] };
}

function scriptRunner(packageManager: PackageManager, script: string): CommandStep {
  return { label: "", command: packageManager, args: ["run", script] };
}

export function commandPlan(
  packageManager: PackageManager,
  expectedCliPackageVersion: string,
  framework: "svelte" | "react" = "svelte",
): CommandStep[] {
  const install: CommandStep =
    packageManager === "npm"
      ? {
          label: "install packed consumer",
          command: "npm",
          args: ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
        }
      : packageManager === "pnpm"
        ? {
            label: "install packed consumer",
            command: "pnpm",
            args: ["install", "--ignore-scripts"],
          }
        : {
            label: "install packed consumer",
            command: "bun",
            args: ["install", "--ignore-scripts"],
          };

  const typecheck = scriptRunner(packageManager, "check");
  typecheck.label =
    framework === "svelte" ? "sync and type-check SvelteKit consumer" : "type-check React consumer";
  const build = scriptRunner(packageManager, "build");
  build.label =
    framework === "svelte" ? "build and prerender SvelteKit consumer" : "build React consumer";
  const cliVersion = runner(packageManager, "ggts", ["--version"]);
  cliVersion.label = "CLI version";
  cliVersion.expect = expectedCliPackageVersion;
  const cliFile = runner(packageManager, "ggts", ["render", "plot.json"]);
  cliFile.label = "CLI file input";
  cliFile.expect = "<svg";
  const cliStdin = runner(packageManager, "ggts", ["render"]);
  cliStdin.label = "CLI stdin";
  cliStdin.input = `${JSON.stringify(consumerPlotSpec)}\n`;
  cliStdin.expect = "<svg";

  return [
    install,
    typecheck,
    build,
    ...(framework === "svelte"
      ? [
          {
            label: "verify prerendered Quickstart",
            command: "node",
            args: ["verify-prerender.mjs"],
            expect: "prerendered Quickstart verified",
          },
        ]
      : []),
    {
      label: "runtime and SSR smoke",
      command: "node",
      args: ["smoke.mjs"],
      expect: "consumer smoke passed",
    },
    cliVersion,
    cliFile,
    cliStdin,
    { ...runner(packageManager, "ggts", ["check", "plot.json"]), label: "CLI check" },
  ];
}
