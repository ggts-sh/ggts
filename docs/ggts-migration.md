# Move ggsvelte to ggts

This runbook moves the existing repository to `ggts-sh/ggts`, publishes the
renamed packages under `@ggts-sh`, and serves the docs at `https://ggts.sh`.
The GitHub transfer preserves stars, issues, pull requests, releases and commit
history. Keep the old npm packages and domain available for existing consumers.

GitHub organization `ggts-sh` and npm organization `ggts-sh` are claimed.
The npm name `ggts` was unavailable.

## 1. Claim the names and prepare the release

- Create the **GitHub Free** organization `ggts-sh` at
  <https://github.com/organizations/plan>. Do not create a destination repository:
  the transfer creates it from the existing repository.
- Create the **public/free** npm organization `ggts-sh` at
  <https://www.npmjs.com/org/create>. GitHub and npm names are separate. A 404 or
  empty package search does not prove that a registry will grant a name.
- Confirm ownership of both organizations before changing the package scope.
- Review and test the complete rename before transferring, publishing or
  deploying. Preserve the version sequence; a rebrand does not promise a stable
  1.0 API. Keep historical changelogs and benchmark evidence truthful.
- Build the packages, run the required checks, and run `bun run compat:consumer`
  for the required rows in `support-matrix.json`. The harness packs the packages
  and checks separate Svelte and React consumers outside the workspace.
- Record the source commit, release/tag state, repository variables, secret
  **names**, branch rules, GitHub Apps and runner registrations. Never copy secret
  values into the runbook or logs.

## Consumer changes after the renamed release

Install the adapter for your application under the claimed scope (`@ggts-sh`). All seven packages keep the
same version: `spec`, `core`, `compose`, `react`, `svelte`, `cli`, and `skill`.

| Existing import or command                              | Replacement                                           |
| ------------------------------------------------------- | ----------------------------------------------------- |
| `@ggsvelte/spec`, `@ggsvelte/core`, `@ggsvelte/compose` | Matching `@ggts-sh/*` package                         |
| `@ggsvelte/react`, `@ggsvelte/svelte`                   | Matching `@ggts-sh/*` adapter                         |
| `@ggsvelte/svelte/data`                                 | `@ggts-sh/core/data` (install core when importing it) |
| `ggsvelte-render chart.json`                            | `ggts render chart.json`                              |
| Validation before rendering                             | `ggts check chart.json`                               |
| `ggsvelte-codemod`                                      | `ggts-codemod`                                        |
| `@ggsvelte/skill`                                       | `@ggts-sh/skill`; refresh any project-local copy      |

PortableSpec JSON and chart appearance editions do not change with the package
names. Keep the application lockfile. After installing the new packages, change
imports, remove the old direct dependencies, typecheck, and verify charts and
interactions in a browser. The new CLI preserves JSONL diagnostics on stderr;
`check` produces no SVG. Existing installations of the old packages keep working.

## 2. Transfer the repository and restore CI

1. Wait for active release and deployment runs to finish. Set the existing
   `NPM_PUBLISH_ENABLED` repository variable to `false` before the cutover.
2. Verify anonymous access to
   `ghcr.io/ljodea/ggsvelte/ci-runner:v1.61.1-noble`. The migration pins consumers
   to that old public image until the destination image exists. Its manifest
   digest at the September 8, 2026 check was
   `sha256:18bfa97ec372d36b97d4993ec5d185d971c86523d74300f8d94ab5b867d5dc1e`.
3. In repository **Settings → General → Transfer**, select `ggts-sh` and set
   the repository name to `ggts`. Use this transfer, not a new initial commit.
4. Update local clones with
   `git remote set-url origin git@github.com:ggts-sh/ggts.git`. Verify an old
   commit, tag, issue and pull request through both old and new URLs. Confirm
   the star count and branch rules. Do not recreate `ljodea/ggsvelte`: that
   removes GitHub's redirect.
5. Verify organization Actions permissions, Codecov and review-app access,
   deployment environments and secret/variable names. The source repository had no
   registered self-hosted runners at cutover, and its nightly job was pending.
   Benchmark, eval and nightly workflows now use standard GitHub-hosted runners.
