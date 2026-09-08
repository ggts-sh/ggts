#!/usr/bin/env bash
# pre-commit guard: hand-written code files must stay <= 500 LOC.
#
# Policy (see CONTRIBUTING.md "File size limit"):
# - Scope: git-tracked *.ts *.tsx *.js *.mjs *.cjs *.svelte, excluding spikes/
#   (repo-wide hook convention). Physical lines via awk NR — a missing final
#   newline still counts, blank lines and comments count.
# - Files whose first 5 lines contain both a generator marker ("generat…")
#   and "do not edit" (case-insensitive) are generated artifacts — their
#   regenerators own their size — and are exempt without any list entry.
# - Everything else over the limit must be listed in
#   scripts/guards/max-loc-exclusions.txt as `<path> <baseline-LOC> # reason`.
#   The list is a RATCHET, not a waiver, anchored to the committed version:
#   a listed file may not exceed its baseline, baselines may only decrease
#   vs HEAD, new entries are never allowed, and entries whose file is deleted
#   or shrank under the limit are STALE and fail the guard until pruned.
#
# Portability: written for stock macOS bash 3.2 (no declare -A, no GNU grep
# -z); counting, generated detection, and classification run in one awk pass.
#
# Invocation:
# - pre-commit passes staged filenames as arguments (works for both the local
#   hook and CI's `pre-commit run --all-files`).
# - `--all` audits every tracked in-scope file in the tree.
set -euo pipefail

LIMIT=500
ROOT="$(git rev-parse --show-toplevel)"
LIST_REL_DEFAULT="scripts/guards/max-loc-exclusions.txt"
LIST="${MAX_LOC_EXCLUSIONS:-$ROOT/$LIST_REL_DEFAULT}"
LIST_REL="${LIST#"$ROOT"/}" # relative to repo root (git show path)
SEP=$'\034'                 # file separator — cannot appear in repo paths

all_files=0
if [[ "${1:-}" == "--all" ]]; then
  all_files=1
