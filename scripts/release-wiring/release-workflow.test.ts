import { describe, expect, it } from "bun:test";
import { heavyRunsOnCount, read, readCiSurface, selfHostedGgsvelteCount } from "./test-helpers";

it("thins expensive jobs on main push (issue #244)", () => {
  // Policy lives in detect-changes.ts after #393 extraction (not inline bash).
  const driver = read("scripts/ci-routing/detect-changes.ts");
  expect(driver).toContain("main push: thinned consumer/bench (issue #244)");
  expect(driver).toContain("applyMainPushThinning");
  expect(driver).toMatch(/consumer:\s*false/);
  expect(driver).toMatch(/bench_smoke:\s*false/);
  expect(driver).toMatch(/interaction_perf:\s*false/);
  // Must NOT force-off component/packages_dist on main (Codecov main badges).
  const thinFn = driver.slice(
    driver.indexOf("function applyMainPushThinning"),
    driver.indexOf("function applyRunCompat"),
  );
  expect(thinFn).not.toContain("component:");
  expect(thinFn).not.toContain("packages_dist:");
});

it("tiers the PR consumer matrix (issue #246)", () => {
  const ci = readCiSurface();
  const driver = read("scripts/ci-routing/detect-changes.ts");
  expect(ci).toContain("run-compat");
  expect(ci).toContain("flavor=pr");
  // Label must force consumer even when path routing would skip (Codex P2).
  expect(driver).toContain("run-compat: forced consumer + packages_dist");
  expect(driver).toContain("applyRunCompat");
  // Main push stays thinned per #244; full required is PR+label or nightly.
  expect(ci).not.toMatch(/full required[\s\S]{0,40}push\/main/i);
});

it("uses elastic hosted runners for PR correctness and visual checks", () => {
  const ci = readCiSurface();
  const vr = read(".github/workflows/vr-compare.yml");
  const bench = read(".github/workflows/bench.yml");
  const nightly = read(".github/workflows/compatibility-nightly.yml");
  const cancel = read(".github/workflows/cancel-on-pr-close.yml");

  // PR CI and VR must not regress to the four-slot repo-local pool. Optional,
  // the migrated repository has no registered self-hosted runner pool.
  for (const workflow of [ci, vr, bench, nightly]) {
    expect(heavyRunsOnCount(workflow)).toBe(0);
    expect(workflow).not.toContain("heavy-self-hosted-cpu");
  }
  expect(selfHostedGgsvelteCount(ci)).toBe(0);
  expect(selfHostedGgsvelteCount(vr)).toBe(0);
  expect(ci.match(/runs-on: ubuntu-latest/g)?.length).toBeGreaterThanOrEqual(16);
  expect(ci).toContain("runs-on: ${{ matrix.os }}");
  expect(vr.match(/runs-on: ubuntu-latest/g)?.length).toBeGreaterThanOrEqual(4);
  expect(selfHostedGgsvelteCount(bench)).toBe(0);
  expect(selfHostedGgsvelteCount(nightly)).toBe(0);
  expect(ci).not.toContain("heavy-component");
  expect(ci).not.toContain("heavy-packages-dist");
  expect(ci).not.toContain("heavy-consumer-ubuntu");
  expect(ci).not.toContain("group: heavy-interaction-perf");
  // Superseded/closed work is still cancelled independently of runner choice.
  expect(ci).toMatch(/elastic pool|hosted|GitHub-hosted|ubuntu-latest/i);
  expect(ci).toContain("cancel-in-progress: true");
  expect(cancel).toContain("pull_request_target");
  expect(cancel).toContain("head_sha");
  // Bench: job-level concurrency so skip-only runs cannot cancel real work.
  expect(bench).toContain("group: bench-label-");
  expect(bench).not.toContain("gh-pages");
  expect(bench).not.toContain("github-action-benchmark");
});

