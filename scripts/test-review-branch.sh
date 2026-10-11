#!/usr/bin/env bash
# Tests for scripts/review-branch.sh across review rounds: merging origin/main
# in must not use a round or widen round 2, anything else after round 2 must
# keep refusing.
# Builds a throwaway origin and clone, runs the script from THIS checkout with
# cwd in the clone and GH pointed at a stub that keeps comments and statuses
# in files.
#
# Usage: bash scripts/test-review-branch.sh

set -uo pipefail   # deliberately NOT -e: a case failing must not stop the rest

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REVIEW="$REPO_DIR/scripts/review-branch.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 REPO=test/repo
export GH="$TMP_DIR/gh-stub" STUB="$TMP_DIR/stub"

FAILURES=0
fail() { echo "FAIL: $1" >&2; FAILURES=$((FAILURES + 1)); }
ok()   { echo "  ok - $1"; }

# The stub answers the four gh calls the script makes.
cat > "$GH" <<'EOF'
#!/bin/bash
case "$1 $2" in
  "pr view") cat "$STUB/pr" ;;
  "api --paginate") cat "$STUB/comments" ;;
  "pr comment") { cat "$5"; echo; } >> "$STUB/comments" ;;
  "api repos/"*)
    sha=${2##*/}; st=""; desc=""
    for a in "$@"; do
      case "$a" in state=*) st=${a#state=} ;; description=*) desc=${a#description=} ;; esac
    done
    echo "$sha $st $desc" >> "$STUB/statuses" ;;
  *) echo "gh stub: unexpected call: $*" >&2; exit 1 ;;
esac
EOF
chmod +x "$GH"

W="$TMP_DIR/work tree"
g() { git -C "$W" "$@"; }
commit_file() { printf "$2" > "$W/$1"; g add -A; g commit -qm "$3"; }
on_main() { g checkout -q main; commit_file "$@"; g push -q origin main; g checkout -q feature; }
head_sha() { g rev-parse HEAD; }

# A PR whose round 2 reviewed the current HEAD. changes= never matches, so
# only the main-merge handling can avoid a round.
setup() {
  rm -rf "$TMP_DIR/origin.git" "$W" "$STUB"
  mkdir -p "$STUB" "$W"
  git init -q --bare -b main "$TMP_DIR/origin.git"
  g init -q -b main
  g config user.email t@t; g config user.name t
  g remote add origin "$TMP_DIR/origin.git"
  mkdir -p "$W/docs/review"
  cp "$REPO_DIR"/docs/review/*.md "$W/docs/review/"
  cp "$REPO_DIR/AGENTS.md" "$W/AGENTS.md"
  echo .review-pending/ > "$W/.gitignore"
  printf 'one\ntwo\nthree\n' > "$W/a.txt"; echo b > "$W/b.txt"
  g add -A; g commit -qm base; g push -q origin main
  g checkout -q -b feature
  commit_file a.txt 'one\nTWO-feature\nthree\n' feature
  echo 7 > "$STUB/pr"
  printf '<!-- agent-review round=1 head=%s level=cheap high=1 changes=old -->\n## Review: cheap, round 1\n\n' "$(g rev-parse HEAD~1)" > "$STUB/comments"
  # x=1 sorts this line after any later round=2 marker in a whole-line sort,
  # so only an order-keeping sort picks the newer marker.
  printf '<!-- agent-review round=2 x=1 head=%s level=cheap high=0 changes=seeded -->\n## Review: cheap, round 2\n\n' "$(head_sha)" >> "$STUB/comments"
  : > "$STUB/statuses"
}
run_review() { OUT="$(cd "$W" && /bin/bash "$REVIEW" "$@" 2>&1)"; RC=$?; }
comment_count() { grep -c '^<!-- agent-review' "$STUB/comments"; }
expect_rc() {
  [ "$RC" -eq "$2" ] && return 0
  fail "$1: exit $RC, wanted $2"; printf '%s\n' "$OUT" | sed 's/^/    /' >&2; return 1
}
expect_status() {
  local last; last=$(tail -n 1 "$STUB/statuses")
  case "$last" in "$(head_sha) $2"*) return 0 ;; esac
  fail "$1: last status '$last', wanted $2 on $(head_sha)"; return 1
}

# Clean main merge after round 2: the round 2 status goes on the merge, no
# comment, no round. Breaks if a main merge is treated as the branch's own code.
setup
on_main b.txt 'b2\n' main-change
g merge -q --no-edit origin/main
run_review
expect_rc "clean main merge" 0 && expect_status "clean main merge" success \
  && { [ "$(comment_count)" = 2 ] || fail "clean main merge posted a comment"; } && ok "clean main merge re-posts round 2's status"

# Conflicted main merge after round 2: one merge-resolution pass over the
# resolution only; --continue records it at round 2 and posts the status.
# Breaks if the pass is skipped, reviews main's own changes, or uses a round.
setup
on_main a.txt 'one\nTWO-main\nthree\n' main-conflict
on_main b.txt 'b-unrelated-main-line\n' main-other
g merge -q --no-edit origin/main > /dev/null
printf 'one\nTWO-both\nthree\n' > "$W/a.txt"; g add -A; g commit -qm merge
run_review
passes=$(printf '%s\n' "$OUT" | grep -c ' save reply to=')
prompt=$(printf '%s\n' "$OUT" | sed -n 's/^merge-resolution .* prompt=\(.*\)  save reply to=.*/\1/p')
reply=$(printf '%s\n' "$OUT" | sed -n 's/^merge-resolution .* save reply to=//p')
if expect_rc "conflicted main merge" 3; then
  if [ "$passes" != 1 ] || [ -z "$reply" ]; then fail "conflicted main merge: wanted one merge-resolution pass, got: $OUT"
  elif ! grep -q 'TWO-both' "$prompt" || grep -q 'b-unrelated-main-line' "$prompt"; then fail "conflicted main merge: prompt is not just the resolution"
  else ok "conflicted main merge prints one merge-resolution pass"
  fi
  echo 'NO FINDINGS' > "$reply"
  run_review --continue
  last=$(grep '^<!-- agent-review' "$STUB/comments" | tail -n 1)
  expect_rc "merge check --continue" 0 && expect_status "merge check --continue" success \
    && case "$last" in *"round=2 head=$(head_sha) level=merge-check "*) ok "--continue posts the status and keeps round 2" ;;
         *) fail "merge check marker: $last" ;; esac
  # A later clean merge starts from the merge check's head, not round 2's.
  on_main b.txt 'b3\n' main-later
  g merge -q --no-edit origin/main
  run_review
  expect_rc "clean merge after a merge check" 0 && expect_status "clean merge after a merge check" success \
    && ok "a later clean merge reads the merge check's marker"
