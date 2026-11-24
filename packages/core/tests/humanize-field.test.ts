import { describe, expect, it } from "bun:test";
import {
  humanizeFieldTitle as specHumanizeFieldTitle,
  spaceFieldName as specSpaceFieldName,
} from "@ggts-sh/spec";

import { humanizeFieldTitle, spaceFieldName } from "../src/index.ts";

describe("@ggts-sh/core humanize-field re-exports", () => {
  it("re-exports humanizeFieldTitle and spaceFieldName from @ggts-sh/spec", () => {
    expect(humanizeFieldTitle).toBe(specHumanizeFieldTitle);
    expect(spaceFieldName).toBe(specSpaceFieldName);
    expect(humanizeFieldTitle("nace_section")).toBe("Nace section");
    expect(spaceFieldName("bloomRefDate")).toBe("bloom Ref Date");
  });
});
