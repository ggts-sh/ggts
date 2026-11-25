/**
 * Shared generated-artifact protocol (#783).
 *
 * One check/write/CLI seam for committed generator output. Generators keep
 * domain `build()` logic; this module owns MISSING/STALE messaging, byte
 * comparison, optional dependency attribution, and oxfmt for TS projections.
 *
 * dependsOn semantics (static-import safe):
 * - check(): run deps first; failures attribute the true cause via `because`
 * - write(): require deps already current; refuse to cascade in-process
 *   (module-graph bindings would still see stale imports)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import { format } from "oxfmt";

export type ArtifactStatus = "MISSING" | "STALE";

const REPO_ROOT = resolve(import.meta.dir, "..");

export class ArtifactError extends Error {
  readonly status: ArtifactStatus;
  readonly artifactPath: string;
  readonly regenerateWith: string;
  readonly label: string;
  readonly because?: ArtifactError;

  constructor(opts: {
    status: ArtifactStatus;
    path: string;
    regenerateWith: string;
    label: string;
    because?: ArtifactError;
  }) {
    super(formatArtifactMessage(opts));
    this.name = "ArtifactError";
    this.status = opts.status;
    this.artifactPath = opts.path;
    this.regenerateWith = opts.regenerateWith;
    this.label = opts.label;
    if (opts.because !== undefined) this.because = opts.because;
  }
}

/** Root-cause first, then intermediates, then the leaf — full regen order. */
function regenerateChain(leaf: { regenerateWith: string; because?: ArtifactError }): string[] {
  const scripts: string[] = [];
  const walk = (err: { regenerateWith: string; because?: ArtifactError }) => {
    if (err.because) walk(err.because);
    if (!scripts.includes(err.regenerateWith)) scripts.push(err.regenerateWith);
  };
  walk(leaf);
  return scripts;
}

function formatArtifactMessage(opts: {
  status: ArtifactStatus;
  regenerateWith: string;
  label: string;
  because?: ArtifactError;
}): string {
  if (!opts.because) {
    return `${opts.label} is ${opts.status}. Run: bun run ${opts.regenerateWith}`;
  }
  const root = (() => {
    let cur: ArtifactError = opts.because;
    while (cur.because) cur = cur.because;
    return cur;
  })();
  const chain = regenerateChain({
    regenerateWith: opts.regenerateWith,
    because: opts.because,
  });
  const run = chain.map((script) => `bun run ${script}`).join(" && ");
  return `${opts.label} is ${opts.status} because ${root.label} is ${root.status}. Run: ${run}.`;
}

export type ArtifactDef = {
  /** Absolute path to the committed artifact file. */
  path: string;
  /** Fresh bytes (caller formats if needed; see formatGeneratedSource). */
  build: () => string | Promise<string>;
  /** npm script name for fix messages, e.g. "docs:routes:gen". */
  regenerateWith: string;
  /** Reuse this check within one walk when its builder is read-only and inputs are stable. */
  cacheCheck?: boolean;
  /** Optional label for messages; defaults to repo-relative path. */
  label?: string;
  /**
   * Artifacts that must be current before this build is meaningful.
   * check()/write() verify dependencies first; write does not cascade.
   */
  dependsOn?: readonly Artifact[];
};

export type Artifact = {
  readonly path: string;
  readonly regenerateWith: string;
  readonly label: string;
  check(): Promise<void>;
  write(): Promise<{ wrote: boolean }>;
  cli(argv?: readonly string[]): Promise<void>;
};

function defaultLabel(path: string): string {
  const rel = relative(REPO_ROOT, path);
  return rel === "" || rel.startsWith("..") ? path : rel;
}

type ArtifactCheck = (verified?: Set<ArtifactCheck>) => Promise<void>;
const artifactChecks = new WeakMap<Artifact, { check: Artifact["check"]; verify: ArtifactCheck }>();

async function ensureArtifactsCurrent(
  deps: readonly Artifact[] | undefined,
  verified?: Set<ArtifactCheck>,
): Promise<boolean> {
  if (deps === undefined) return true;
  let stable = true;
  for (const dep of deps) {
    const factory = verified && artifactChecks.get(dep);
    const descriptor = factory && Object.getOwnPropertyDescriptor(dep, "check");
    if (verified === undefined || factory === undefined || descriptor?.value !== factory.check) {
      await dep.check();
    } else {
      const { verify } = factory;
      if (!verified.has(verify)) await verify(verified);
      if (verified.has(verify)) continue;
    }
    // A check without a stable builder can change files seen by later checks.
    verified?.clear();
    stable = false;
  }
  return stable;
}