6. Trigger the destination CI image publisher with a reviewed change to
   `.github/workflows/build-ci-image.yml` on main. It has no manual dispatch
   trigger by design. Confirm the new package is public and can be pulled
   without credentials, then restore consumer image URLs to
   `ghcr.io/${{ github.repository }}/ci-runner:<tag>` in a follow-up change.
7. Run destination PR CI before restoring publication. GitHub Container
   Registry packages do not move to the new owner with the repository.

## 3. Bootstrap npm once, then restore OIDC

New scoped package names are new registry entries. Neither npm trusted
publishing nor npm staged publishing can create a package that does not exist.
Use the one-time maintainer procedure established in
[ADR 0023](decisions/0023-skill-package.md); do not add an npm token to CI.

1. Build and inspect real tarballs from the reviewed cutover commit. Check the
   package names, version, exports, executable bins, internal dependencies and
   `repository.url` (`git+https://github.com/ggts-sh/ggts.git`). Publish these
   artifacts, not placeholder packages. Test the tarballs in fresh consumers.
2. The maintainer uses `npm login` and 2FA on their workstation. Publish each
   tarball with `npm publish <tarball> --access public --no-provenance`, in
   dependency order: spec, core, compose, then svelte/react/cli; skill has no
   runtime dependencies. Keep all seven at the reviewed fixed-group version.
   The explicit CLI flag is required: `NPM_CONFIG_PROVENANCE=false` does not
   override `publishConfig.provenance: true`.
3. For each package, add a trusted publisher in npm package settings with
   organization `ggts-sh`, repository `ggts`, workflow filename `release.yml`,
   and permission for **direct `npm publish`**. New publisher settings default
   to staged publishing; stage-only permission does not fit this release job.
4. Verify every intended version exists and installs. Configure publishing
   access to require 2FA and disallow tokens. Restore `NPM_PUBLISH_ENABLED=true`.
5. Verify the next version publishes through OIDC with provenance. The bootstrap
   version has no CI provenance and cannot be republished. Remove obsolete
   publisher connections after the destination publication succeeds.
6. Deprecate each old `@ggsvelte/*` package with its replacement and migration
   URL after the new packages work. Do not unpublish old versions or create a
   second maintained implementation under the old scope.

## 4. Move the public domain

Reuse Cloudflare Pages project **`ggsvelte`** and its GitHub Actions direct-upload
workflow. The internal project name does not need to match the public brand.

1. Add `ggts.sh` to the existing project's **Custom domains** and wait for active
   DNS and TLS. A DNS CNAME without a Pages custom-domain association is not
   sufficient. Keep the old domain registered.
2. Deploy the reviewed docs artifact with canonical URLs, sitemap, robots,
   social metadata and links set to `https://ggts.sh`. Keep the existing
   `/ggsvelte` path redirects, pointing to the new origin.
3. Set domain redirects from `ggsvelte.sh`, `www.ggsvelte.sh`,
   `ggsvelte.pages.dev` and `www.ggts.sh` to `https://ggts.sh`. Preserve path
   suffixes and query strings. Do not match Pages preview subdomains: the
   deployment smoke checks must reach each immutable artifact.
4. Run `bun run build:cloudflare` and the deployment smoke commands against
   production. Check `/`, a guide, an example, `/sitemap.xml`, `/robots.txt`,
   a legacy `/ggsvelte/...` path and a redirect with a query string. Inspect
   response status, Location, canonical URL, loaded assets and browser errors.
5. Keep the last working Pages deployment available for rollback. If a smoke
   fails, restore that artifact and the preceding redirect configuration before
   announcing the new domain. A code rollback does not undo npm publications.

## Platform references

- [GitHub repository transfers](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository)
- [GitHub Free organization features](https://docs.github.com/en/get-started/learning-about-github/githubs-plans)
- [GitHub package transfer permissions](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages)
- [npm public organizations](https://docs.npmjs.com/organizations/)
- [npm scope transfers](https://docs.npmjs.com/transferring-a-package-from-a-user-account-to-another-user-account/)
- [npm trusted publisher prerequisites](https://docs.npmjs.com/cli/v11/commands/npm-trust/)
- [npm trusted publisher permissions](https://docs.npmjs.com/trusted-publishers/)
- [npm staged publishing prerequisites](https://docs.npmjs.com/staged-publishing/)
- [Cloudflare Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Cloudflare Pages domain redirects](https://developers.cloudflare.com/pages/how-to/redirect-to-custom-domain/)
