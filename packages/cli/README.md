# @ggsvelte/cli

[![codecov](https://codecov.io/gh/ljodea/ggsvelte/branch/main/graph/badge.svg?component=packages-cli)](https://app.codecov.io/gh/ljodea/ggsvelte/tree/main/packages%2Fcli)

`ggts check` and `ggts render`: validate and render a ggsvelte plot spec (JSON) to SVG from
the command line. This is the feedback loop for agents that author specs — it
surfaces the validation errors, warnings, and advisories a JSON-only workflow
never sees.

## Why this package exists

An embedded analytics agent writes a spec, the host webapp renders it with
`@ggsvelte/react` or `@ggsvelte/svelte`. Without this CLI in the agent's sandbox, the agent ships
the spec blind: a spec can be schema-valid yet draw a misleading chart, and
the pipeline's warnings (degenerate stacks, single-observation groups, scale
inference problems) fire in the webapp where nobody reads them. With the CLI,
the agent renders locally, reads the JSONL diagnostics on stderr, and fixes
the spec before anyone sees it.

If you embed spec-writing agents, treat this package as part of the install
contract, not an option.

## What the CLI covers (and what it does not)

| Covered on every render                         | Opt-in / host-side                                    |
| ----------------------------------------------- | ----------------------------------------------------- |
| Schema validation (`validate`)                  | Host inspect **mode** and most interaction wiring     |
| Pipeline warnings and advisories                | Runtime key/lineage errors (need a live plot)         |
| Scale-inference diagnostics (`source: "scale"`) | Composition/deprecation `ondiagnostic` without a host |
| Spec-lint advisories (`source: "spec-lint"`)    | Full tooltip visual QA                                |

Inspect mode is a **host** capability (`<Inspect mode="xy" />` / plot
`inspect`), not a PortableSpec field. To surface the same inspect×geom
advisories agents would only see via `ondiagnostic` in a browser, declare host
intent:

```sh
ggts render --inspect xy spec.json > out.svg
# stderr may include:
# {"kind":"advisory","source":"interaction","code":"INTERACTION_INSPECT_X_ON_COL",…}
```

Modes: `auto`, `exact`, `x`, `y`, `xy` (same enum as the host). Without
`--inspect`, interaction codes are not invented — headless SVG-only charts
stay quiet. Today this path covers bar/col x-guide pure collectors (including
alias rewrite so `geom: "histogram"` matches host `normalize`); high-cardinality
and runtime key/lineage diagnostics still need a mounted host. See
[ADR 0024](https://github.com/ljodea/ggsvelte/blob/main/docs/decisions/0024-cli-interaction-intent.md).

## Install

```sh
npm install --save-dev --save-exact @ggsvelte/cli
npm exec -- ggts check spec.json
npm exec -- ggts render spec.json > out.svg
```

In an agent sandbox image:

```dockerfile
FROM node:24-slim
RUN npm install -g @ggsvelte/cli
# agents can now run: ggts render spec.json > out.svg
```

Pin the same version as the framework adapter your webapp renders
with — all `@ggsvelte/*` packages version in lockstep.

## Usage

`check` runs the same pipeline and rendering checks as `render`, suppressing
SVG output. Both preserve the same diagnostic and exit-code contract.

```sh
ggts check spec.json                        # full checks without SVG
ggts render spec.json > out.svg          # spec from a file
ggts render < spec.json > out.svg        # spec from stdin
ggts render spec.json --data data.json   # named datasets from a file
ggts render spec.json --width 832 --height 400
ggts render --inspect xy spec.json > out.svg   # host inspect intent
```

- `render` writes SVG to stdout; `check` leaves stdout empty.
- Diagnostics go to stderr as JSON lines:
  `{"kind":"error",…}` | `{"kind":"warning",…}` | `{"kind":"advisory",…}`.
  Scale-inference diagnostics set `source: "scale"`; spec-lint sets
  `source: "spec-lint"`; interaction intent (`--inspect`) sets
  `source: "interaction"`.

## Exit codes

| Code | Meaning                                                      |
| ---- | ------------------------------------------------------------ |
| 0    | checked or rendered                                          |
| 1    | render failed (pipeline error — spec was structurally valid) |
| 2    | usage error (bad flags, unreadable input, invalid JSON)      |
| 3    | invalid spec (validation errors — see stderr JSON lines)     |

An agent loop: render, and on exit 3 apply the `fix.example` from each stderr
error at its `path`, re-render; on exit 0 still read stderr — warnings and
advisories are chart-quality feedback.

## Reference

- [CLI reference](https://ggsvelte.sh/reference/cli) — all options and
  diagnostics
- Programmatic use without spawning: `runCommand` accepts `render`/`check`.
  The existing `runCLI` programmatic API remains available.
