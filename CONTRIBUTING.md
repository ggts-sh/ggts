# Contributing to ggts

## Start in the right place

- Reproducible rendering, runtime, packaging, and grammar defects use the
  [bug form](https://github.com/ggts-sh/ggts/issues/new?template=bug.yml).
- Inspection, selection, zoom, keyboard, touch, focus, and assistive-technology
  problems use the
  [interaction and accessibility form](https://github.com/ggts-sh/ggts/issues/new?template=interaction-accessibility.yml).
- Scoped additions use the
  [feature form](https://github.com/ggts-sh/ggts/issues/new?template=feature.yml);
  explore early API and design ideas in
  [Ideas](https://github.com/ggts-sh/ggts/discussions/categories/ideas).
- Documentation gaps use the
  [documentation form](https://github.com/ggts-sh/ggts/issues/new?template=documentation.yml).
- Usage questions belong in
  [Q&A](https://github.com/ggts-sh/ggts/discussions/categories/q-a), and
  reusable examples belong in
  [Show and tell](https://github.com/ggts-sh/ggts/discussions/categories/show-and-tell).
- Suspected vulnerabilities must follow the [private security policy](SECURITY.md),
  not a public issue or Discussion.

The project has no guaranteed response times. See [SUPPORT.md](SUPPORT.md) for
tested support boundaries and what information helps the community respond.

## Setup

1. **bun** — the package manager, script runner, and unit-test runner.
   Pinned via `packageManager` in `package.json` and `mise.toml` (currently
   **bun 1.4.0**). Install with `mise install` or <https://bun.sh> →
   `~/.bun/bin/bun` must be on `PATH`.
2. **Install dependencies**: `bun install` (text lockfile `bun.lock`; CI uses
   `--frozen-lockfile`).
3. **uv + pre-commit + zizmor** (Python-side tooling):

   ```sh
   uv tool install pre-commit   # or pipx install pre-commit / brew install pre-commit
   uv tool install zizmor       # GitHub Actions security auditor (Rust, shipped via PyPI)
   pre-commit install           # installs the fast pre-commit hook only (no pre-push)
   ```

4. **Playwright browsers** (needed for component tests, the VR suite, and
   the retired browser spikes): `bunx --bun playwright install chromium firefox webkit`
   from the repo root (the root pins `@playwright/test` 1.61.1; all
   playwright pins share one browser cache).

`bun` must be on `PATH` when git hooks run — hooks invoke lockfile-installed
binaries via `bun`/`bun run`, never network `bunx`.

## The arm64/x64 machine quirk (read this if tools crash with MODULE_NOT_FOUND)

Some dev machines (notably this project's original one) run an **arm64 bun**
with an **x64 (Rosetta) node** at `/usr/local/bin/node`. bun installs
arm64-only native bindings (oxlint, oxfmt, tsgolint, rolldown/rollup, esbuild),
which x64 node cannot load — symptoms are `Cannot find module
'@oxlint/binding-darwin-x64'`-style errors or vitest dying on missing
`darwin-x64` bindings.

Rules that make this a non-issue:

- Always run tools through bun: `bun run <script>` (the repo's scripts already
  invoke binaries as `bun node_modules/.bin/<tool>`), and `bunx --bun vitest`
  (never bare `bunx vitest`).
- Where a tool spawns `node` itself (oxlint's type-aware mode spawning
  tsgolint), the script uses `bun run --bun`, which shims `node` → bun for
  child processes. Keep that pattern.
- Alternatively, install an arm64 node. CI containers are single-arch, so this
  is a local-only concern.

A second, distinct bun-runtime issue: oxfmt 0.58 routes `.svelte`/`.md`/`.yaml`
through embedded prettier plugins that throw `DataCloneError` under the bun
runtime (worker structured-clone incompatibility; fine under real node). Since
everything here runs under bun, those extensions are formatted by **prettier
directly** (see Formatting below). Re-test when bumping oxfmt or bun; if fixed
upstream, `.md`/`.yaml`/`.svelte` can fold back into oxfmt (`.oxfmtrc.json`
`"svelte": true` enables its prettier-plugin-svelte path).

## Tool roster and versions (verified working, July 2026)

| Tool                                         | Version                | Role                                                                               |
| -------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------- |
| bun                                          | 1.4.0 (pinned)         | PM / runner / unit tests                                                           |
| typescript                                   | 6.0.3                  | `tsc -b` project references (spec, core)                                           |
| oxlint                                       | 1.73.0                 | JS/TS linting (correctness+suspicious error, pedantic warn)                        |
| oxlint-tsgolint                              | 0.24.0                 | type-aware rules via `oxlint --type-aware` (no standalone CLI)                     |
| oxfmt                                        | 0.58.0                 | formatter for ts/js/json/jsonc/css/toml                                            |
| prettier + prettier-plugin-svelte            | 3.9.5 / 4.1.1          | formatter for .svelte/.md/.yaml (see quirk above)                                  |
| markdownlint-cli2                            | 0.23.0                 | markdown lint (pre-commit stage; config `.markdownlint-cli2.jsonc`)                |
| svelte-check                                 | 4.7.3                  | Svelte template + type checking (packages/svelte)                                  |
| knip                                         | 6.26.0                 | unused files/exports/deps (spikes ignored)                                         |
| publint / @arethetypeswrong/cli              | 0.3.21 / 0.18.5        | package publish shape (skips unbuilt stubs)                                        |
| actionlint (npm, wasm)                       | 2.0.6                  | workflow lint via `scripts/actionlint.ts` (no shellcheck integration — wasm build) |
| zizmor                                       | 1.26.1 (uv tool)       | Actions security audit                                                             |
| @changesets/cli                              | 3.0.1                  | versioning/release (spec+core+svelte+cli+skill fixed lockstep, access public)      |
| vitest + @vitest/browser-playwright          | 4.1.11                 | browser-mode component tests (factory `playwright()` provider)                     |
| playwright / @playwright/test                | 1.61.1 (exact pins)    | must match `ghcr.io/<repo>/ci-runner:v1.61.1-noble` — two-step bump (see below)    |
| @sveltejs/kit + @sveltejs/adapter-static     | 2.x / 3.x              | apps/docs static docs site (the VR screenshot target)                              |
| svelte / vite / @sveltejs/vite-plugin-svelte | 5.56.4 / 8.1.4 / 7.2.0 | spike + adapter toolchain                                                          |
| pre-commit                                   | 4.6.0                  | hook framework (both stages)                                                       |

## Dependency updates (Dependabot)

[`.github/dependabot.yml`](.github/dependabot.yml) opens weekly PRs for:

- **Bun** workspace manifests (root + packages/apps/examples/benchmarks/spikes)
  on Mondays — grouped so one dependency update lands across every `package.json`
  that lists it.
- **GitHub Actions** on Tuesdays — workflows plus local composites under
  `.github/actions/*` (Dependabot does not walk composites from `/` alone).
  Third-party actions are SHA-pinned (zizmor-enforced); bumps group by action
  name across every pin site.

Dependabot does **not** auto-bump these (human-authored locksteps / release flow):

- `playwright` / `@playwright/test` — exact pins must match
  `support-matrix.json` `browsers.playwright` and the consumer
  `ghcr.io/<repo>/ci-runner:v…-noble` tag (asserted in
  `scripts/support-matrix.test.ts`). Bump via the two-step procedure below —
  never as a Dependabot PR.
- `pnpm` — root pin must match `support-matrix.json` `packageManagers.pnpm`
  (asserted in `scripts/support-matrix.test.ts`).
- `@ggts-sh/*` — internal publish ranges are owned by Changesets, not registry
  bumps from Dependabot.

Majors for `svelte`, `vite`, `@sveltejs/*`, `typescript`, and `vitest` are also
ignored — land those as deliberate migrations.

### Bumping Playwright / the CI runner image

Container jobs pull `ghcr.io/<owner>/<repo>/ci-runner:<tag>` (Playwright +
`unzip`), published **only** by [`.github/workflows/build-ci-image.yml`](.github/workflows/build-ci-image.yml)
on pushes to `main` that touch the Dockerfile or that workflow. There is
intentionally **no** `workflow_dispatch`: a dispatchable workflow can run an
unreviewed branch's copy with `packages: write` and overwrite the published
tag with a poisoned image. On-demand rebuilds re-run the last successful main
run from the Actions UI, or push a no-op change to the Dockerfile / publisher
workflow.

A single PR that bumps **consumers and publisher together deadlocks**:
`scripts/support-matrix.test.ts` used to force them equal, so the PR would
point container jobs at `ci-runner:<new-tag>` before main could publish that
tag. Use a **two-step** bump (issue
[#610](https://github.com/ggts-sh/ggts/issues/610)):

**Step 1 — prepublish the image** (publisher may _lead_ consumers):

1. Bump `PLAYWRIGHT_TAG` in `.github/workflows/build-ci-image.yml`.
2. Bump `ARG PLAYWRIGHT_TAG` default in `.github/docker/ci-runner/Dockerfile`
   to the same value.
3. Do **not** change `support-matrix.json`, package pins, or consumer workflow
   tags (`PLAYWRIGHT_CONTAINER_TAG` / hardcoded `ci-runner:` image lines).
4. Merge to `main`; wait for the `build CI image` workflow to publish
   `ghcr.io/<owner>/<repo>/ci-runner:<new-tag>`.
5. Verify the tag exists (Actions run green, or
   `docker manifest inspect ghcr.io/ggts-sh/ggts/ci-runner:vX.Y.Z-noble`).

**Step 2 — consume the published tag**:

1. Bump `support-matrix.json` `browsers.playwright`.
2. Bump root `@playwright/test`, `packages/svelte` `playwright`, and
   `spikes/browser` `playwright` to the same version; run `bun install`.
3. Bump `PLAYWRIGHT_CONTAINER_TAG` in `.github/workflows/ci.yml` and every
   hardcoded `ci-runner:v…-noble` image line (`ci.yml`, `vr-compare.yml`,
   `bench.yml`).
4. Update any hardcoded version strings in
   `scripts/release-wiring.test.ts` (and similar) if present.
5. Merge once container jobs pull the prepublished image successfully.

**Steady state:** publisher tag == consumer tag == matrix. Between step 1 and
step 2 the publisher may be **ahead**; it must never lag (consumers would pull
a tag main never publishes). The lockstep test encodes that inequality.

## Running the checks

| Command                                                       | What it does                                                                                                                                                           |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run check`                                               | `tsc -b` project references (packages/spec, packages/core) — EMITS `dist/` since M0c                                                                                   |
| `bun run build`                                               | `bun run check` + `svelte-package` for packages/svelte (everything the publish shape needs)                                                                            |
| `bun run check:svelte`                                        | svelte-check `--fail-on-warnings` in packages/svelte (needs `bun run check` first: dist types)                                                                         |
| `bun run lint`                                                | oxlint over the repo (`.oxlintrc.json`; spikes excluded)                                                                                                               |
| `bun run lint:md`                                             | markdownlint-cli2 over `**/*.md` (`.markdownlint-cli2.jsonc`; spikes + node_modules ignored)                                                                           |
| `bun run lint:type-aware`                                     | oxlint `--type-aware --deny-warnings` (tsgolint; permanent CI gate)                                                                                                    |
| `bun run fmt` / `bun run fmt:check`                           | oxfmt (ts/js/json/css/toml) + prettier (.svelte/.md/.yaml)                                                                                                             |
| `bun run test`                                                | bun unit tests (spec + core + scripts + evals harness; needs `bun run check` first)                                                                                    |
| `bun run test:temporal-parser`                                | focused strict-parser, schema/helper, Date.parse gate, and parsed-column cache loop                                                                                    |
| `bun run test:temporal-pipeline`                              | focused temporal pipeline and calendar-tick loop                                                                                                                       |
| `bun run test:components`                                     | packages/svelte component tests (Chromium, Firefox, WebKit) followed by the Node SSR suite                                                                             |
| `cd packages/svelte && bun run test:coverage`                 | browser (chromium) + SSR coverage reports; browser config enforces thresholds; CI runs the same chromium+ssr coverage and uploads lcov to Codecov                      |
| `bun run check:examples`                                      | tsc over the examples corpus's .ts files (needs `bun run check` first: dist types)                                                                                     |
| `bun run check:docs`                                          | svelte-kit sync + svelte-check for apps/docs (needs `bun run build` first)                                                                                             |
| `bun run build:docs`                                          | static docs site → `apps/docs/build/` (needs `bun run build` first; the VR target)                                                                                     |
| `bun run manifest:gen` / `bun run manifest:check`             | (re)generate / staleness-check `examples/manifest.ts` from the corpus                                                                                                  |
| `bun run test:visual`                                         | Playwright VR suite against `apps/docs/build` (see the VR workflow section)                                                                                            |
| `bun run schema:emit`                                         | regenerate `packages/spec/schema/v0.json` (staleness-guarded by a spec test)                                                                                           |
| `bun run lifecycle:gen` / `bun run lifecycle:check`           | (re)generate / staleness-check `lifecycle.json` from the index-file lifecycle tags                                                                                     |
| `bun run validator:gen` / `bun run validator:check`           | (re)generate / staleness-check `packages/spec/src/generated/plot-spec-validator.ts` (precompiled PlotSpecSchema validator; regenerate after schema or TypeBox changes) |
| `bun run scale:children:gen` / `bun run scale:children:check` | (re)generate / staleness-check `<Scale*>` shells + the index region from the scale-children manifest (#659)                                                            |
| `bun run builder:scales:gen` / `bun run builder:scales:check` | (re)generate / staleness-check `packages/spec/src/builder-scales.ts` from SCALE_CAPABILITIES (#1081)                                                                   |
| `bun run builder:geoms:gen` / `bun run builder:geoms:check`   | (re)generate / staleness-check `packages/spec/src/builder-geoms.ts` from KNOWN_GEOMS (#1081)                                                                           |
| `bun run geom:children:gen` / `bun run geom:children:check`   | (re)generate / staleness-check `<Geom*>` shells + the index region from KNOWN_GEOMS + *LayerInput (#1039)                                                              |
| `bun run evals`                                               | held-out NL→spec eval harness (tests/evals; OpenRouter API, model via EVAL_MODEL; dry-run with a mock model without OPENROUTER_API_KEY)                                |
| `bun run bench:json`                                          | run the named workloads once, write `bench-results.json` (github-action-benchmark format)                                                                              |
| `bun run bench:budgets`                                       | compare `bench-results.json` against `benchmarks/budgets.json` (provisional budgets, +50%)                                                                             |
| `bun run bench:memory` / `bun run bench:memory:check`         | capture the forced-GC retained-memory sample / enforce `benchmarks/memory-baselines.json`                                                                              |
| `bun run bench` / `bun run bench:smoke`                       | mitata pipeline+renderer benchmarks (full / 1k CI smoke)                                                                                                               |
| `bun packages/cli/bin/ggts.js render`                         | the `ggts render` CLI (spec JSON -> SVG on stdout; JSON-line diagnostics on stderr)                                                                                    |
| `Rscript packages/core/tests/fixtures/*/generate.R`           | regenerate the ggplot2-parity fixtures (grouping, stats/positions; needs R + ggplot2)                                                                                  |
| `bun run knip`                                                | unused files/exports/dependencies                                                                                                                                      |
| `bun run lint:package`                                        | publint + attw (esm-only profile) over built packages — build first                                                                                                    |
| `bun run lint:actions`                                        | actionlint (wasm) over `.github/workflows` (local soft-skip if wasm cannot load; fatal in CI actions-security job)                                                     |
| `bun run lint:actions:security`                               | zizmor over `.github/workflows` (needs `uv tool install zizmor`; CI runs it in actions-security)                                                                       |
| `bun run test:spikes`                                         | retired M0a browser/ssr spike suites (vitest 4 browser mode)                                                                                                           |
| `cd spikes/pure && bun test`                                  | retired M0a pure spike suites                                                                                                                                          |
| `pre-commit run --all-files`                                  | fast staged-file parity (oxfmt/prettier/oxlint/markdownlint/manifest/path guards)                                                                                      |

CI (`.github/workflows/ci.yml`) runs a `checks` job for pre-commit parity
plus unit / component / build / actions-security / bench-smoke jobs.
**CI is the contract.** Local git hooks are commit-only and sub-second;
there is no pre-push mega-suite (build, type-aware lint, svelte-check, knip,
package tests all live in CI). If an old clone still has a pre-push hook,
remove it with `pre-commit uninstall -t pre-push` then `pre-commit install`.

### Path routing + content-hash skip

Path routing (`scripts/ci-routing.ts`) schedules jobs from the changed-file
set. Content-hash skip (issue #245) is a second layer: when a job is still
scheduled, it may early-exit success if a validated success marker (or
`packages-dist` cache) exists for the same **physical execution identity**
(content hash of `JOB_CONTENT_INPUTS` + recipe files including `ci.yml` and
`.github/actions/**`).

The success-marker protocol is implemented once in local composite actions
(`.github/actions/ci-content-hash-restore`, `ci-content-hash-write`); `ci.yml`
jobs call those instead of pasting the steps. The `packages-dist` producer keeps
its specialized dist-payload cache path.

| Control                                                    | Effect                                         |
| ---------------------------------------------------------- | ---------------------------------------------- |
| Change any path in that execution’s `JOB_CONTENT_INPUTS`   | New hash → cache miss → full run               |
| Expand/edit `JOB_CONTENT_INPUTS` patterns                  | Patterns are inside the digest → miss          |
| Bump `CONTENT_HASH_SCHEMA` in `scripts/ci-routing.ts`      | Global bust of all content-hash caches         |
| force-all, lockfile, `ci.yml`, `ci-routing`, or composites | `bypass_content_cache=true` → no short-circuit |
| Repo variable `CI_DISABLE_CONTENT_HASH=1`                  | Disable short-circuit for all jobs             |

Hashes are fail-closed (missing digests abort). Component shards and each
consumer matrix cell have distinct cache keys. GHA cache is ref-scoped —
treat reuse as best-effort for re-runs / default-branch restore, not a
guaranteed cross-PR registry. Exact keys only (no `restore-keys` fallback
for job markers).

## packages/svelte layout and coverage

### `src/lib` map

The Svelte package is organized by feature under `packages/svelte/src/lib/`:

| Directory / file        | Role                                                                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `geoms/`                | Declaration-only geom children (`GeomPoint`, …) and the geom factory/registry                                                                            |
| `assembly/`             | Labels, layout helpers, chrome-adjacent pure assembly                                                                                                    |
| `runtime/`              | Runtime paint, announcer, semantic-key services                                                                                                          |
| `scene/`                | SVG scene tree (`SceneView`, `Batch`, axes, legends paint, strata)                                                                                       |
| `a11y/`                 | Canvas-stratum accessibility surface + row materialization                                                                                               |
| `interaction/`          | Tools, reducer, capability, controller, shared InteractionContext + the interaction-states assembly                                                      |
| `surface/`              | Capture surface controller (pointer/keyboard/brush)                                                                                                      |
| `inspection/`           | Tooltip, inspection coordinator/resolver, inspection state                                                                                               |
| `selection/`            | Point-selection state                                                                                                                                    |
| `interval/`             | Interval selection, bounds editor, query                                                                                                                 |
| `zoom/`                 | Brush-zoom state                                                                                                                                         |
| `legend/`               | Legend filter/focus controllers, targets, pure surface helpers                                                                                           |
| `chrome/`               | Tool rail, status chrome, theme CSS, chrome state                                                                                                        |
| `fonts/`                | Packaged font assets (not TypeScript sources)                                                                                                            |
| `GGPlot.svelte`         | Public component shell                                                                                                                                   |
| `plot-engine.svelte.ts` | Host wiring: builds the InteractionContext, delegates controller construction to the interaction-states assembly, owns host-level deriveds + diagnostics |
| `plot-props.ts`         | GGPlot's **internal** props contract + engine resolve helpers (`resolveCapabilities`, `widenPlotProps`) — not re-exported from `index.ts`                |
| `index.ts`              | The **only** public package entry                                                                                                                        |

### No per-directory barrels

Feature directories do **not** ship `index.ts` re-export barrels. Imports use
direct relative specifiers with extensions
(e.g. `../inspection/resolver.js`). Rationale: knip can flag dead exports
without barrel noise; the published `dist/` shape stays flat and intentional;
and hub-style barrels invite import cycles across feature controllers.

### Tests mirror `src`

- Feature suites live under `packages/svelte/tests/<feature>/` and track
  `src/lib/<feature>/` (e.g. `tests/surface/` ↔ `src/lib/surface/`).
- Cross-cutting suites (`component.test.ts`, harnesses, release matrix) sit
  at `packages/svelte/tests/` root.
- Shared helpers and fixtures: `tests/helpers/`, `tests/fixtures/`.
- Prefer `@total-typescript/shoehorn` for partial test fixtures instead of `as`
  / `as unknown as` / `as never` on object literals:
  - `fromPartial({ ... })` when the shape is a valid deep-partial of the target type
  - `fromAny({ ... })` when the data is intentionally wrong or untyped for the test
  - Keep `as const`, error/DOM narrowing, and post-pipeline batch narrowing as-is

### Coverage workflow

```sh
cd packages/svelte && bun run test:coverage
```

That runs:

1. **Browser** coverage (`vitest --coverage --project chromium`) →
   `packages/svelte/coverage/browser/`. Thresholds live in
   `vitest.config.ts` (after the `coverageBase` spread): statements 90,
   branches 80, functions 90, lines 90. They ratchet against regression on
   the mature browser report; they are **not** in `coverageBase` so the SSR
   config stays threshold-free.
2. **SSR** coverage (`vitest.ssr.config.ts`) →
   `packages/svelte/coverage/ssr/`. Numbers are structurally lower (SSR
   paths only) — do not chase SSR-report gaps or put thresholds there.

CI (`.github/workflows/ci.yml`) runs chromium browser coverage on the
`component-svelte` job (parallel with coverage-free `component-svelte-fx` for
firefox + webkit) and unit-suite coverage (`bun test --coverage`) on the
`unit` job, then uploads lcov to Codecov via `codecov/codecov-action` (flags
`unit` / `svelte`, path components for package badges). SSR coverage is **not**
collected in CI: `@vitest/coverage-v8` needs Node inspector Coverage APIs that
bun does not implement; use local `test:coverage` (under node) if you need the
SSR report. Content-hash skips omit uploads; Codecov carryforward keeps flag
totals stable. `fail_ci_if_error: true` on the upload steps — set
`CODECOV_TOKEN` in repo secrets. Package badges live in the package READMEs
(`component=packages-spec|packages-core|packages-svelte`); the monorepo root
badge is overall project coverage.

## Formatting policy

- **oxfmt** owns `.ts .tsx .js .jsx .mjs .cjs .json .jsonc .css .toml`.
- **prettier (+prettier-plugin-svelte)** owns `.svelte .md .yml .yaml` —
  fallback per the plan after verifying oxfmt 0.58: it _does_ format `.svelte`
  (via its embedded prettier-plugin-svelte, config `"svelte": true`, verified
  idempotent on the spike components under node) but its embedded-prettier
  worker path crashes under the bun runtime, which this repo standardizes on.
- `spikes/**` is excluded from both formatters, from oxlint, and from knip:
  spike code is retired M0a evidence — still runnable, no longer groomed. The
  spike `.svelte` files were one-time formatted with prettier during the M0b
  verification (all 41 spike tests still pass).

## Guards

- The oxlint config bans `Math.random` / `Date.now` inside `examples/**`
  (visual-regression determinism) — use the seeded `mulberry32` helper in
  `examples/rng.ts` instead.
- The `manifest-current` hook runs `bun run manifest:check` whenever staged
  files touch `examples/`: `examples/manifest.ts` is GENERATED from the
  corpus — regenerate with `bun run manifest:gen`, never hand-edit.
- The `block-output-paths` hook refuses commits touching `test-results/`,
  `playwright-report/`, `.vitest-attachments/`, or `__screenshots__/` paths.
  VR baselines land only via the `vr-approve` workflow; if you must commit
  baselines locally, `SKIP=block-output-paths git commit …` and say why in the
  PR.
- The `max-loc` hook enforces a hard 500-line limit on hand-written code
  (`*.ts|tsx|js|mjs|cjs|svelte`, `spikes/` excluded; physical lines, comments
  and blanks included). Files whose header declares them generated
  (`generat` + `do not edit` in the first 5 lines) are exempt. Legacy oversize
  files are pinned in `scripts/guards/max-loc-exclusions.txt` as a ratchet:
  a pinned file may not grow past its recorded baseline, entries whose file
  shrank under the limit or was deleted must be pruned, and the list may only
  ever shrink — refactor the file instead of raising a baseline.
  Full-tree audit: `scripts/guards/max-loc.sh --all`; tests:
  `bun test scripts/max-loc.test.ts`.

## Package READMEs (npm front doors)

Each `packages/*/README.md` is what npmjs.com shows for that package. Keep it
short, package-specific, and correct — not a second docs site.

- **One working example** for the package’s primary use case. Absolute URLs only
  (no `../other-package` monorepo links — they 404 on npm).
- **Do not restate full contracts** (scales, guides, deprecation calendars) in
  the package README; link to [ggts.sh](https://ggts.sh/) instead. Long
  contract dumps are what drifts.
- **Guards:** `scripts/package-readme.test.ts` runs TypeScript fences for
  `@ggts-sh/spec` and `@ggts-sh/core`, bans monorepo-relative links, and
  blocks removed grammar-prop examples in `@ggts-sh/svelte`. The root README
  stays short and links out to ggts.sh (no embedded gallery or theme
  grids) — enforced by `scripts/readme-showcase.test.ts`.
- **Ship with a patch** when the example or install path changes — package
  README is a shipped surface for `scripts/changeset-check.ts` even though
  npm packs it outside the `files` field.

When a public API change invalidates a package README snippet, update the
README in the same PR as the code.

## Examples corpus (one source, three uses)

`examples/<category>/<name>/` is the shared corpus feeding (1) the docs
gallery + per-example pages, (2) the VR matrix, and (3) `llms-full.txt` (M3).
Authoring a new example:

1. Create the directory with the four files:
   - **`spec.ts`** — `export default defineExample(gg(...)....spec())`
     (import `defineExample` from `../../define.js`). The default export is
     the canonical `PortableSpec`; it is validated at tier 2 on import, and
     its JSON is the docs "Spec" tab.
   - **`Example.svelte`** — idiomatic component usage (`<GGPlot ...>` with
     `<GeomX>` children), importing data from `./data.js`. Default: pin
     `width={640} height={400}` (or `height={vrHeight}` if you set one) so
     VR captures at a fixed size. **Exception — `journey.fullWidth`:** the
     docs frame drops max-width and the gallery PNG fills the content
     column, so live plots must use `width="container"` (or omit width)
     rather than a fixed pixel width — otherwise first hover snaps the
     chart from a stretched static preview down to that fixed size. VR
     still pins the outer frame to `vrWidth`×`vrHeight` from `meta.json`,
     so container mode measures that size under `?vr`. Package README and
     docs snippets omit width/height; user code should too — omitted width
     is container-responsive, omitted height is 400.
   - **`meta.json`** — `{ title, description, tags, docsSection, vrHeight? }`
     (validated by the generator; `docsSection` groups the gallery).
   - **`data.ts`** (optional) — static rows or `mulberry32`-seeded
     generation only. `Math.random`/`Date.now` are lint-banned here.
2. `bun run manifest:gen` (the `manifest-current` hook enforces freshness).
3. `bun run check:examples && bun run build:docs` to see it typed and built;
   the VR matrix picks it up automatically (examples × light/dark).
4. Keep spec.ts and Example.svelte semantically identical — they are two
   surfaces of the same plot (the docs triptych shows both plus the JSON).

## Visual-regression workflow

Enforced VR is a **smoke suite** (`tests/visual/smoke-matrix.ts` +
`vr.spec.ts`, ~15–18 shots including ≥2 dark). It screenshots the BUILT docs
site: example pages support `?vr&theme=light|dark`, which strips chrome,
freezes animations, and pins `.gg-example-frame`. Full dual-theme × every
example is intentionally gone. Gallery lights live under
`apps/docs/static/previews/` with a capture-owned `provenance.json` that
binds each PNG to a digest of that example's source tree (#746). After
editing an example's sources, recapture then regenerate:

```sh
bun run build && bun run build:docs
bun scripts/serve-docs.ts &
bun run gallery:previews:capture          # or pass an id-prefix subset
bun run gallery:previews:gen
```

`gallery:previews:check` (docs build/check, and CI when `examples/**`
changes) fails when sources move without a recapture — not only when a
PNG is missing. Gen never restamps source/png digests (capture does);
it only prunes provenance entries for deleted examples, same as orphan
PNGs. Non-pixel docs structure/a11y runs in `component-journeys`
(docs_journeys routing). Determinism + fonts: docs/decisions/0009.

- **Smoke baselines** land in `tests/visual/__screenshots__/` from the pinned
  container. Prefer **same-PR** updates: change render-relevant code + smoke
  PNGs together. Baseline-only PRs are rejected by `vr-baseline-guard`.
- **Local runs use a throwaway snapshot dir** (macOS fonts ≠ container fonts):

  ```sh
  bun run build && bun run build:docs
  VR_SNAPSHOT_DIR=.local-baselines bun run test:visual:smoke -- --update-snapshots
  VR_SNAPSHOT_DIR=.local-baselines bun run test:visual:smoke
  ```

  `.local-baselines/` is gitignored. `maxDiffPixels` is 0 and `retries` 0 —
  a diff is a real change, never flake to retry away.

## Visual-regression trust model

`vr-compare.yml` is the only workflow that executes **unmerged** PR code. It
has no secrets or write permissions, renders in the pinned container, and
uploads inert PNG candidates. After source lands, `vr-approve.yml` independently
verifies the comment, permission, default-branch merge, timestamp, and immutable
`merge_commit_sha`. It checks out only that already-merged base-repository
commit, verifies the PNG artifact, and runs the matching preview generator
without `GH_TOKEN` in its environment. Every step that holds the write
credential is script-free (`gh`/`git` only): the commit/push and the
`gh pr create` that opens the baseline PR.

### Pixel changes land with their own baselines (issue #742)

`vr-gate (required pixel aggregator)` is a **required status check**. A PR whose
rendering changed cannot merge until the comparison is green against baselines
committed in that same PR:

1. The compare job goes red and uploads a `vr-baselines` artifact containing the
   candidate PNGs the pinned container just rendered.
2. Inspect the diff in the `vr-playwright-report` artifact. If the change is
   intentional, download `vr-baselines`, copy its `__screenshots__/*.png` over
   `tests/visual/__screenshots__/`, and commit them alongside the source change.
   `vr-baseline-guard` allows exactly this pairing.
3. The compare re-runs on the new head and must go green. That is the point:
   a green required compare _proves_ the committed PNGs are byte-identical to
   the pinned container's render of that commit (`maxDiffPixels` is 0), so a
   hand-edited or partial baseline cannot land.

Until this gate existed, VR Compare was advisory and the source-first
`/approve-visuals` order below was the normal path. That order let an example
merge ahead of its baseline (#732), and every later PR then inherited a red
comparison it had not caused. Same-PR landing removes the window entirely.

`/approve-visuals` remains for the two cases same-PR landing cannot serve:

- **Bootstrap** — `tests/visual/__screenshots__/` is empty, so there is nothing
  to compare and the compare job generates candidates instead.
- **Repair** — baselines on the default branch are already stale (a pixel change
  that merged before this gate, or a rendering change reaching an example whose
  own PR did not touch it).

For those, comment `/approve-visuals` on a **merged** PR (a pre-merge command is
rejected, including one recorded in the same second as the merge), then review
and merge the generated `vr-update/pr-<n>` PR — **close and reopen it once** so
the required checks run, since GitHub starts no workflow runs for pull requests
opened by the Actions token.

Never merge an unexplained visual diff.

Idempotency keys on the **open PR**, not the branch (issue #717): re-running
`/approve-visuals` while the baseline PR is open is a no-op, but a
`vr-update/pr-<n>` branch that already carries the right render and has no open
PR gets one opened rather than a silent skip. The three-way decision
(skip / open the PR / render, push, open the PR) lives in
`scripts/vr-approve-decision.ts` and is unit-tested.

## Changesets (when to add one)

Add a `.changeset/*.md` **only** when the PR changes an npm-published package
surface — the same paths `scripts/changeset-check.ts` treats as shipped
(`package.json`, `README.md`, `LICENSE`, that package’s npm `files` entries
under `packages/{cli,core,skill,spec,svelte}`, and — for packages that publish
compiled `dist` without listing `src` — the package’s `src/` tree that builds
into `dist`, e.g. `packages/svelte/src/**`). Spec, core, svelte, cli, and skill
version in **fixed lockstep**, so one real (or spurious) changeset advances all
five package versions.

**Do not** add a changeset for docs site, examples, scripts, tests, CI, or
guide content alone (`apps/docs/**`, `examples/**`, `scripts/quickstart/**`,
lesson SVGs, gallery previews, VR baselines, …). Those PRs must not bump
packages. The Changeset check workflow fails with verdict `unwarranted` if they
do. The agent skill under `packages/skill/` _does_ ship and may
warrant a patch. Missing changesets on package code stay advisory only.

### Bump level (SemVer)

Pick the level from the **public surface change**, not from how small the
diff looks. Spec, core, svelte, cli, and skill share one version, so the highest
level among pending changesets wins.

| Level     | Use for                                                                                                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **major** | Breaking change after 1.0 (pre-1.0, breakings ride **minor** — ADR 0013).                                                                                                          |
| **minor** | Additive public surface: new theme or scheme names, new exports, new props/options, new geom/stat/scale helpers, new Svelte shells, schema enum widenings. Also pre-1.0 breakings. |
| **patch** | Bug fixes, performance, internal refactors, docs-in-package, skill text, and “dead API now works” repairs that do not add names.                                                   |

`feat` in the commit subject is a signal you almost certainly want **minor**,
not patch. A changeset that says `Migration: none — additive` must bump
**minor** (or major) — `scripts/deprecation-wiring.test.ts` enforces that.
Internal-only work should say so (`Migration: none — internal …`) and stay
patch.

## Lifecycle policy (Hadley lesson 13)

Every public export of `@ggts-sh/spec`, `@ggts-sh/core` (both entries), and
`@ggts-sh/svelte` carries a lifecycle tag, annotated in the package index files
(file default `// @lifecycle-default`, statement-level one-line
`@lifecycle` JSDoc markers, per-name trailing `// @lifecycle` comments) and
collected into the generated `lifecycle.json` (`bun run lifecycle:gen`;
staleness-tested). The docs lifecycle page and llms surfaces render from it.

- **experimental** — may change or disappear in any 0.x release without
  ceremony. The default for everything not explicitly promoted.
- **stable-intent** — committed enough that changes pay the migration tax.
  Two independent reasons to tag a surface (either is enough):
  1. **Agent core path** — `PortableSpec`, `normalize`, `validate`
     (+ `ValidateResult`/`SpecError` contracts), `renderToSVGString`,
     `GGPlot`.
  2. **Recommended Svelte composition children** — declaration-only
     `Geom*` shells and the grammar children from #659 (theme / scale /
     coord / facet / labs / guides / legend). Registry and factory helpers
     stay experimental.
     Not frozen pre-1.0, but changes are treated as breaking: they get a
     changeset with a `Migration:` marker, an upgrading-guide section, and a
     deprecation window of at least one full minor release. The precise rules
     (windows, fixtures, runtime checks, codemod bar) are decision 0013
     (`docs/decisions/0013-post-0-1-migration-policy.md`).
     Promote when the surface is on the recommended public path, its contract
     is tested, and you accept that tax — not by calendar age alone, and not
     only because a live docs `/qa` pass looked fine.
- **stable** — committed API under semver. Nothing is `stable` pre-1.0.
- **superseded** — keeps working but stops being recommended; docs point at
  the replacement. This tag exists to protect agent-generated code from
  silent breakage (superseded surfaces are removed only at a major).

Related: `normalize()` stamps the current defaults edition (`edition: 2`) on
every unstamped spec (defaults-edition mechanism, decision 0012) — default aesthetics are keyed by edition in
`@ggts-sh/core`'s `EDITION_DEFAULTS`, so improving defaults later never
restyles existing specs.

## No time estimates

Milestones are dependency-ordered scopes, never durations. **No time units
appear in issues, PRs, plans, or docs** — don't add "this should take a day"
to anything.

## Decision records

Significant, hard-to-reverse choices get a record in `docs/decisions/`
(`NNNN-title.md`, sequential). Records are written at decision time, state
status/date/verdict, the evidence (spikes reference their code + test runs),
and what later milestones must know. The six M0a records are the template.

## Milestone context (M0c — walking skeleton)

The packages are real since M0c and their exports point at **built `dist/`**
output (`bun run check` emits spec/core; `bun run build` adds svelte-package).
Consequences:

- Run `bun run check` after a fresh clone before `bun run test`,
  `check:svelte`, or `lint:type-aware` — cross-package imports resolve
  through `dist/`. CI jobs already sequence this.
- `@ggts-sh/spec`: TypeBox schemas (decision 0004) + `Static<>` types,
  `normalize()`, tier-1 `validate()` with the agent error contract, the
  `gg()/aes()` builder, portability (`isPortable`/`toPortable`/
  `toPortableLossy`), and the JSON Schema artifact `schema/v0.json`
  (generated — `bun run schema:emit`; oxfmt-ignored; staleness-tested).
- `@ggts-sh/core` (pure entry): ColumnTable, grouping (decision 0005),
  value-stable scale state (decision 0002), two-pass layout (decision 0003),
  `runPipeline()`, `renderToSVGString()`. No DOM globals — enforced by the
  Node smoke test. `/dom` stays a stub until M2 canvas work.
- `@ggts-sh/svelte`: props-first `<GGPlot>`, declaration-only `<GeomPoint>`/
  `<GeomLine>` sugar (decision 0001, mechanism A), vitest-4 browser-mode
  component tests (`bun run test:components`).
- Benchmarks live in `benchmarks/` (mitata; `bench-smoke` CI job runs the 1k
  workload). Graduation notes, d3 choices, and deviations: decision 0007.

## Milestone context (M1)

M1 added 7 geoms / stacks / scales / legends / themes / CLI (decision 0008)
plus the VR-and-examples workstream (decision 0009): the `examples/` corpus
and generated `examples/manifest.ts`, the `apps/docs` SvelteKit +
adapter-static site, `<GGPlot>`'s `data-gg-ready` readiness signal, the
`tests/visual` Playwright suite, and a real (un-guarded) `vr-compare.yml`.
CI consequence: build jobs run **package-build** (`bun run build`, not just
`tsc -b`) before docs/examples checks because those imports resolve through
the built `@ggts-sh/svelte` package.

## Milestone context (M2 — statistical layer)

The statistical half of M2 (decision 0010) added stats bin / smooth
(lm + loess) / boxplot / density / summary, the histogram alias
(canonicalized to bar + stat bin), the smooth ribbon / boxplot composite /
density area / errorbar geometry, and SEEDED jitter + nudge positions
(`positionParams`; jitter determinism is a documented divergence from
ggplot2). R-parity fixtures live in `packages/core/tests/fixtures/stats/`
(`generate.R` needs R + ggplot2 4.0.3); the achieved numeric tolerances are
recorded in decision 0010 — loess matches R's `surface = "direct",
statistics = "exact"` path to float noise, and the fixture tolerances
quantify the gap to ggplot2's default interpolated loess. Every stat's
module header documents its generated columns (`STAT_COLUMNS` in
@ggts-sh/spec is the `{ stat }` channel contract) and its missing-value
policy. Loess attribution: see the repo NOTICE file.

## Milestone context (M2 — facets, coord flip, canvas strata, interaction)

The interaction half of M2 (decision 0011) added `facet` (wrap + grid,
fixed/free scales — partition runs BEFORE stats), `coord: {type: "flip"}`
(the single orientation mechanism), per-layer `render` backends with canvas
strata (spike 0006 graduated; `@ggts-sh/core/dom` is real now: canvas batch
renderers + the unified hit index), hover/tooltip/brush/brush-to-zoom in
`<GGPlot>`, `width="container"`, `RenderModel.dispose()`, and the a11y pass
(focusable SVG marks, canvas description block + data-table toggle,
`a11y: "force-svg"`). Facet/flip R fixtures live in
`packages/core/tests/fixtures/facets/` (`generate.R`). Both renderers now
clip marks to panel rects. Scene panels carry per-panel axes/grid/strips;
batches carry `panelIndex`. Interactions are component-tested, never
VR-screenshotted (`?vr` pages render static).

## Milestone context (M3 — agent affordances + hardening)

M3 (decision 0012) added: the audited error catalogs (`ERROR_CATALOG` in
spec; `PIPELINE_ERROR_CATALOG`/`PIPELINE_WARNING_CATALOG`/`ADVISORY_CATALOG`/
`CLI_DIAGNOSTIC_CATALOG` in core — completeness enforced by tests that scan
the sources); `lintSpec()` spec-lint advisories (wired into
`validate(spec, { lint: true })` and the CLI); lifecycle tags + generated
`lifecycle.json`; defaults editions (`spec.edition`, stamped by normalize);
the docs guide pages GENERATED from those catalogs (`scripts/gen-llms.ts` is
the one source for guide markdown, `/llms.txt`, and `/llms-full.txt` — the
docs pages and llms endpoints cannot drift from the code); `/schema/v0.json`
served from the docs build; the agent skill published as `@ggts-sh/skill`
(`packages/skill/`, inventory completeness enforced by skill-content tests); the held-out eval harness (`tests/evals/`,
44 cases, dry-run mock without a key); benchmark budgets
(`benchmarks/budgets.json`, provisional) + `bench:json`/`bench:budgets`;
the completed VR approval flow (`/approve-visuals` comment gate,
vr-approve verification, `vr-baseline-guard` in CI); `release.yml`
(changesets + npm trusted publishing, OIDC, no tokens); `evals.yml` and
`bench.yml` workflows; READMEs, LICENSE, and package publish metadata.