fi

# A HIGH from the merge-resolution pass fails the status.
setup
on_main a.txt 'one\nTWO-main\nthree\n' main-conflict
g merge -q --no-edit origin/main > /dev/null
printf 'one\nTWO-feature\nTWO-main\nthree\n' > "$W/a.txt"; g add -A; g commit -qm merge
run_review
reply=$(printf '%s\n' "$OUT" | sed -n 's/^merge-resolution .* save reply to=//p')
if expect_rc "duplicating merge" 3; then
  echo 'HIGH | a.txt:2 | both sides of the conflict were kept; drop TWO-feature.' > "$reply"
  run_review --continue
  expect_rc "duplicating merge --continue" 1 && expect_status "duplicating merge --continue" failure \
    && ok "a HIGH on the resolution fails the status"
fi

# Round 2 after a clean main merge reviews only the branch's own fix, not
# what main gained since round 1. Breaks if round 2 diffs from round 1's head.
setup
printf '<!-- agent-review round=1 head=%s level=cheap high=1 changes=old -->\n## Review: cheap, round 1\n\n' "$(head_sha)" > "$STUB/comments"
on_main b.txt 'b-unrelated-main-line\n' main-other
g merge -q --no-edit origin/main
commit_file a.txt 'one\nTWO-fix\nthree\n' own-fix
# Main moving on after the branch's last merge must not show up reversed.
on_main c.txt 'c-newer-main-line\n' main-newer
run_review
prompt=$(printf '%s\n' "$OUT" | sed -n 's/^cheap .* prompt=\(.*\)  save reply to=.*/\1/p')
if expect_rc "round 2 after a main merge" 3; then
  if ! printf '%s\n' "$OUT" | grep -q 'round 2$' || [ -z "$prompt" ]; then fail "round 2 after a main merge: wanted one cheap round 2 pass, got: $OUT"
  elif ! grep -q 'TWO-fix' "$prompt" || grep -q 'b-unrelated-main-line' "$prompt" || grep -q 'c-newer-main-line' "$prompt"; then fail "round 2 after a main merge: prompt is not just the fix"
  elif [ "$(g cat-file -t "$(sed -n 's/^base: \([0-9a-f]*\) tip: .*/\1/p' "$prompt")" 2>/dev/null)" != commit ]; then fail "round 2 after a main merge: the base is not a commit the history pass can blame"
  else ok "round 2 after a main merge reviews only the fix"
  fi