it("binds approved baselines to a post-merge default-branch commit", () => {
  const compare = read(".github/workflows/vr-compare.yml");
  const approve = read(".github/workflows/vr-approve.yml");
  const checkout = approve.indexOf("checkout exact verified merged commit from base repo");

  for (const workflow of [compare, approve]) {
    expect(workflow).toContain(".merge_commit_sha");
    expect(workflow).toContain(".base.repo.full_name");
    expect(workflow).toContain(".base.ref");
    expect(workflow).toContain("default_branch");
    expect(workflow).toContain('comment_epoch="$(date -u -d');
    expect(workflow).toContain('merged_epoch="$(date -u -d');
    expect(workflow).toContain('if [ "${comment_epoch}" -le "${merged_epoch}" ]; then');
    expect(workflow).toContain("identical|ahead");
    expect(workflow).toContain('-f sha="${default_branch}"');
  }
  expect(compare).toContain("compare/${render_sha}...${default_sha}");
  expect(compare).toContain('render_repo="${REPO}"');
  expect(compare).not.toContain(".head.repo.full_name");
  expect(compare).toContain("source PR #${PR_NUMBER} is not merged");
  expect(compare).toContain("approval comment predates merge");
  expect(compare).toContain("ref: ${{ needs.approve-gate.outputs.render_sha }}");
  expect(approve).toContain("compare/${RENDER_SHA}...${default_sha}");
  expect(approve).toContain("artifact render is for ${RENDER_SHA}");
  expect(approve).toContain('if [ "${comment_epoch}" -le "${commit_epoch}" ]; then');
  expect(approve).toContain("ref: ${{ steps.verify.outputs.render_sha }}");
  expect(approve.indexOf('merged_at="$(printf')).toBeLessThan(checkout);

  const installAndGenerator = approve.slice(
    approve.indexOf("install dependencies at verified merged commit"),
    approve.indexOf("commit and push verified baselines to vr-update/pr-<n>"),
  );
  expect(installAndGenerator).toContain("bun install --frozen-lockfile");
  expect(installAndGenerator).toContain("bun scripts/gen-gallery-previews.ts");
  expect(installAndGenerator).not.toContain("GH_TOKEN:");
  expect(installAndGenerator).not.toContain("GITHUB_TOKEN:");
});

it("regenerates docs-owned gallery previews when approved baselines land", () => {
  const approve = read(".github/workflows/vr-approve.yml");
  const copy = approve.indexOf("find ../vr-artifact -name '*.png'");
  const generate = approve.indexOf("bun scripts/gen-gallery-previews.ts");
  const stage = approve.indexOf("git add tests/visual/__screenshots__ apps/docs/static/previews");

  expect(copy).toBeGreaterThan(-1);
  expect(generate).toBeGreaterThan(copy);
  expect(stage).toBeGreaterThan(generate);
  expect(approve).toContain("apps/docs/src/lib/generated/gallery-previews.ts");
});

it("opens the vr-update PR instead of stranding baselines on a branch (issue #717)", () => {
  const approve = read(".github/workflows/vr-approve.yml");

  // Least privilege: PR write is added for `gh pr create`, nothing else moves.
  expect(approve).toContain("pull-requests: write");
  expect(approve).toContain("contents: write");
  expect(approve).not.toContain("issues: write");

  // The decision itself lives in a unit-tested script, not in YAML shell.
  expect(approve).toContain("bun tools/scripts/vr-approve-decision.ts action");
  expect(approve).toContain("bun tools/scripts/vr-approve-decision.ts pr-create");
  // …run from the default branch, so recovering an old merged PR never depends
  // on the rendered commit predating this script.
  expect(approve).toContain("ref: ${{ github.event.repository.default_branch }}");
  expect(approve).toContain("sparse-checkout: scripts/vr-approve-decision.ts");

  // Open-PR existence is a fact the decision consumes, not a branch-tip guess.
  expect(approve).toContain("-f state=open");
  expect(approve).toContain('-f head="${REPO%%/*}:${branch}"');
  expect(approve).not.toContain('echo "skip=true"');

  // Render and the two PR-creation steps are gated on the script's verdicts.
  expect(approve).toContain("steps.decide.outputs.action == 'render'");
  expect(approve).toContain("steps.decide.outputs.action != 'skip'");
  expect(approve).toContain("steps.pr_decide.outputs.create == 'true'");
  expect(approve).toContain("gh pr create --repo");
  expect(approve).toContain('--head "${branch}"');
  expect(approve).toContain('--base "${DEFAULT_BRANCH}"');
  // A push that changed nothing must not claim a branch worth reviewing.
  expect(approve).toContain('echo "pushed=true"');
  expect(approve).toContain('echo "pushed=false"');

  const decide = approve.indexOf("bun tools/scripts/vr-approve-decision.ts action");
  const checkout = approve.indexOf("checkout exact verified merged commit from base repo");
  const push = approve.indexOf("commit and push verified baselines to vr-update/pr-<n>");
  const create = approve.indexOf("gh pr create --repo");
  expect(decide).toBeGreaterThan(-1);
  expect(checkout).toBeGreaterThan(decide);
  expect(create).toBeGreaterThan(push);
});

