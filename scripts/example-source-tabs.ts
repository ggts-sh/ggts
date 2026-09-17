/**
 * Gallery example source tabs. Svelte is first. A React tab exists only when
 * the example ships a verified Example.tsx — never a generic spec-host stub.
 */

export interface ExampleSourceTab {
  readonly label: string;
  readonly code: string;
  readonly language: string;
}

export function exampleSourceHeading(hasReact: boolean): string {
  return hasReact ? "Svelte, React, builder, JSON" : "Svelte, builder, JSON";
}

export function exampleSourceTabs(input: {
  svelteSource: string;
  specSource: string;
  spec: unknown;
  reactSource: string | null;
}): ExampleSourceTab[] {
  const tabs: ExampleSourceTab[] = [
    { label: "Svelte", code: input.svelteSource, language: "svelte" },
    { label: "Builder (TS)", code: input.specSource, language: "typescript" },
    {
      label: "Spec (JSON)",
      code: JSON.stringify(input.spec, null, 2),
      language: "json",
    },
  ];
  const reactSource = input.reactSource?.trim() ?? "";
  if (reactSource !== "") {
    tabs.splice(1, 0, { label: "React", code: reactSource, language: "tsx" });
  }
  return tabs;
}
