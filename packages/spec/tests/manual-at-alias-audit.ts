/**
 * Audit helpers for manual-AT release evidence aliases.
 *
 * An alias may ship without a new AT matrix only when the release commit range
 * does not touch chart/interaction runtime sources. The boolean
 * `runtimeBehaviorChanged: false` is necessary but not sufficient.
 */
import { spawnSync } from "node:child_process";

/** Paths whose substantive edits require a complete manual AT record. */
export function isRuntimeBehaviorPath(path: string): boolean {
  return path.startsWith("packages/svelte/src/") || path.startsWith("packages/core/src/");
}

export function runtimeBehaviorPaths(paths: readonly string[]): string[] {
  return paths.filter((path) => isRuntimeBehaviorPath(path));
}

/**
 * True when a unified (or binary) diff contains non-comment behavior changes.
 * JSDoc/block-comment noise is ignored; CSS universal selectors and code are not.
 */
export function diffTextIsSubstantive(diff: string): boolean {
  if (diff.includes("Binary files ") || diff.includes("GIT binary patch")) return true;

  for (const line of diff.split("\n")) {
    if (!(line.startsWith("+") || line.startsWith("-"))) continue;
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (!isSkippableCommentLine(line.slice(1))) return true;
  }
  return false;
}

/**
 * Known HTML/SVG type selectors. Used for bare multi-token chains after a
 * combinator so arbitrary English (`minimum latency`) stays documentation while
 * real tag chains (`ul li`, `a span`, `svg polygon`, `my-widget path`) stay CSS.
 * camelCase SVG names are stored as authored.
 */
const CSS_TYPE_TOKEN = new Set(
  (
    "a abbr address area article aside audio b base bdi bdo blockquote body br " +
    "button canvas caption circle cite code col colgroup data datalist dd del " +
    "details dfn dialog div dl dt em embed fieldset figcaption figure footer " +
    "form g h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins " +
    "kbd label legend li line link main map mark menu meta meter nav noscript " +
    "object ol optgroup option output p param path picture pre progress q rect " +
    "rp rt ruby s samp script section select slot small source span strong style " +
    "sub summary sup svg table tbody td template text textarea tfoot th thead " +
    "time title tr track u ul var video wbr use defs clipPath linearGradient " +
    "radialGradient stop tspan foreignObject pattern marker symbol switch " +
    "animate animateTransform animateMotion mpath metadata set image polygon " +
    "polyline ellipse textPath mask view feBlend feColorMatrix " +
    "feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting " +
    "feDisplacementMap feDistantLight feDropShadow feFlood feFuncA feFuncB " +
    "feFuncG feFuncR feGaussianBlur feImage feMerge feMergeNode feMorphology " +
    "feOffset fePointLight feSpecularLighting feSpotLight feTile feTurbulence " +
    "filter"
  ).split(/\s+/),
);

/**
 * English-first collocations that are HTML tag names but common in JSDoc lists
 * (`* + data table`, `* + source code`). Not CSS `a span` / `a img`.
 */
const BARE_CHAIN_PROSE_PAIR = new Set(["data table", "source code", "mark time", "object video"]);

/** HTML custom elements must contain a hyphen (HTML living standard). */
function isCustomElementToken(token: string): boolean {
  return /^[a-z][\w]*-[\w-]+$/.test(token);
}

function isCssTypeToken(token: string): boolean {
  return (
    token === "*" ||
    CSS_TYPE_TOKEN.has(token) ||
    CSS_TYPE_TOKEN.has(token.toLowerCase()) ||
    isCustomElementToken(token)
  );
}

/** Bare multi-token chain after a combinator: CSS vs English. */
function bareMultiTokenChainIsCss(tokens: readonly string[]): boolean {
  if (BARE_CHAIN_PROSE_PAIR.has(tokens.map((t) => t.toLowerCase()).join(" "))) return false;
  // Allowlist + custom elements only (no global camelCase / no loose SVG-context).
  return tokens.every((t) => isCssTypeToken(t));
}

