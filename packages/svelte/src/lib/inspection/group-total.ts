/**
 * Stack/fill group totals for default tooltips (#1274 / #1389).
 * Independent of inspect mode so exact stacked bars can still show Total.
 */
import type { CandidateFacts, RenderModel } from "@ggsvelte/core";

/** Signed numeric contribution. Non-numeric → null. */
export function candidateValueContribution(
  candidate: CandidateFacts,
  groupAxis: "x" | "y",
): number | null {
  const value = groupAxis === "x" ? candidate.yValue : candidate.xValue;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  return null;
}

export function valueFieldName(
  model: RenderModel,
  member: CandidateFacts,
  groupAxis: "x" | "y",
): string {
  const channel = groupAxis === "x" ? "y" : "x";
  for (const field of model.layerFields[member.layerIndex] ?? []) {
    if (field.channel === channel) return field.field;
  }
  return "";
}

export function contributionIdentity(
  member: CandidateFacts,
  contribution: number | null,
  valueField: string,
): string {
  if (member.rowIndex !== null) return `r:${member.rowIndex}:f:${valueField}`;
  const valueToken = contribution === null ? "" : String(contribution);
  return `s:${member.seriesId}:f:${valueField}:v:${valueToken}`;
}

export function groupHasAdditivePosition(
  model: RenderModel,
  members: readonly CandidateFacts[],
): boolean {
  const positions = model.layerPositions ?? [];
  for (const member of members) {
    const position = positions[member.layerIndex];
    if (position === "stack" || position === "fill") return true;
  }
  return false;
}

/**
 * Only when the group includes a stack/fill layer. Dedupes multi-layer paints
 * of the same series. Returns null for identity/dodge groups.
 */
export function groupMagnitudeTotal(
  model: RenderModel,
  members: readonly CandidateFacts[],
  groupAxis: "x" | "y",
): number | null {
  if (!groupHasAdditivePosition(model, members)) return null;
  const byIdentity = new Map<string, number>();
  for (const member of members) {
    const contribution = candidateValueContribution(member, groupAxis);
    if (contribution === null) continue;
    const key = contributionIdentity(
      member,
      contribution,
      valueFieldName(model, member, groupAxis),
    );
    if (byIdentity.has(key)) continue;
    byIdentity.set(key, contribution);
  }
  if (byIdentity.size === 0) return null;
  let sum = 0;
  for (const value of byIdentity.values()) sum += value;
  return sum;
}

function compositionMembers(
  model: RenderModel,
  seed: CandidateFacts,
  axis: "x" | "y",
): CandidateFacts[] | null {
  const group = model.candidates.group(seed.id, axis);
  if (group === null) return null;
  const members = [...group.memberIds]
    .map((id) => model.candidates.candidate(id))
    .filter((candidate): candidate is CandidateFacts => candidate !== null);
  return members.length === 0 ? [seed] : members;
}

/** Stack/fill total at the seed. Prefer grouping by x (stacked col/area). */
export function compositionGroupTotal(model: RenderModel, seed: CandidateFacts): number | null {
  const position = model.layerPositions?.[seed.layerIndex];
  if (position !== "stack" && position !== "fill") return null;
  for (const axis of ["x", "y"] as const) {
    const members = compositionMembers(model, seed, axis);
    if (members === null) continue;
    const total = groupMagnitudeTotal(model, members, axis);
    if (total !== null) return total;
  }
  return null;
}
