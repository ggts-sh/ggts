/** Profile parsing and field selection for the mock responder. */
import type { DataProfile, ProfileFieldType } from "@ggts-sh/spec";

import { PROFILE_MARKER } from "../../prompt.ts";
import type { Mention } from "./types.ts";

export function parseProfileLine(user: string): DataProfile {
  const at = user.indexOf(PROFILE_MARKER);
  if (at === -1) return { fields: [] };
  const rest = user.slice(at + PROFILE_MARKER.length);
  const line = rest.split("\n", 1)[0] ?? "";
  try {
    return JSON.parse(line.trim()) as DataProfile;
  } catch {
    return { fields: [] };
  }
}

/** Fields whose names appear in the prompt, in first-mention order. */
function findMentions(prompt: string, profile: DataProfile): Mention[] {
  const out: Mention[] = [];
  for (const field of profile.fields) {
    const tokens = field.name.toLowerCase().split(/[_\s]+/);
    const forms = new Set([field.name.toLowerCase(), tokens.join(" ")]);
    if (tokens.length >= 2) forms.add(tokens.slice(0, -1).join(" "));
    // Keep the deterministic fallback useful for common prompt/profile vocabulary
    // mismatches without inventing a field that is absent from the profile.
    if (tokens.includes("cost")) forms.add("price");
    let best = -1;
    for (const form of forms) {
      const i = prompt.indexOf(form);
      if (i !== -1 && (best === -1 || i < best)) best = i;
    }
    if (best !== -1) out.push({ name: field.name, type: field.type, index: best });
  }
  return out.toSorted((a, b) => a.index - b.index);
}

export class FieldPicker {
  readonly #mentions: Mention[];
  readonly #profile: DataProfile;
  readonly #used = new Set<string>();

  constructor(prompt: string, profile: DataProfile) {
    this.#mentions = findMentions(prompt, profile);
    this.#profile = profile;
  }

  #pick(match: (type: ProfileFieldType) => boolean): string | undefined {
    for (const m of this.#mentions) {
      if (match(m.type) && !this.#used.has(m.name)) {
        this.#used.add(m.name);
        return m.name;
      }
    }
    for (const f of this.#profile.fields) {
      if (match(f.type) && !this.#used.has(f.name)) {
        this.#used.add(f.name);
        return f.name;
      }
    }
    return undefined;
  }

  quant(): string | undefined {
    return this.#pick((t) => t === "quantitative");
  }

  cat(): string | undefined {
    return this.#pick((t) => t === "nominal" || t === "ordinal");
  }

  temporal(): string | undefined {
    return this.#pick((t) => t === "temporal");
  }

  /** A mentioned category field only (no profile-order fallback). */
  mentionedCat(): string | undefined {
    for (const m of this.#mentions) {
      if ((m.type === "nominal" || m.type === "ordinal") && !this.#used.has(m.name)) {
        this.#used.add(m.name);
        return m.name;
      }
    }
    return undefined;
  }

  /** A mentioned quantitative field only (no fallback). */
  mentionedQuant(): string | undefined {
    for (const m of this.#mentions) {
      if (m.type === "quantitative" && !this.#used.has(m.name)) {
        this.#used.add(m.name);
        return m.name;
      }
    }
    return undefined;
  }

  typeOf(name: string): ProfileFieldType | undefined {
    return this.#profile.fields.find((f) => f.name === name)?.type;
  }
}

/** The literal field name when it exists in the profile, else undefined. */
export function fieldNamed(profile: DataProfile, name: string): string | undefined {
  return profile.fields.some((field) => field.name === name) ? name : undefined;
}
