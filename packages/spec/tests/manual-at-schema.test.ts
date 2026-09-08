import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

import { Ajv2020 } from "ajv/dist/2020.js";

import { auditAliasCommitRange } from "./manual-at-alias-audit.ts";

interface Observation {
  id: string;
  observed: string;
  result: "pending" | "pass" | "fail" | "blocked" | "accepted";
  acceptedIssue: number | null;
}

interface Flow {
  id: string;
  fixture: string;
  observations: Observation[];
}

interface Run {
  id: string;
  pairing: string;
  profile: string;
  platform: { name: string; version: string };
  assistiveTechnology: { name: string; version: string };
  browser: { name: string; version: string };
  settings: {
    reducedMotion: boolean;
    contrast: string;
    browserZoomPercent: number;
    largePointer: boolean;
    input: string;
  };
  flows: Flow[];
}

interface AcceptedIssue {
  id: number;
  url: string;
  scope: string[];
}

interface ReleaseRecord {
  release: string;
  testedCommit: string;
  acceptedIssues: AcceptedIssue[];
  runs: Run[];
}

interface ReleaseAlias {
  release: string;
  inherits: string;
  releaseCommit: string;
  runtimeBehaviorChanged: false;
  rationale: string;
}

interface Procedure {
  id: string;
  fixture: string;
  assertions: Record<string, string>;
}

const manualAtDirectory = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  "docs",
  "accessibility",
  "manual-at",
);
const schema = JSON.parse(
  readFileSync(join(manualAtDirectory, "record.schema.json"), "utf8"),
) as object;
const aliasSchema = JSON.parse(
  readFileSync(join(manualAtDirectory, "record-alias.schema.json"), "utf8"),
) as object;
const template = JSON.parse(
  readFileSync(join(manualAtDirectory, "template.json"), "utf8"),
) as object;
const procedures = (
  JSON.parse(readFileSync(join(manualAtDirectory, "procedures.json"), "utf8")) as {
    flows: Procedure[];
  }
).flows;

const corePairings = {
  "voiceover-safari-macos": ["macOS", "VoiceOver", "Safari"],
  "voiceover-chrome-macos": ["macOS", "VoiceOver", "Chrome"],
  "nvda-firefox-windows": ["Windows", "NVDA", "Firefox"],
  "nvda-chrome-windows": ["Windows", "NVDA", "Chrome"],
} as const;

const pairingIdentities: Record<string, readonly [string, string, string]> = {
  ...corePairings,
  "voiceover-safari-ios": ["iOS", "VoiceOver", "Safari"],
  "talkback-chrome-android": ["Android", "TalkBack", "Chrome"],
};

const allFlows = [
  "inspection",
  "pin",
  "unpin",
  "dismiss",
  "grouped-narration",
  "select-area",
  "zoom-area",
  "clear-selection",
  "reset-zoom",
  "docked-narrow-tooltip",
] as const;

const profileRequirements: Record<string, { pairings: string[]; flows: string[] }> = {
  baseline: { pairings: Object.keys(corePairings), flows: [...allFlows] },
  "reduced-motion": {
    pairings: ["voiceover-safari-macos", "nvda-firefox-windows"],
    flows: [
      "inspection",
      "grouped-narration",
      "select-area",
      "zoom-area",
      "reset-zoom",
      "docked-narrow-tooltip",
    ],
  },
  "high-contrast": {
    pairings: ["voiceover-safari-macos", "voiceover-chrome-macos"],
    flows: [
      "inspection",
      "grouped-narration",
      "select-area",
      "zoom-area",
      "clear-selection",
      "reset-zoom",
    ],
  },
  "forced-colors": {
    pairings: ["nvda-firefox-windows", "nvda-chrome-windows"],
    flows: [
      "inspection",
      "grouped-narration",
      "select-area",
      "zoom-area",
      "clear-selection",
      "reset-zoom",
    ],
  },
  "browser-zoom-200": {
    pairings: Object.keys(corePairings),
    flows: [
      "inspection",
      "pin",
      "grouped-narration",
      "select-area",
      "zoom-area",
      "clear-selection",
      "reset-zoom",
      "docked-narrow-tooltip",
    ],
  },
  "large-pointer": {
    pairings: ["voiceover-chrome-macos", "nvda-chrome-windows"],
    flows: [
      "inspection",
      "pin",
      "unpin",
      "dismiss",
      "select-area",
      "zoom-area",
      "clear-selection",
      "reset-zoom",
    ],
  },
  "touch-only": {
    pairings: ["voiceover-safari-ios", "talkback-chrome-android"],
    flows: [
      "inspection",
      "pin",
      "unpin",
      "dismiss",
      "select-area",
      "zoom-area",
      "clear-selection",
      "reset-zoom",
      "docked-narrow-tooltip",
    ],
  },
};