/**
 * After a CSS combinator (`+`, `>`, `~`), is the remainder a selector fragment?
 * Distinguishes `* + * {…}` / `* > .mark` / `* > ul li {…}` / `* > ul *` from
 * JSDoc/Markdown `* + list item` and `* > Note`.
 */
function isCssSelectorAfterCombinator(rest: string): boolean {
  if (rest.length === 0) return false;
  // Universal, class, id, attribute, or pseudo at the start of the remainder.
  if (rest.startsWith("*") || /^[.#[]/.test(rest) || rest.startsWith(":")) return true;

  // Strong CSS structure anywhere (not English end-of-sentence `. Kept`).
  if (/[{[]/.test(rest)) return true;
  if (/(?:^|[\s>+~,])[.#][\w-]/.test(rest)) return true;
  // Pseudo requires ident immediately after `:` so `Note: prose` stays docs.
  if (/::?[\w-]/.test(rest)) return true;

  // Leading type / universal chain (descendant spaces), then optional structure.
  const lead = rest.match(/^((?:[A-Za-z_][\w-]*|\*)(?:\s+(?:[A-Za-z_][\w-]*|\*))*)(.*)$/);
  if (lead === null) return false;
  const tokens = lead[1]!.split(/\s+/);
  const suffix = (lead[2] ?? "").trimStart();

  if (suffix.length === 0) {
    // Bare single lowercase type (`* + p`, `* + section`) — `{` often next line.
    if (tokens.length === 1) {
      const only = tokens[0]!;
      return only === "*" || /^[a-z][\w-]*$/.test(only);
    }
    // Bare multi-token: HTML/SVG/custom-element types only (not English prose).
    // Anchor-led chains (`a span`) are real CSS — do not blanket-skip lead `a`.
    return bareMultiTokenChainIsCss(tokens);
  }

  // Weak structure (`,>+~`): recurse so `ul li, ol li` and `ul li > a` count as
  // CSS while `positive values, if any` stays prose via the bare-chain rules.
  if (/^[,>+~]/.test(suffix)) {
    const afterComb = suffix.slice(1).trimStart();
    if (afterComb.length === 0) return tokens.length === 1;
    return isCssSelectorAfterCombinator(afterComb);
  }

  return false;
}

/** Lines that are blank or documentation-only (not CSS/code). */
export function isSkippableCommentLine(body: string): boolean {
  const trimmed = body.trim();
  if (trimmed.length === 0) return true;
  if (trimmed.startsWith("//")) return true;
  if (trimmed.startsWith("/*")) return true;
  if (trimmed === "*/" || trimmed.startsWith("*/")) return true;
  if (!trimmed.startsWith("*")) return false;

  // JSDoc middle lines are `* text` / lone `*`. CSS universal selectors look like
  // `* {…}`, `*.class`, `*#id`, `*:hover`, `*, div`, `*[attr]`, and combinators
  // `* + *`, `* > .x`, `* ~ *`. Markdown list/blockquote markers (`* + …`,
  // `* > Note`) stay documentation.
  const afterStar = trimmed.slice(1).trimStart();
  if (afterStar.length === 0) return true;
  if (afterStar.startsWith("/")) return true; // */
  // Unambiguous CSS after `*`.
  if (/^[{.,#:[]/.test(afterStar)) return false;
  // Combinators: only substantive when followed by a selector fragment.
  if (/^[+>~]/.test(afterStar)) {
    return !isCssSelectorAfterCombinator(afterStar.slice(1).trimStart());
  }
  return true;
}

function git(
  repoRoot: string,
  args: readonly string[],
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function assertGitObjectExists(repoRoot: string, sha: string, label: string): void {
  const result = git(repoRoot, ["cat-file", "-e", `${sha}^{commit}`]);
  if (result.status !== 0) {
    throw new Error(`${label} commit ${sha} is not present in this repository`);
  }
}

function assertAncestor(repoRoot: string, ancestor: string, descendant: string): void {
  const result = git(repoRoot, ["merge-base", "--is-ancestor", ancestor, descendant]);
  if (result.status !== 0) {
    throw new Error(
      `alias base commit ${ancestor} is not an ancestor of release commit ${descendant}`,
    );
  }
}

/**
 * Parse `git diff --name-status` stdout into every path involved, including
 * both sides of renames/copies so moves out of runtime trees stay visible.
 */
export function listChangedFilesFromNameStatus(stdout: string): string[] {
  const paths: string[] = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trimEnd();
    if (trimmed.length === 0) continue;
    // status\tpath  OR  R100\told\tnew  OR  C100\told\tnew
    const parts = trimmed.split("\t");
    if (parts.length < 2) continue;
    const status = parts[0] ?? "";
    if (status.startsWith("R") || status.startsWith("C")) {
      const from = parts[1];
      const to = parts[2];
      if (from !== undefined && from.length > 0) paths.push(from);
      if (to !== undefined && to.length > 0) paths.push(to);
      continue;
    }
    const path = parts[1];
    if (path !== undefined && path.length > 0) paths.push(path);
  }
  return [...new Set(paths)];
}

function listChangedFiles(repoRoot: string, base: string, head: string): string[] {
  // --name-status (not --name-only) so renames keep both source and destination.
  const result = git(repoRoot, ["diff", "--name-status", `${base}..${head}`]);
  if (result.status !== 0) {
    throw new Error(
      `git diff ${base}..${head} failed: ${result.stderr.trim() || result.stdout.trim()}`,
    );
  }
  return listChangedFilesFromNameStatus(result.stdout);
}

/** True when the unified diff has non-comment, non-blank added/removed lines. */
function hasSubstantiveDiff(repoRoot: string, base: string, head: string, path: string): boolean {
  const result = git(repoRoot, ["diff", `${base}..${head}`, "--", path]);
  if (result.status !== 0) {
    throw new Error(
      `git diff ${base}..${head} -- ${path} failed: ${result.stderr.trim() || result.stdout.trim()}`,
    );
  }
  return diffTextIsSubstantive(result.stdout);
}

export function packageVersionAtCommit(
  repoRoot: string,
  commit: string,
  packageJsonPath = "packages/svelte/package.json",
): string {
  const result = git(repoRoot, ["show", `${commit}:${packageJsonPath}`]);
  if (result.status !== 0) {
    throw new Error(
      `cannot read ${packageJsonPath} at ${commit}: ${result.stderr.trim() || result.stdout.trim()}`,
    );
  }
  const parsed = JSON.parse(result.stdout) as { version?: unknown };
  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new Error(`${packageJsonPath} at ${commit} has no version field`);
  }
  return parsed.version;
}

export function findSubstantiveRuntimePaths(
  repoRoot: string,
  base: string,
  head: string,
  paths: readonly string[] = listChangedFiles(repoRoot, base, head),
): string[] {
  return runtimeBehaviorPaths(paths).filter((path) =>
    hasSubstantiveDiff(repoRoot, base, head, path),
  );
}

export function auditAliasCommitRange(input: {
  repoRoot: string;
  baseCommit: string;
  releaseCommit: string;
  releaseVersion: string;
}): void {
  const { repoRoot, baseCommit, releaseCommit, releaseVersion } = input;
  assertGitObjectExists(repoRoot, baseCommit, "inherited tested");
  assertGitObjectExists(repoRoot, releaseCommit, "alias release");
  assertAncestor(repoRoot, baseCommit, releaseCommit);

  const versionAtTip = packageVersionAtCommit(repoRoot, releaseCommit);
  if (versionAtTip !== releaseVersion) {
    throw new Error(
      `alias release ${releaseVersion} points at commit ${releaseCommit} where @ggts-sh/svelte is ${versionAtTip}`,
    );
  }

  const offenders = findSubstantiveRuntimePaths(repoRoot, baseCommit, releaseCommit);
  if (offenders.length > 0) {
    throw new Error(
      `manual AT alias ${releaseCommit} changes runtime sources and requires a complete record: ${offenders.join(", ")}`,
    );
  }
}