it("keeps the write credential out of every vr-approve step that runs repo code", () => {
  const approve = read(".github/workflows/vr-approve.yml");
  const steps = approve.split("\n      - name: ").slice(1);
  expect(steps.length).toBeGreaterThan(8);

  for (const step of steps) {
    const label = step.split("\n")[0];
    // The credential is *supplied* by an env assignment; a comment naming it
    // (the generator step explains its absence) is not the same thing.
    if (!/^\s+GH_TOKEN: /m.test(step)) continue;
    // Credentialed steps stay script-free: `gh`/`git` only, never repository
    // code from the checkout (invariant 1).
    expect(step, `credentialed step runs repo code: ${label}`).not.toMatch(/\brun: bun\b/);
    expect(step, `credentialed step runs repo code: ${label}`).not.toMatch(/\n\s+bun \S/);
  }

  const decideSteps = steps.filter((step) =>
    step.includes("bun tools/scripts/vr-approve-decision.ts"),
  );
  expect(decideSteps.length).toBe(2);
  for (const step of decideSteps) {
    expect(step).not.toContain("GH_TOKEN");
    expect(step).not.toContain("GITHUB_TOKEN");
  }
});

it("uses job-private Bun caches across CI workflows (issue #319)", () => {
  const workflows = [
    ".github/workflows/ci.yml",
    ".github/workflows/ci-unit.yml",
    ".github/workflows/ci-consumer.yml",
    ".github/workflows/ci-component-svelte.yml",
    ".github/workflows/vr-compare.yml",
    ".github/workflows/bench.yml",
    ".github/workflows/compatibility-nightly.yml",
    ".github/workflows/evals.yml",
  ];
  for (const path of workflows) {
    const workflow = read(path);
    const installs = workflow.match(/bun install --frozen-lockfile/g) ?? [];
    const fixtureInstalls = workflow.match(/run: bun scripts\/consumer-compat\.ts/g) ?? [];
    const privateCacheEnv =
      workflow.match(/BUN_INSTALL_CACHE_DIR: \$\{\{ runner\.temp \}\}\/bun-install-cache/g) ?? [];
    const privateCachePaths =
      workflow.match(/path: \$\{\{ runner\.temp \}\}\/bun-install-cache/g) ?? [];
    const bunCacheKeys = workflow.match(/key: bun-(?:container-)?\$\{\{ runner\.os \}\}/g) ?? [];
    expect(workflow, path).not.toContain("path: ~/.bun/install/cache");
    expect(privateCacheEnv.length, `${path}: every install gets a private cache`).toBe(
      installs.length + fixtureInstalls.length,
    );
    expect(privateCachePaths.length, `${path}: every Bun cache restore is private`).toBe(
      bunCacheKeys.length,
    );
  }

  // Shared install composite (ci.yml) must keep the private-cache protocol.
  const bunInstall = read(".github/actions/ci-bun-install/action.yml");
  expect(bunInstall).toContain("bun install --frozen-lockfile");
  expect(bunInstall).toContain("path: ${{ runner.temp }}/bun-install-cache");
  expect(bunInstall).toContain("BUN_INSTALL_CACHE_DIR: ${{ runner.temp }}/bun-install-cache");
  expect(bunInstall).not.toContain("path: ~/.bun/install/cache");

  // Consumer fixtures run their own package-manager install from a later step,
  // so that step must receive the cache env independently of the root install.
  for (const [path, start, end] of [
    [".github/workflows/ci-consumer.yml", "  consumer-compat:", ""],
    [".github/workflows/compatibility-nightly.yml", "  packed-consumer:", ""],
  ] as const) {
    const workflow = read(path);
    const jobStart = workflow.indexOf(start);
    const jobEnd = end.length > 0 ? workflow.indexOf(end, jobStart) : workflow.length;
    const job = workflow.slice(jobStart, jobEnd);
    const consumerRun = job.indexOf("run: bun scripts/consumer-compat.ts");
    const consumerStepStart = job.lastIndexOf("\n      - ", consumerRun);
    const consumerStep = job.slice(consumerStepStart, consumerRun);
    expect(consumerStep, `${path}: fixture install gets a private cache`).toContain(
      "BUN_INSTALL_CACHE_DIR: ${{ runner.temp }}/bun-install-cache",
    );
  }
});