fi

# Round 2 after a conflicted main merge: the base is round 1's head with main
# merged in, conflict markers and all, so the prompt holds the branch's
# resolution and its fix and nothing of main's. Breaks if merge-tree's exit 1
# (conflicts) is taken as a failure and the base falls back to round 1's head.
setup
printf '<!-- agent-review round=1 head=%s level=cheap high=1 changes=old -->\n## Review: cheap, round 1\n\n' "$(head_sha)" > "$STUB/comments"
on_main a.txt 'one\nTWO-main\nthree\n' main-conflict
on_main b.txt 'b-unrelated-main-line\n' main-other
g merge -q --no-edit origin/main > /dev/null
printf 'one\nTWO-both\nthree\n' > "$W/a.txt"; g add -A; g commit -qm merge
commit_file a.txt 'one\nTWO-both\nthree-fix\n' own-fix
run_review
prompt=$(printf '%s\n' "$OUT" | sed -n 's/^cheap .* prompt=\(.*\)  save reply to=.*/\1/p')
if expect_rc "round 2 after a conflicted main merge" 3; then
  if ! printf '%s\n' "$OUT" | grep -q 'round 2$' || [ -z "$prompt" ]; then fail "round 2 after a conflicted main merge: wanted one cheap round 2 pass, got: $OUT"
  elif printf '%s\n' "$OUT" | grep -q 'could not merge main'; then fail "round 2 after a conflicted main merge: warned that main could not be merged"
  elif ! grep -q 'TWO-both' "$prompt" || ! grep -q 'three-fix' "$prompt" || grep -q 'b-unrelated-main-line' "$prompt"; then fail "round 2 after a conflicted main merge: prompt is not the resolution and the fix"
  else ok "round 2 after a conflicted main merge reviews the resolution and the fix"
  fi
fi

# Size count: review data under .impeccable/ and .claude/ does not count as
# product lines, .claude/hooks/ does, and settings.json is still a risk path.
# Breaks if *.json pulls them back in or settings.json leaves is_risk_path.
setup
: > "$STUB/comments"
mkdir -p "$W/.impeccable/review" "$W/.claude/hooks"
printf '{"line": %s}\n' $(seq 60) > "$W/.impeccable/review/case.json"
printf '{"a": %s}\n' $(seq 5) > "$W/.claude/settings.json"
printf '#!/bin/sh\nexit 0\n' > "$W/.claude/hooks/guard.sh"
g add -A; g commit -qm data
run_review
case "$OUT" in *"Review level: full (2 product lines, risk: .claude/hooks/guard.sh, .claude/settings.json), round 1"*) ok ".impeccable/ and .claude/ data stay out of the size count" ;;
  *) fail "size count: wanted 2 product lines from the hook only and settings.json as a risk path, got: $(printf '%s\n' "$OUT" | grep '^Review level')" ;; esac

# A commit of the branch's own after round 2 still refuses.
setup
on_main b.txt 'b2\n' main-change
g merge -q --no-edit origin/main
commit_file a.txt 'one\nTWO-feature-again\nthree\n' own-change
run_review
expect_rc "own commit after round 2" 1 \
  && { printf '%s\n' "$OUT" | grep -q 'two rounds done' || fail "own commit: no refusal message"; } \
  && { [ -s "$STUB/statuses" ] && fail "own commit posted a status" || ok "an own commit after round 2 refuses"; }

# Rebased onto main (round 2's head is no longer an ancestor): refuses as before.
setup
on_main b.txt 'b2\n' main-change
g rebase -q origin/main
run_review
expect_rc "rebase after round 2" 1 \
  && { printf '%s\n' "$OUT" | grep -q 'two rounds done' || fail "rebase: no refusal message"; } \
  && ok "a rebase after round 2 refuses"

if [ "$FAILURES" -gt 0 ]; then
  echo "$FAILURES review-branch test(s) FAILED" >&2
  exit 1
fi
echo "all review-branch tests passed"
