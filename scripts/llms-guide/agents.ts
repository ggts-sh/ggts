import {
  SANDBOX_COMMANDS,
  SANDBOX_INSTALL,
  SANDBOX_PROMPT,
  SANDBOX_SPEC_JSON,
} from "../agent-quickstart";

export const AGENTS_MD = `# Charts in agent sandboxes

Author a chart as data, aesthetics, and layers. The PortableSpec JSON is the
artifact: the CLI checks and renders it without a browser, and React or
Svelte can display the same spec in an application.

## Install the feedback loop

In the sandbox project, install the CLI and skill at matching versions:

\`\`\`sh complete
${SANDBOX_INSTALL}
\`\`\`

Keep package.json and the lockfile with the project. Install dependencies
when preparing a sandbox, before disconnecting it from the network. Rendering
local JSON requires no model service, browser, or framework installation.

Point the agent at \`node_modules/@ggsvelte/skill/SKILL.md\`. Add that instruction
to the project's agent instructions, or copy the package directory into the
skill directory used by your agent. Refresh copied files after each package
upgrade; updating a dependency alone does not refresh a copy. The package has
one shared grammar and separate React/Svelte references.

## Give the agent a complete task

\`\`\`text fragment
${SANDBOX_PROMPT}
\`\`\`

Here is the complete expected chart structure, saved as \`chart.json\`:

\`\`\`json complete
${SANDBOX_SPEC_JSON}
\`\`\`

Run the same commands yourself to verify the setup:

\`\`\`sh complete
${SANDBOX_COMMANDS}
\`\`\`

\`check\` runs the rendering pipeline and suppresses SVG output. \`render\`
writes SVG to stdout. Both write JSON Lines diagnostics to stderr. Exit 3
means an invalid spec; 2 means invalid input or usage; 1 means the pipeline
or renderer failed. Exit 0 can still carry warnings and advisories worth
reading. Keep stdout and stderr separate so diagnostic text does not enter
the SVG file.

## Repair, then inspect

Validation errors identify a \`code\`, JSON \`path\`, and suggested \`fix\`.
Apply a relevant \`fix.example\` at its path and check again. Read warnings
about data, scales, and chart quality against the user's intent. Then open
the SVG and inspect labels, axes, marks, and the story the chart tells.

The [error catalog](/guide/errors), [advisories](/guide/advisories), and
[CLI reference](/reference/cli) explain the machine-readable feedback.
The schema is at [/schema/v0.json](/schema/v0.json); the documentation index
is at [/llms.txt](/llms.txt), with the corpus at [/llms-full.txt](/llms-full.txt).

## Bring the chart into an application

Install the adapter for the target application and pass this spec to
\`GGPlot\`. Call \`registerAll()\` once for spec-driven charts. Follow the
[React and Svelte quickstarts](/guide/getting-started), or author the same
grammar with the TypeScript builder and component children.

Inspection, selection, zoom, custom tooltips, and linked views are host
behavior. Test them in a mounted browser application: CLI success does not
verify framework callbacks, keyboard access, or hydration.
`;
