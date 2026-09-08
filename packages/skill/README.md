# @ggsvelte/skill

The ggsvelte agent skill: `SKILL.md` plus deep-dive `references/` that teach a
coding agent the shared grammar of graphics — TypeScript builders, React
and Svelte components, PortableSpec JSON, and the `ggts check` /
`ggts render` feedback loop.

This package is the one published home of the skill. It versions in lock-step
with [`@ggsvelte/spec`](https://www.npmjs.com/package/@ggsvelte/spec),
[`@ggsvelte/core`](https://www.npmjs.com/package/@ggsvelte/core),
[`@ggsvelte/compose`](https://www.npmjs.com/package/@ggsvelte/compose),
[`@ggsvelte/react`](https://www.npmjs.com/package/@ggsvelte/react),
[`@ggsvelte/svelte`](https://www.npmjs.com/package/@ggsvelte/svelte), and
[`@ggsvelte/cli`](https://www.npmjs.com/package/@ggsvelte/cli): a given version
number describes the spec, the renderers, and this skill as of the same
release. Pin it like any other dependency and let dependabot (or
npm-check-updates) tell you when the bundled skill in your repo is stale.

## Install

```sh
npm install --save-dev --save-exact @ggsvelte/skill @ggsvelte/cli
```

The package root **is** the skill directory: `SKILL.md` sits next to this
README. Skill loaders key off the frontmatter (`name: ggsvelte`), not the
directory name.

## Use

Point your agent at the skill, or copy/symlink it into your agent's skills
directory under the name `ggsvelte`:

```sh
# Claude Code
cp -R node_modules/@ggsvelte/skill .claude/skills/ggsvelte

# pi
cp -R node_modules/@ggsvelte/skill .pi/agent/skills/ggsvelte

# or reference it in place
node_modules/@ggsvelte/skill/SKILL.md
```

Re-run the copy on every version bump (a two-line `postinstall` or a sync
script works); the dependabot PR is the signal that the skill changed.

The skill assumes the agent can also run
[`@ggsvelte/cli`](https://www.npmjs.com/package/@ggsvelte/cli)
(`ggts check` and `ggts render`) for spec validation and headless SVG rendering — install it
in every sandbox where an agent authors specs.

## Contents

- `SKILL.md` — target selection, shared grammar, authoring workflow.
- `references/react.md` and `references/svelte.md` — adapter instructions.
- `references/` — geoms and stats, scales and palettes, themes, interactions,
  composition surfaces, recipes.

## Guarantees

CI checks the teaching contracts and shipped examples:

1. **Content contracts** (`scripts/skill-content/*.test.ts`,
   `scripts/skill-package.test.ts`) — inventory completeness for every geom,
   stat, position, theme, and color scheme; every complete JSON fence
   normalizes and validates; pack shape and lock-step version. Packed-consumer
   checks also compile complete TSX and Svelte examples from the installed skill.
2. **Trigger / disclosure contracts** (`scripts/skill-trigger.test.ts`) —
   frontmatter description quality (the loader's selection signal), balanced
   positive/negative trigger fixtures under `evals/trigger-cases.json`,
   relative-link integrity, and progressive disclosure of every `references/`
   file from `SKILL.md`.
3. **Held-out NL→spec evals** (`tests/evals/`, `bun run evals`) — model
   capability on PortableSpec authoring with deterministic graders. These do
   **not** load this skill today; agent-in-the-loop skill evals (with/without
   skill A/B, multi-trial trigger accuracy) are tracked as follow-up work.

`evals/trigger-cases.json` is not packed to npm (`files` is only `SKILL.md` +
`references/`). It is the living seed for future skill-loaded agent evals.