const profileSettings: Record<string, Partial<Run["settings"]>> = {
  baseline: {
    reducedMotion: false,
    contrast: "default",
    browserZoomPercent: 100,
    largePointer: false,
    input: "keyboard-pointer",
  },
  "reduced-motion": { reducedMotion: true },
  "high-contrast": { contrast: "high-contrast" },
  "forced-colors": { contrast: "forced-colors" },
  "browser-zoom-200": { browserZoomPercent: 200 },
  "large-pointer": { largePointer: true },
  "touch-only": { input: "touch-only" },
};

function validator(inputSchema: object = schema) {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  ajv.addFormat("date", {
    type: "string",
    validate(value: string) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      if (match === null) return false;
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
    },
  });
  ajv.addFormat("uri", {
    type: "string",
    validate(value: string) {
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    },
  });
  return ajv.compile(inputSchema);
}

function versionParts(version: string): readonly [number, number, number] {
  const match = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.exec(version);
  expect(match, `invalid stable release ${version}`).not.toBeNull();
  return [Number(match?.[1]), Number(match?.[2]), Number(match?.[3])];
}

function isReleaseAlias(value: ReleaseRecord | ReleaseAlias): value is ReleaseAlias {
  return "inherits" in value;
}

function unique(values: readonly string[], label: string): void {
  expect(new Set(values).size, `${label} must not contain duplicates`).toBe(values.length);
}

function validateReleaseRecord(file: string, record: ReleaseRecord): void {
  const validate = validator();
  expect(validate(record), JSON.stringify(validate.errors, null, 2)).toBe(true);
  expect(basename(file)).toBe(`v${record.release}.json`);

  unique(
    record.runs.map((run) => run.id),
    "run ids",
  );
  unique(
    record.runs.map((run) => `${run.pairing}/${run.profile}`),
    "pairing/profile runs",
  );
  expect(record.runs).toHaveLength(
    Object.values(profileRequirements).reduce(
      (count, requirement) => count + requirement.pairings.length,
      0,
    ),
  );

  const procedureById = new Map(procedures.map((procedure) => [procedure.id, procedure]));
  expect([...procedureById.keys()].toSorted()).toEqual([...allFlows].toSorted());
  for (const [profile, requirement] of Object.entries(profileRequirements)) {
    for (const pairing of requirement.pairings) {
      const run = record.runs.find(
        (candidate) => candidate.pairing === pairing && candidate.profile === profile,
      );
      expect(run, `missing ${pairing}/${profile}`).toBeDefined();
      if (run === undefined) continue;
      expect(run.flows.map((flow) => flow.id).toSorted()).toEqual(requirement.flows.toSorted());
    }
  }

  for (const pairing of Object.keys(corePairings) as Array<keyof typeof corePairings>) {
    const run = record.runs.find(
      (candidate) => candidate.pairing === pairing && candidate.profile === "baseline",
    );
    expect(run, `missing ${pairing}/baseline`).toBeDefined();
    if (run === undefined) continue;
    const [platform, assistiveTechnology, browser] = corePairings[pairing];
    expect([run.platform.name, run.assistiveTechnology.name, run.browser.name]).toEqual([
      platform,
      assistiveTechnology,
      browser,
    ]);
  }

  const acceptedIssues = new Map(record.acceptedIssues.map((issue) => [issue.id, issue]));
  unique(
    record.acceptedIssues.map((issue) => String(issue.id)),
    "accepted issue ids",
  );
  const referencedScopes = new Set<string>();
  for (const run of record.runs) {
    const requirement = profileRequirements[run.profile];
    expect(requirement?.pairings).toContain(run.pairing);
    expect(run.settings).toMatchObject(profileSettings[run.profile] ?? {});
    const identity = pairingIdentities[run.pairing];
    expect(identity, `unknown pairing identity ${run.pairing}`).toBeDefined();
    if (identity !== undefined)
      expect([run.platform.name, run.assistiveTechnology.name, run.browser.name]).toEqual(identity);
    unique(
      run.flows.map((flow) => flow.id),
      `${run.id} flow ids`,
    );
    for (const flow of run.flows) {
      const procedure = procedureById.get(flow.id);
      expect(procedure, `unknown procedure ${flow.id}`).toBeDefined();
      if (procedure === undefined) continue;
      expect(flow.fixture).toBe(procedure.fixture);
      unique(
        flow.observations.map((observation) => observation.id),
        `${run.id}/${flow.id} assertion ids`,
      );
      expect(flow.observations.map((observation) => observation.id).toSorted()).toEqual(
        Object.keys(procedure.assertions).toSorted(),
      );
      for (const observation of flow.observations) {
        const scope = `${run.id}/${flow.id}/${observation.id}`;
        expect(
          observation.observed.trim().length,
          `${scope} requires an observation`,
        ).toBeGreaterThan(0);
        expect(["pass", "accepted"], `${scope} is not release-ready`).toContain(observation.result);
        if (observation.result === "pass") {
          expect(observation.acceptedIssue, scope).toBeNull();
        } else {
          const issue = acceptedIssues.get(observation.acceptedIssue ?? -1);
          expect(issue, `${scope} references an unknown accepted issue`).toBeDefined();
          expect(issue?.scope, `${scope} is absent from accepted issue scope`).toContain(scope);
          referencedScopes.add(scope);
        }
      }
    }
  }

  for (const issue of record.acceptedIssues) {
    // Historical evidence keeps the issue URL recorded before the repository transfer.
    expect(issue.url.replace("github.com/ljodea/ggsvelte/", "github.com/ggts-sh/ggts/")).toBe(
      `https://github.com/ggts-sh/ggts/issues/${String(issue.id)}`,
    );
    for (const scope of issue.scope)
      expect(referencedScopes, `unused accepted scope ${scope}`).toContain(scope);
  }
}

