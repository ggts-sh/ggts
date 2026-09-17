import { describe, expect, it } from "bun:test";

import {
  buildReactBacklogMarkdown,
  reactRemainingIds,
  reactVerifiedIds,
} from "./react-example-backlog.ts";

const examples = [
  { id: "a/one", title: "One", hasReact: true },
  { id: "b/two", title: "Two", hasReact: false },
];

describe("react example backlog", () => {
  it("splits verified hosts from remaining examples", () => {
    expect(reactVerifiedIds(examples)).toEqual(["a/one"]);
    expect(reactRemainingIds(examples)).toEqual(["b/two"]);
  });

  it("lists remaining ids in the markdown", () => {
    const md = buildReactBacklogMarkdown(examples);
    expect(md).toContain("## Verified (1)");
    expect(md).toContain("`a/one`");
    expect(md).toContain("## Remaining (1)");
    expect(md).toContain("`b/two`");
    expect(md).toContain("Example.tsx");
  });
});