elif [[ $# -eq 0 ]]; then
  printf '%s\n' "usage: max-loc.sh [--all | <file>...]" >&2
  exit 2
fi

# ---- exclusion-list parsing (bash: validation) ----------------------------
# parse_exclusions <list-file> — validates the list and fills the global
# target arrays selected by PARSE_TARGET ("EXCL" -> EXCL_PATH/EXCL_LOC,
# "HEAD" -> HEAD_PATH/HEAD_LOC). No eval indirection: bash 3.2 safe.
PARSE_TARGET="EXCL"
parse_exclusions() { # <list-file>
  local file="$1" line entry path baseline extra i
  if [[ ! -f "${file}" ]]; then
    printf '%s\n' "MAX-LOC: exclusion list missing: ${file} (create it, even if empty)" >&2
    exit 1
  fi
  local -a paths=() locs=()
  while IFS= read -r line || [[ -n "${line}" ]]; do
    [[ -z "${line//[[:space:]]/}" ]] && continue            # blank
    [[ "${line}" =~ ^[[:space:]]*# ]] && continue            # comment
    entry="${line%%#*}"                                      # strip reason
    read -r path baseline extra <<<"${entry}"
    if [[ -z "${path:-}" || -z "${baseline:-}" || -n "${extra:-}" ]] \
      || ! [[ "${baseline}" =~ ^[0-9]+$ ]]; then
      printf '%s\n' "MAX-LOC: malformed exclusion entry (want '<path> <baseline-LOC> # reason'): ${line}" >&2
      exit 1
    fi
    for i in ${paths[@]+"${!paths[@]}"}; do
      if [[ "${paths[$i]}" == "${path}" ]]; then
        printf '%s\n' "MAX-LOC: duplicate exclusion entry: ${path}" >&2
        exit 1
      fi
    done
    paths+=("${path}")
    locs+=("${baseline}")
  done <"${file}"
  if [[ "${PARSE_TARGET}" == "EXCL" ]]; then
    EXCL_PATH=(); EXCL_LOC=()
    for i in ${paths[@]+"${!paths[@]}"}; do
      EXCL_PATH+=("${paths[$i]}"); EXCL_LOC+=("${locs[$i]}")
    done
  else
    HEAD_PATH=(); HEAD_LOC=()
    for i in ${paths[@]+"${!paths[@]}"}; do
      HEAD_PATH+=("${paths[$i]}"); HEAD_LOC+=("${locs[$i]}")
    done
  fi
}

parse_exclusions "${LIST}"


# ---- ratchet anchor: baselines may only decrease vs the anchor ------------
# Local hook runs: anchor is HEAD (each commit re-anchors, so squashed PRs
# cannot smuggle a raised baseline past history). CI `--all-files` runs the
# committed checkout where HEAD == working tree, so there the anchor is the
# merge base with the PR base branch (GITHUB_BASE_REF), falling back to HEAD
# when the base ref is unavailable (shallow checkout, same-branch push).
# Fresh repos with no commit: nothing to anchor against yet.
ratchet_violations=()
ANCHOR_REF="HEAD"
if [[ -n "${GITHUB_BASE_REF:-}" ]]; then
  # CI pull_request run: the ratchet MUST anchor to the PR base — falling
  # back to HEAD would compare the list with itself. Fail closed when the
  # base history is unavailable (see ci-checks.yml fetch-depth: 0).
  if ! ANCHOR_REF="$(git merge-base HEAD "refs/remotes/origin/${GITHUB_BASE_REF}" 2>/dev/null)" \
    || [[ -z "${ANCHOR_REF}" ]]; then
    printf '%s\n' "MAX-LOC: cannot anchor the exclusion ratchet to base '${GITHUB_BASE_REF}' (shallow checkout?). Fetch full history in CI." >&2
    exit 1
  fi
fi
if git rev-parse --verify -q "${ANCHOR_REF}" >/dev/null 2>&1 \
  && git cat-file -e "${ANCHOR_REF}:${LIST_REL}" 2>/dev/null; then
  HEAD_LIST="$(mktemp "${TMPDIR:-/tmp}/max-loc-head.XXXXXX")"
  git show "${ANCHOR_REF}:${LIST_REL}" >"${HEAD_LIST}" 2>/dev/null || true
  PARSE_TARGET="HEAD"
  parse_exclusions "${HEAD_LIST}"
  PARSE_TARGET="EXCL"
  rm -f "${HEAD_LIST}"
  moved_head=()
  wt_i=0
  for wt_path in ${EXCL_PATH[@]+"${EXCL_PATH[@]}"}; do
    head_base=""
    for h_i in ${HEAD_PATH[@]+"${!HEAD_PATH[@]}"}; do
      if [[ "${HEAD_PATH[$h_i]}" == "${wt_path}" ]]; then
        head_base="${HEAD_LOC[$h_i]}"
        break
      fi
    done
    # An unchanged file may move packages without resetting its baseline.
    if [[ -z "${head_base}" && -f "${wt_path}" ]]; then
      wt_blob="$(git hash-object -- "${wt_path}")"
      for h_i in ${HEAD_PATH[@]+"${!HEAD_PATH[@]}"}; do
        old_path="${HEAD_PATH[$h_i]}"
        if [[ ! -e "${old_path}" && "${moved_head[$h_i]:-0}" == 0 ]] \
          && [[ "$(git rev-parse "${ANCHOR_REF}:${old_path}" 2>/dev/null)" == "${wt_blob}" ]]; then
          head_base="${HEAD_LOC[$h_i]}"
          moved_head[$h_i]=1
          break
        fi
      done
    fi
    if [[ -z "${head_base}" ]]; then
      ratchet_violations+=("${wt_path}: NEW exclusion entry (refactor instead)")
    elif [[ "${EXCL_LOC[$wt_i]}" -gt "${head_base}" ]]; then
      ratchet_violations+=("${wt_path}: baseline raised ${head_base} -> ${EXCL_LOC[$wt_i]}")
    fi
    wt_i=$((wt_i + 1))
  done
fi

# ---- collect candidate files --------------------------------------------
declare -a files=()
collect() { # <path> — filter by scope, append to files
  # Deleted paths (renames, stale HEAD-list entries) are handled by the
  # stale-entry audit below — never handed to awk.
  [[ -f "$1" ]] || return 0
  case "$1" in
    spikes/*) ;;
    *.ts|*.tsx|*.js|*.mjs|*.cjs|*.svelte) files+=("$1") ;;
  esac
}
if [[ "${all_files}" -eq 1 ]]; then
  while IFS= read -r -d '' f; do
    collect "${f}"
  done < <(git ls-files -z)
else
  for f in "$@"; do
    collect "${f}"
  done
fi
# The ratchet is only as strong as the audit behind it: whenever the guard
# runs at all, the pinned files participate (cheap — one awk pass). A commit
# that edits ONLY the list (prune/lower) still re-audits the affected files,
# and --all already contains them via git ls-files.
for f in ${EXCL_PATH[@]+"${EXCL_PATH[@]}"} \
  ${HEAD_PATH[@]+"${HEAD_PATH[@]}"}; do
  collect "${f}"
done

# ---- single awk pass: count lines, detect generated, classify -------------
# Classification outcomes:
#   STALE   <path> <loc>        listed file now <= limit (prune the entry)
#   RATCHET <path> <loc> <base>  listed file grew past its baseline
#   OVER    <path> <loc>        unlisted hand-written file over the limit
declare -a stale=() ratchet=() over=()
if [[ ${#files[@]} -gt 0 ]]; then
  while IFS="${SEP}" read -r kind f a b; do
    case "${kind}" in
      STALE) stale+=("${f} (${a} <= ${LIMIT})") ;;
      RATCHET) ratchet+=("${f}: ${a} > baseline ${b}") ;;
      OVER) over+=("${f}: ${a} lines") ;;
    esac
  done < <(awk -v SEP="${SEP}" -v limit="${LIMIT}" -v listfile="${LIST}" '
    BEGIN {
      while ((getline line < listfile) > 0) {
        sub(/#.*/, "", line)
        gsub(/^[ \t]+|[ \t]+$/, "", line)
        if (line == "") continue
        n = split(line, f, /[ \t]+/)
        if (n >= 2) BASE[f[1]] = f[2]
      }
      close(listfile)
    }
    function classify(p, c, g) {
      if (p in BASE && g) {
        print "STALE" SEP p SEP c
        return
      }
      if (c <= limit) {
        if (p in BASE) print "STALE" SEP p SEP c
        return
      }
      if (g) return
      if (p in BASE) {
        if (c + 0 > BASE[p] + 0) print "RATCHET" SEP p SEP c SEP BASE[p]
      } else {
        print "OVER" SEP p SEP c
      }
    }
    FNR == 1 {
      if (prev != "") classify(prev, count, gen)
      prev = FILENAME; count = 0; gen = 0; saw_gen = 0; saw_dne = 0
    }
    FNR <= 5 {
      h = tolower($0)
      if (h ~ /generat/) saw_gen = 1
      if (h ~ /do not edit/) saw_dne = 1
      gen = saw_gen && saw_dne
    }
    { count++ }
    END { if (prev != "") classify(prev, count, gen) }
  ' "${files[@]}")
fi

# Listed-but-deleted or now-empty files never hit awk's classifier; audit the
# list itself so those entries fail even when nothing else changed.
for f in ${EXCL_PATH[@]+"${EXCL_PATH[@]}"}; do
  if [[ ! -s "${f}" ]]; then
    if [[ ! -f "${f}" ]]; then
      stale+=("${f} (deleted)")
    else
      stale+=("${f} (empty)")
    fi
  fi
done

fail=0
if [[ ${#ratchet_violations[@]} -gt 0 ]]; then
  printf '%s\n' "MAX-LOC: the exclusion list is a ratchet — vs HEAD:" >&2
  printf '  %s\n' "${ratchet_violations[@]}" >&2
  fail=1
fi
if [[ ${#stale[@]} -gt 0 ]]; then
  printf '%s\n' "MAX-LOC: stale exclusion entries — prune these lines from ${LIST_REL_DEFAULT}:" >&2
  printf '  %s\n' "${stale[@]}" >&2
  fail=1
fi
if [[ ${#ratchet[@]} -gt 0 ]]; then
  printf '%s\n' "MAX-LOC: files grew past their exclusion baseline (fix the regression, do not raise the baseline):" >&2
  printf '  %s\n' "${ratchet[@]}" >&2
  fail=1
fi
if [[ ${#over[@]} -gt 0 ]]; then
  printf '%s\n' "MAX-LOC: hand-written code files over ${LIMIT} lines:" >&2
  printf '  %s\n' "${over[@]}" >&2
  printf '%s\n' "Split the file by responsibility. Legacy oversize files live in ${LIST_REL_DEFAULT} (ratchet-only); do not add new entries without a refactor plan." >&2
  fail=1
fi
exit "${fail}"
