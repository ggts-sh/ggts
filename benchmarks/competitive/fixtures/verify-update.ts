/**
 * Update truth gate: the same mounted chart must visibly change between the
 * two benchmark variants, and its final output must equal a fresh mount of
 * the second variant. It uses the benchmark's exact update + double-rAF wait.
 */
import { mountSync } from "./adapter-dispatch";
import { afterPaint, caseById, type MountHandle } from "./lifecycle";
import { compareSvgDom } from "./parity-svg";
import { verificationRoot, type UpdateVerification, visibleSnapshot } from "./snapshot";
import { dataForCase, perturbForUpdate, type LibId } from "../scenarios";

export async function verifyUpdate(lib: string, caseId: string): Promise<UpdateVerification> {
  const c = caseById(caseId);
  const data = dataForCase(c);
  const first = perturbForUpdate(data, 1);
  const final = perturbForUpdate(data, 2);
  const updatedRoot = verificationRoot();
  const freshRoot = verificationRoot();
  let updated: MountHandle | undefined;
  let fresh: MountHandle | undefined;
  try {
    const mounted = mountSync(lib as LibId, c.scenario, data, updatedRoot);
    updated = mounted.handle;
    if (updated?.update === undefined) {
      return { equal: false, mutated: false, detail: `${lib} has no in-place update path` };
    }
    await afterPaint();
    updated.update(first);
    await afterPaint();
    const firstSnapshot = visibleSnapshot(updatedRoot);
    updated.update(final);
    await afterPaint();
    const finalSnapshot = visibleSnapshot(updatedRoot);
    const freshMounted = mountSync(lib as LibId, c.scenario, final, freshRoot);
    fresh = freshMounted.handle;
    await afterPaint();
    const freshSnapshot = visibleSnapshot(freshRoot);
    const mutated = firstSnapshot !== finalSnapshot;
    const equal = finalSnapshot === freshSnapshot;
    if (mutated && equal && lib === "ggsvelte-svg") {
      const parity = compareSvgDom(updatedRoot.firstElementChild, freshRoot.firstElementChild);
      if (!parity.equal) {
        return {
          equal: false,
          mutated,
          detail: `live-SVG parity failed for ${caseId}: ${parity.detail}`,
        };
      }
    }
    const diffAt = equal
      ? -1
      : Array.from({ length: Math.max(finalSnapshot.length, freshSnapshot.length) }).findIndex(
          (_, index) => finalSnapshot[index] !== freshSnapshot[index],
        );
    const parityDetail =
      diffAt < 0
        ? "updated final output differs from a fresh final-data mount"
        : `updated/fresh differ at ${diffAt}: ${JSON.stringify(finalSnapshot.slice(diffAt, diffAt + 120))} vs ${JSON.stringify(freshSnapshot.slice(diffAt, diffAt + 120))}`;
    return {
      equal: mutated && equal,
      mutated,
      detail: !mutated
        ? "variant 1 and variant 2 produced identical visible output"
        : equal
          ? "updated output changed and equals a fresh final-data mount"
          : parityDetail,
    };
  } finally {
    updated?.destroy();
    fresh?.destroy();
    updatedRoot.remove();
    freshRoot.remove();
  }
}