function wrapDepFailure(
  error: unknown,
  self: { path: string; regenerateWith: string; label: string },
): never {
  if (error instanceof ArtifactError) {
    // Keep the immediate dependency so multi-hop DAGs retain the full chain
    // (search → routes → lifecycle). Flattening dropped intermediate gens.
    throw new ArtifactError({
      status: error.status,
      path: self.path,
      regenerateWith: self.regenerateWith,
      label: self.label,
      because: error,
    });
  }
  throw error;
}

export function defineArtifact(def: ArtifactDef): Artifact {
  const label = def.label ?? defaultLabel(def.path);
  const cacheCheck = def.cacheCheck === true;
  const self = {
    path: def.path,
    regenerateWith: def.regenerateWith,
    label,
  };

  async function verify(verified?: Set<ArtifactCheck>): Promise<void> {
    let stableDeps: boolean;
    try {
      stableDeps = await ensureArtifactsCurrent(def.dependsOn, verified);
    } catch (error) {
      wrapDepFailure(error, self);
    }
    const fresh = await def.build();
    if (!existsSync(def.path)) {
      throw new ArtifactError({
        status: "MISSING",
        path: def.path,
        regenerateWith: def.regenerateWith,
        label,
      });
    }
    const current = readFileSync(def.path, "utf8");
    if (current !== fresh) {
      throw new ArtifactError({
        status: "STALE",
        path: def.path,
        regenerateWith: def.regenerateWith,
        label,
      });
    }
    if (stableDeps) verified?.add(verify);
  }

  function check(): Promise<void> {
    return verify(cacheCheck ? new Set() : undefined);
  }

  async function write(): Promise<{ wrote: boolean }> {
    try {
      await ensureArtifactsCurrent(def.dependsOn);
    } catch (error) {
      wrapDepFailure(error, self);
    }
    const fresh = await def.build();
    if (existsSync(def.path) && readFileSync(def.path, "utf8") === fresh) {
      return { wrote: false };
    }
    mkdirSync(dirname(def.path), { recursive: true });
    writeFileSync(def.path, fresh);
    return { wrote: true };
  }

  async function cli(argv: readonly string[] = process.argv): Promise<void> {
    const checkMode = argv.includes("--check");
    try {
      if (checkMode) {
        await check();
        console.log(`${label} is current.`);
        return;
      }
      const { wrote } = await write();
      console.log(wrote ? `Wrote ${label}.` : `${label} already current.`);
    } catch (error) {
      if (error instanceof ArtifactError) {
        console.error(error.message);
        process.exit(1);
      }
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  const artifact = {
    path: def.path,
    regenerateWith: def.regenerateWith,
    label,
    check,
    write,
    cli,
  };
  if (cacheCheck) artifactChecks.set(artifact, { check, verify });
  return artifact;
}

export type ArtifactGroupDef = {
  regenerateWith: string;
  members: readonly Artifact[];
  /** Reuse stable member checks during one group check when member iteration is read-only. */
  cacheCheck?: boolean;
  /** Extra check after all members pass (orphan sweeps, provenance, digests). */
  extraCheck?: () => void | Promise<void>;
  /** Extra write after members write (PNG copy, provenance prune, dir wipe). */
  extraWrite?: () => void | Promise<void>;
};

export type ArtifactGroup = {
  check(): Promise<void>;
  write(): Promise<void>;
  cli(argv?: readonly string[]): Promise<void>;
};

export function defineArtifactGroup(def: ArtifactGroupDef): ArtifactGroup {
  const cacheCheck = def.cacheCheck === true;

  async function check(): Promise<void> {
    if (cacheCheck) {
      await ensureArtifactsCurrent(def.members, new Set());
    } else {
      for (const member of def.members) {
        await member.check();
      }
    }
    await def.extraCheck?.();
  }

  async function write(): Promise<void> {
    for (const member of def.members) {
      await member.write();
    }
    await def.extraWrite?.();
  }

  async function cli(argv: readonly string[] = process.argv): Promise<void> {
    const checkMode = argv.includes("--check");
    try {
      if (checkMode) {
        await check();
        console.log(`${def.regenerateWith.replace(/:gen$/, "")} artifacts are current.`);
        return;
      }
      await write();
      console.log(`${def.regenerateWith.replace(/:gen$/, "")} artifacts generated.`);
    } catch (error) {
      if (error instanceof ArtifactError) {
        console.error(error.message);
        process.exit(1);
      }
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  return { check, write, cli };
}

/** oxfmt helper used by TS projections (uniform format errors). */
export async function formatGeneratedSource(path: string, source: string): Promise<string> {
  const result = await format(path, source);
  if (result.errors.length > 0) {
    throw new Error(
      `Could not format generated source for ${path}: ${result.errors[0]?.message ?? "unknown error"}`,
    );
  }
  return result.code;
}
