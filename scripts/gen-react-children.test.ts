import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { reactChildrenGroup } from "./gen-react-children.ts";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "react-children-"));
  roots.push(root);
  return root;
}

describe("React generated children", () => {
  test("checked-in shells are current", async () => {
    await reactChildrenGroup(join(import.meta.dir, "..")).check();
  });

  test("check rejects stale output without overwriting it", async () => {
    const root = tempRoot();
    const group = reactChildrenGroup(root);
    await group.write();
    const path = join(root, "packages/react/src/scales.tsx");
    writeFileSync(path, "stale output\n");
    await group.check().then(
      () => expect.unreachable("expected stale artifact rejection"),
      (error: unknown) => {
        expect(String(error)).toContain("STALE");
      },
    );
    expect(readFileSync(path, "utf8")).toBe("stale output\n");
    await group.write();
    await group.check();
  });

  test("check rejects missing output", async () => {
    await reactChildrenGroup(tempRoot())
      .check()
      .then(
        () => expect.unreachable("expected missing artifact rejection"),
        (error: unknown) => {
          expect(String(error)).toContain("MISSING");
        },
      );
  });
});
