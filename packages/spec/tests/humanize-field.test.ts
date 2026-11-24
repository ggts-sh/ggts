import { describe, expect, it } from "bun:test";

import { humanizeFieldTitle, spaceFieldName } from "../src/index.ts";

describe("spaceFieldName", () => {
  it("returns empty string unchanged", () => {
    expect(spaceFieldName("")).toBe("");
  });

  it("leaves single tokens alone", () => {
    expect(spaceFieldName("year")).toBe("year");
    expect(spaceFieldName("Region")).toBe("Region");
    expect(spaceFieldName("count")).toBe("count");
    expect(spaceFieldName("stackpos")).toBe("stackpos");
  });

  it("splits camelCase, snake_case, and acronym runs", () => {
    expect(spaceFieldName("bloomRefDate")).toBe("bloom Ref Date");
    expect(spaceFieldName("flipper_length")).toBe("flipper length");
    expect(spaceFieldName("bloomDOYAdj")).toBe("bloom DOY Adj");
  });

  it("trims underscore edges and collapses already-spaced input", () => {
    expect(spaceFieldName("_leading")).toBe("leading");
    expect(spaceFieldName("trailing_")).toBe("trailing");
    expect(spaceFieldName("__both__")).toBe("both");
    expect(spaceFieldName("already  spaced")).toBe("already spaced");
  });
});

describe("humanizeFieldTitle (#961)", () => {
  it("sentence-cases multi-word identifiers for axis/legend titles", () => {
    expect(humanizeFieldTitle("bloomRefDate")).toBe("Bloom ref date");
    expect(humanizeFieldTitle("flipper_length")).toBe("Flipper length");
    expect(humanizeFieldTitle("bloomDOYAdj")).toBe("Bloom doy adj");
  });

  it("preserves single tokens including stat columns", () => {
    expect(humanizeFieldTitle("Region")).toBe("Region");
    expect(humanizeFieldTitle("year")).toBe("year");
    expect(humanizeFieldTitle("count")).toBe("count");
    expect(humanizeFieldTitle("density")).toBe("density");
    expect(humanizeFieldTitle("stackpos")).toBe("stackpos");
    expect(humanizeFieldTitle("ecdf")).toBe("ecdf");
  });

  it("returns empty string unchanged", () => {
    expect(humanizeFieldTitle("")).toBe("");
  });
});
