import { readFileSync } from "node:fs";
import { join } from "node:path";

export type PackageManager = "npm" | "pnpm" | "bun";

export interface ConsumerRow {
  os: "ubuntu-latest" | "windows-latest" | "macos-latest";
  node: string;
  packageManager: PackageManager;
  svelte: string;
  react: string;
}

export interface SupportMatrix {
  schemaVersion: 1;
  node: { range: string; tested: string[]; canary: string };
  svelte: { range: string; minimum: string; current: string };
  react: { range: string; minimum: string; current: string };
  packageManagers: Record<PackageManager, string>;
  operatingSystems: ConsumerRow["os"][];
  browsers: { playwright: string; engines: string[] };
  required: ConsumerRow[];
  nightly: ConsumerRow[];
}

export function loadSupportMatrix(root = join(import.meta.dir, "..")): SupportMatrix {
  return JSON.parse(readFileSync(join(root, "support-matrix.json"), "utf8")) as SupportMatrix;
}

export function requiredConsumerRows(matrix: SupportMatrix): ConsumerRow[] {
  return matrix.required;
}

export function nightlyConsumerRows(matrix: SupportMatrix): ConsumerRow[] {
  return matrix.nightly;
}

/** PR default tier (issue #246): one Linux required row — full required via run-compat / nightly. */
export function prDefaultConsumerRows(matrix: SupportMatrix): ConsumerRow[] {
  const linux = matrix.required.find((row) => row.os === "ubuntu-latest");
  if (linux === undefined) {
    throw new Error("support-matrix required rows must include at least one ubuntu-latest row");
  }
  return [linux];
}

function requiredCoverageProblems(matrix: SupportMatrix): string[] {
  const errors: string[] = [];
  const requiredValues = {
    node: new Set(matrix.required.map((row) => row.node)),
    svelte: new Set(matrix.required.map((row) => row.svelte)),
    react: new Set(matrix.required.map((row) => row.react)),
    packageManager: new Set(matrix.required.map((row) => row.packageManager)),
    os: new Set(matrix.required.map((row) => row.os)),
  };
  for (const node of matrix.node.tested) {
    if (!requiredValues.node.has(node)) errors.push(`required matrix must cover Node ${node}`);
  }
  for (const svelte of [matrix.svelte.minimum, matrix.svelte.current]) {
    if (!requiredValues.svelte.has(svelte))
      errors.push(`required matrix must cover Svelte ${svelte}`);
  }
  for (const react of [matrix.react.minimum, matrix.react.current]) {
    if (!requiredValues.react.has(react)) errors.push(`required matrix must cover React ${react}`);
  }
  for (const packageManager of Object.keys(matrix.packageManagers) as PackageManager[]) {
    if (!requiredValues.packageManager.has(packageManager)) {
      errors.push(`required matrix must cover ${packageManager}`);
    }
  }
  for (const os of ["ubuntu-latest", "windows-latest"] as const) {
    if (!requiredValues.os.has(os)) errors.push(`required matrix must cover ${os}`);
  }
  return errors;
}

function rowProblems(matrix: SupportMatrix, rows: readonly ConsumerRow[]): string[] {
  const errors: string[] = [];
  const keys = new Set<string>();
  for (const row of rows) {
    if (!matrix.operatingSystems.includes(row.os)) errors.push(`unknown OS: ${row.os}`);
    if (!(row.packageManager in matrix.packageManagers)) {
      errors.push(`unknown package manager: ${row.packageManager}`);
    }
    if (![...matrix.node.tested, matrix.node.canary].includes(row.node)) {
      errors.push(`unknown Node version: ${row.node}`);
    }
    if (![matrix.svelte.minimum, matrix.svelte.current].includes(row.svelte)) {
      errors.push(`unknown Svelte version: ${row.svelte}`);
    }
    if (![matrix.react.minimum, matrix.react.current].includes(row.react)) {
      errors.push(`unknown React version: ${row.react}`);
    }
    const key = `${row.os}/${row.node}/${row.packageManager}/${row.svelte}/${row.react}`;
    if (keys.has(key)) errors.push(`duplicate row: ${key}`);
    keys.add(key);
  }
  return errors;
}

export function validateSupportMatrix(matrix: SupportMatrix): string[] {
  const errors: string[] = [];
  if (matrix.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (matrix.node.range !== `>=${matrix.node.tested[0]}`) {
    errors.push("Node range must begin at the first required tested major");
  }
  if (matrix.svelte.range !== `^${matrix.svelte.minimum}`) {
    errors.push("Svelte peer range must begin at the tested minimum");
  }
  if (matrix.react.range !== `^${matrix.react.minimum} || ^19.0.0`) {
    errors.push("React peer range must begin at the tested minimum");
  }
  if (matrix.required.length < 4 || matrix.required.length > 6) {
    errors.push("required matrix must contain 4–6 covering rows");
  }
  if (matrix.required.length + matrix.nightly.length > 12) {
    errors.push("full nightly matrix must contain at most 12 rows");
  }
  const rows = [...matrix.required, ...matrix.nightly];
  errors.push(...requiredCoverageProblems(matrix));
  if (!matrix.nightly.some((row) => row.node === matrix.node.canary)) {
    errors.push(`nightly matrix must cover Node ${matrix.node.canary}`);
  }
  if (!matrix.nightly.some((row) => row.os === "macos-latest")) {
    errors.push("nightly matrix must cover macos-latest");
  }
  errors.push(...rowProblems(matrix, rows));
  if (matrix.browsers.engines.join(",") !== "chromium,firefox,webkit") {
    errors.push("browser matrix must contain Chromium, Firefox, and WebKit");
  }
  return errors;
}

if (import.meta.main) {
  const matrix = loadSupportMatrix();
  const errors = validateSupportMatrix(matrix);
  if (errors.length > 0) {
    for (const error of errors) console.error(`support-matrix: ${error}`);
    process.exit(1);
  }
  const flavor = process.argv[2];
  const withVersions = (rows: ConsumerRow[]) =>
    rows.map((row) => ({
      ...row,
      packageManagerVersion: matrix.packageManagers[row.packageManager],
    }));
  if (flavor === "required")
    console.log(JSON.stringify({ include: withVersions(matrix.required) }));
  else if (flavor === "pr") {
    console.log(JSON.stringify({ include: withVersions(prDefaultConsumerRows(matrix)) }));
  } else if (flavor === "nightly") {
    console.log(JSON.stringify({ include: withVersions([...matrix.required, ...matrix.nightly]) }));
  } else console.log("support-matrix: valid");
}