function validateReleaseEvidence(
  file: string,
  evidence: ReleaseRecord | ReleaseAlias,
  resolving: ReadonlySet<string> = new Set(),
): ReleaseRecord {
  if (!isReleaseAlias(evidence)) {
    validateReleaseRecord(file, evidence);
    return evidence;
  }

  const validate = validator(aliasSchema);
  expect(validate(evidence), JSON.stringify(validate.errors, null, 2)).toBe(true);
  expect(basename(file)).toBe(`v${evidence.release}.json`);
  expect(evidence.runtimeBehaviorChanged).toBe(false);
  expect(evidence.rationale.trim().length).toBeGreaterThan(0);

  const [releaseMajor, releaseMinor, releasePatch] = versionParts(evidence.release);
  const [sourceMajor, sourceMinor, sourcePatch] = versionParts(evidence.inherits);
  expect([releaseMajor, releaseMinor], "aliases must stay within one major/minor line").toEqual([
    sourceMajor,
    sourceMinor,
  ]);
  expect(sourcePatch, "an alias must inherit an earlier patch release").toBeLessThan(releasePatch);
  expect(resolving.has(evidence.release), `cyclic manual AT alias at ${evidence.release}`).toBe(
    false,
  );

  const recordsDirectory = join(manualAtDirectory, "records");
  const inheritedFile = join(recordsDirectory, `v${evidence.inherits}.json`);
  expect(
    existsSync(inheritedFile),
    `missing inherited v${evidence.inherits} manual AT record`,
  ).toBe(true);
  const nextResolving = new Set(resolving).add(evidence.release);
  const inherited = JSON.parse(readFileSync(inheritedFile, "utf8")) as ReleaseRecord | ReleaseAlias;
  const resolved = validateReleaseEvidence(inheritedFile, inherited, nextResolving);
  const repoRoot = join(manualAtDirectory, "..", "..", "..");
  auditAliasCommitRange({
    repoRoot,
    baseCommit: resolved.testedCommit,
    releaseCommit: evidence.releaseCommit,
    releaseVersion: evidence.release,
  });
  return resolved;
}

describe("manual assistive-technology evidence schema", () => {
  it("compiles and accepts the draft template", () => {
    const validate = validator();
    expect(validate(template), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it("rejects invalid dates and incomplete or unrecognized evidence", () => {
    const validate = validator();
    expect(validate({ ...template, completedAt: "2026-02-30", unexpected: true })).toBe(false);
    const keywords = validate.errors?.map((error) => error.keyword) ?? [];
    expect(keywords).toContain("additionalProperties");
    expect(keywords).toContain("format");
  });

  it("accepts only explicit same-line aliases for behavior-preserving patch releases", () => {
    const validate = validator(aliasSchema);
    const alias = {
      schemaVersion: 1,
      release: "0.1.1",
      inherits: "0.1.0",
      releaseCommit: "68f29f80b22b91d301378b4e6e17d2abd7b093ec",
      completedAt: "2026-07-15",
      runtimeBehaviorChanged: false,
      rationale: "Package metadata only.",
    };
    expect(validate(alias), JSON.stringify(validate.errors, null, 2)).toBe(true);
    expect(validate({ ...alias, runtimeBehaviorChanged: true })).toBe(false);
    expect(validate({ ...alias, rationale: "" })).toBe(false);
  });

  it("validates every committed release manifest", () => {
    const recordsDirectory = join(manualAtDirectory, "records");
    if (!existsSync(recordsDirectory)) return;
    for (const name of readdirSync(recordsDirectory).filter((candidate) =>
      candidate.endsWith(".json"),
    )) {
      const file = join(recordsDirectory, name);
      validateReleaseEvidence(
        file,
        JSON.parse(readFileSync(file, "utf8")) as ReleaseRecord | ReleaseAlias,
      );
    }
  });
});
