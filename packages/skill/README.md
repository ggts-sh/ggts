# @ggts-sh/skill

The ggts agent skill: `SKILL.md` plus deep-dive `references/` that teach a
coding agent the shared grammar of graphics — TypeScript builders, React
and Svelte components, PortableSpec JSON, and the `ggts check` /
`ggts render` feedback loop.

This package is the one published home of the skill. It versions in lock-step
with [`@ggts-sh/spec`](https://www.npmjs.com/package/@ggts-sh/spec),
[`@ggts-sh/core`](https://www.npmjs.com/package/@ggts-sh/core),
[`@ggts-sh/compose`](https://www.npmjs.com/package/@ggts-sh/compose),
[`@ggts-sh/react`](https://www.npmjs.com/package/@ggts-sh/react),
[`@ggts-sh/svelte`](https://www.npmjs.com/package/@ggts-sh/svelte), and
[`@ggts-sh/cli`](https://www.npmjs.com/package/@ggts-sh/cli): a given version
number describes the spec, the renderers, and this skill as of the same
release. Pin it like any other dependency and let dependabot (or
npm-check-updates) tell you when the bundled skill in your repo is stale.

## Install

```sh
npm install --save-dev --save-exact @ggts-sh/skill @ggts-sh/cli
```

The package root **is** the skill directory: `SKILL.md` sits next to this
README. Skill loaders key off the frontmatter (`name: ggts`), not the
directory name.

## Use

Point your agent at the skill, or copy/symlink it into your agent's skills
directory under the name `ggts`:

```sh
# Claude Code
cp -R node_modules/@ggts-sh/skill .claude/skills/ggts

# pi
cp -R node_modules/@ggts-sh/skill .pi/agent/skills/ggts

# or reference it in place
node_modules/@ggts-sh/skill/SKILL.md
```

Re-run the copy on every version bump (a two-line `postinstall` or a sync
script works); the dependabot PR is the signal that the skill changed.

The skill assumes the agent can also run
[`@ggts-sh/cli`](https://www.npmjs.com/package/@ggts-sh/cli)
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
