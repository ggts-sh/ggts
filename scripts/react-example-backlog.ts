/**
 * Rolling list of gallery examples that still need a verified React host
 * (Example.tsx). The gallery React tab is gated on that file.
 */

export interface ReactBacklogExample {
  readonly id: string;
  readonly title: string;
  readonly hasReact: boolean;
}

export function reactVerifiedIds(examples: readonly ReactBacklogExample[]): string[] {
  return examples.filter((ex) => ex.hasReact).map((ex) => ex.id);
}

export function reactRemainingIds(examples: readonly ReactBacklogExample[]): string[] {
  return examples.filter((ex) => !ex.hasReact).map((ex) => ex.id);
}

function backlogLine(ex: ReactBacklogExample): string {
  return `- \`${ex.id}\` — ${ex.title}`;
}

export function buildReactBacklogMarkdown(examples: readonly ReactBacklogExample[]): string {
  const verified = examples.filter((ex) => ex.hasReact);
  const remaining = examples.filter((ex) => !ex.hasReact);
  return `# React example hosts

The gallery shows a React tab only when \`examples/<id>/Example.tsx\` exists.
That file is the proof that the example runs as a React host. A generic
\`GGPlot spec={normalize(chart.json)}\` stub is not enough.

Regenerate with \`bun run manifest:gen\`.

## Verified (${String(verified.length)})

${verified.length === 0 ? "_None._\n" : `${verified.map((ex) => backlogLine(ex)).join("\n")}\n`}
## Remaining (${String(remaining.length)})

Write and check \`Example.tsx\` before the React tab can appear.

${remaining.map((ex) => backlogLine(ex)).join("\n")}
`;
}
