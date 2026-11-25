#!/usr/bin/env bash
# pre-commit guard: generated visual output must not be newly committed on an
# ordinary branch. `pre-commit run --all-files` also passes clean, tracked
# baselines, so only intersect the hook arguments with the staged diff.
#
# Screenshot baselines may land when:
# - branch is vr-update/pr-<n> (legacy approve flow), OR
# - the same commit also stages render-relevant non-baseline paths (same-PR
#   smoke update: packages/, examples/, tests/visual/ excluding
#   __screenshots__/, or apps/docs render surface). Pure content-only docs
#   paths do not qualify.
set -euo pipefail

branch="${GITHUB_HEAD_REF:-${GITHUB_REF_NAME:-}}"
if [[ -z "${branch}" ]]; then
  branch="$(git symbolic-ref --quiet --short HEAD || true)"
fi

staged="$(git diff --cached --name-only --diff-filter=ACMR --)"

# True when staged set includes a path that may legitimately change smoke pixels.
has_render_relevant=0
while IFS= read -r path; do
  [[ -z "${path}" ]] && continue
  case "${path}" in
    tests/visual/__screenshots__/*) continue ;;
    packages/* | examples/* | tests/visual/*)
      has_render_relevant=1
      break
      ;;
    # Fail-closed render-ish apps/docs: exclude known content-only catalogs.
    apps/docs/src/lib/catalog/* | apps/docs/src/lib/guide.ts | apps/docs/src/lib/generated/*)
      continue
      ;;
    apps/docs/*)
      has_render_relevant=1
      break
      ;;
  esac
done <<EOF
${staged}
EOF

blocked=()
record_blocked() {
  local f="$1"
  # Baseline updates: legacy bot branch, or same-PR with render-relevant paths.
  if [[ "${f}" =~ ^tests/visual/__screenshots__/ ]]; then
    if [[ "${branch}" =~ ^vr-update/pr-[0-9]+$ ]] || [[ "${has_render_relevant}" -eq 1 ]]; then
      return
    fi
  fi
  blocked+=("${f}")
}

batch_matches=0
if [[ $# -gt 1 ]]; then
  batch_matches=1
  for f in "$@"; do
    # Keep empty and multiline arguments in the per-argument matcher.
    if [[ -z "${f}" || "${f}" == *$'\n'* ]]; then
      batch_matches=0
      break
    fi
  done
fi

if [[ "${batch_matches}" -eq 1 ]]; then
  if arguments="$(printf '%s\n' "$@")" &&
    matches="$({ grep -aFxf /dev/fd/3 || [[ $? -eq 1 ]]; } 2>/dev/null 3<<< "${staged}" <<< "${arguments}")"; then
    if [[ -n "${matches}" ]]; then
      while IFS= read -r f; do
        record_blocked "${f}"
      done <<< "${matches}"
    fi
  else
    batch_matches=0
  fi
fi
if [[ "${batch_matches}" -eq 0 ]]; then
  for f in "$@"; do
    match_status=0
    { grep -Fqx -- "${f}" || match_status=$?; } <<< "${staged}" || match_status=2
    case "${match_status}" in
      0) record_blocked "${f}" ;;
      1) ;;
      *)
        printf 'Could not verify staged output path: %s\n' "${f}" >&2
        exit 1
        ;;
    esac
  done
fi

if [[ ${#blocked[@]} -eq 0 ]]; then
  exit 0
fi

# printf (not echo) so paths and ASCII-only messages are portable across
# locales and shells; keep the full blocked list on stderr for tests and
# operators.
printf '%s\n' "BLOCKED: generated output paths must not be committed:" >&2
for f in "${blocked[@]}"; do
  printf '  %s\n' "${f}" >&2
done
printf '%s\n' "Unstage them (git restore --staged <path>) — VR baselines need a vr-update/pr-<n> branch or same-PR render-relevant code under packages/, examples/, tests/visual/, or apps/docs render paths." >&2
exit 1
