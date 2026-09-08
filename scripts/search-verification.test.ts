import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const runbookPath = join(import.meta.dir, "..", "docs", "search-verification.md");

describe("search verification runbook", () => {
  it("keeps ownership verification, sitemap submission, and indexing as separate outcomes", () => {
    const runbook = readFileSync(runbookPath, "utf8");

    expect(runbook).toContain("Google Search Console domain property");
    expect(runbook).toContain("Bing Webmaster Tools");
    expect(runbook).toContain("https://ggts.sh/sitemap.xml");
    expect(runbook).toContain("Submission is not evidence of indexing");
    expect(runbook).toContain("PR 8");
    expect(runbook).toContain("Rollback");
  });
});