const release = () => read(".github/workflows/release.yml");

describe("release.yml concurrent-merge race recovery", () => {
  // Peeled v2.1.1 tag → commit (changesets/action@v2.1.1). Verified against
  // the annotated tag object, not copied from Dependabot #1655 alone.
  const CHANGESETS_ACTION_V2 = "changesets/action@8488615a623b1b9c987934bb89eae8af6a946ac1";

  type ReleaseStep = {
    name?: string;
    uses?: string;
    with?: Record<string, string>;
    env?: Record<string, string>;
  };

  function versionPackagesStep(): ReleaseStep {
    const workflow = Bun.YAML.parse(release()) as {
      jobs?: { release?: { steps?: ReleaseStep[] } };
    };
    const step = workflow.jobs?.release?.steps?.find(
      (candidate) => candidate.name === "changesets — open/update Version Packages PR",
    );
    if (step === undefined) {
      throw new Error("release.yml is missing the Version Packages step");
    }
    return step;
  }

  it("queues releases and never cancels an in-flight publish", () => {
    const yml = release();
    expect(yml).toMatch(/concurrency:\s*\n\s*group:\s*release/);
    expect(yml).toContain("cancel-in-progress: false");
  });

  it("does not pass publish to changesets/action (publish is decoupled)", () => {
    // changesets/action is either/or: any leftover .changeset/*.md makes it
    // skip publish while staying green. Publish lives in a separate step so
    // concurrent feature merges cannot suppress shipping already-bumped versions.
    const step = versionPackagesStep();
    expect(step.uses).toStartWith("changesets/action@");
    expect(step.with ?? {}).not.toHaveProperty("publish");
    expect(step.with ?? {}).not.toHaveProperty("publish-script");
  });

  it("wires changesets/action v2 with version-script and github-token", () => {
    // Action v2 ignores the v1 `version` input and no longer reads env.GITHUB_TOKEN.
    // github-token is the required input. This does not claim the action scrubs
    // INPUT_GITHUB_TOKEN before it runs `bun run version`.
    const step = versionPackagesStep();
    expect(step.uses).toBe(CHANGESETS_ACTION_V2);
    expect(step.with).toEqual({
      "version-script": "bun run version",
      "github-token": "${{ secrets.GITHUB_TOKEN }}",
    });
    expect(step.env).toBeUndefined();
  });

  it("pins @changesets/cli 3 so action v2 can run", () => {
    const pkg = JSON.parse(read("package.json")) as {
      devDependencies: Record<string, string>;
    };
    const cli = pkg.devDependencies["@changesets/cli"];
    expect(cli).toBe("3.0.1");
    expect(read("CONTRIBUTING.md")).toMatch(
      new RegExp(String.raw`\|\s*@changesets/cli\s+\|\s*${cli}\s+\|`),
    );
  });

  it("publishes, stages, tags, and asserts on the main tip before the version-PR step", () => {
    const yml = release();
    expect(yml).toContain("bun scripts/publish-unpublished.ts");
    expect(yml).toContain("bun scripts/stage-github-releases.ts");
    expect(yml).toContain("bun scripts/assert-npm-published.ts");
    expect(yml).toContain("gh release create");
    expect(yml).toContain("vars.NPM_PUBLISH_ENABLED == 'true'");
    // Publish → stage → gh-create → assert → version PR. Publish must not run
    // after changesets/action, which leaves the workspace on
    // changeset-release/main with unreviewed next-version package.json files.
    const publishAt = yml.indexOf("bun scripts/publish-unpublished.ts");
    const stageAt = yml.indexOf("bun scripts/stage-github-releases.ts");
    const createAt = yml.indexOf("gh release create");
    const assertAt = yml.indexOf("bun scripts/assert-npm-published.ts");
    const versionAt = yml.indexOf("changesets — open/update Version Packages PR");
    expect(publishAt).toBeGreaterThan(-1);
    expect(stageAt).toBeGreaterThan(publishAt);
    expect(createAt).toBeGreaterThan(stageAt);
    expect(assertAt).toBeGreaterThan(createAt);
    expect(versionAt).toBeGreaterThan(assertAt);
  });

  it("keeps the write credential out of publish and staging (bun) steps", () => {
    // Same shape as the vr-approve invariant: steps that run repository code
    // must not hold GITHUB_TOKEN. Tagging is a later gh-only step.
    const yml = release();
    const steps = yml.split("\n      - name: ").slice(1);
    expect(steps.length).toBeGreaterThan(5);

    for (const step of steps) {
      const label = step.split("\n")[0] ?? "";
      const holdsToken = /^\s+GITHUB_TOKEN: /m.test(step);
      const runsBun = /\brun: bun\b/.test(step) || /\n\s+bun scripts\//.test(step);
      if (holdsToken && runsBun) {
        throw new Error(`release.yml bun step holds GITHUB_TOKEN: ${label}`);
      }
    }

    // Publish and stage are the recovery scripts; they must stay token-free.
    const publishStep = steps.find((s) => s.includes("bun scripts/publish-unpublished.ts"));
    const stageStep = steps.find((s) => s.includes("bun scripts/stage-github-releases.ts"));
    expect(publishStep, "publish step present").toBeDefined();
    expect(stageStep, "stage step present").toBeDefined();
    expect(publishStep).not.toMatch(/GITHUB_TOKEN:/);
    expect(stageStep).not.toMatch(/GITHUB_TOKEN:/);

    // Create step holds the token and must stay script-free (gh/git only).
    const createStep = steps.find((s) => s.includes("gh release create"));
    expect(createStep, "create-releases step present").toBeDefined();
    expect(createStep).toMatch(/GITHUB_TOKEN:/);
    expect(createStep).not.toMatch(/\brun: bun\b/);
    expect(createStep).not.toMatch(/\n\s+bun \S/);
  });

  it("keeps OIDC trusted publishing (no NPM_TOKEN secret)", () => {
    const yml = release();
    expect(yml).toContain("id-token: write");
    expect(yml).toContain("registry-url: https://registry.npmjs.org");
    // Comments may name NPM_TOKEN when forbidding it; the secret must not be wired.
    expect(yml).not.toMatch(/secrets\.NPM_TOKEN/);
    expect(yml).not.toMatch(/NPM_TOKEN:\s*\$\{\{/);
  });

  it("checks out full history so recovery release tags resolve to version-introducing commits", () => {
    // stage-github-releases uses `git log -S` per package version. Default
    // actions/checkout depth is 1, so the pickaxe always falls back to HEAD and
    // recovery tags point at unrelated tip work (post-merge review on #1353).
    const yml = release();
    const checkoutAt = yml.indexOf("actions/checkout@");
    expect(checkoutAt).toBeGreaterThan(-1);
    const nextUses = yml.indexOf("\n      - uses:", checkoutAt + 1);
    const checkoutBlock = nextUses === -1 ? yml.slice(checkoutAt) : yml.slice(checkoutAt, nextUses);
    expect(checkoutBlock).toMatch(/fetch-depth:\s*0/);
  });
});
