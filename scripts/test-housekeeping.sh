#!/usr/bin/env bash
# Tests for scripts/housekeeping.sh: which flagged worktrees it removes and which it keeps. Builds a throwaway repo
# with its own origin/main and worktrees, flags them, runs the script from the primary checkout, then checks.
#
# Usage: scripts/test-housekeeping.sh

set -uo pipefail   # deliberately NOT -e: a case failing must not stop the rest

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/housekeeping.sh"
TMP_DIR="$(cd "$(mktemp -d)" && pwd -P)"
trap 'rm -rf "$TMP_DIR"' EXIT
export MM2_NO_HOUSEKEEPING=0

FAILURES=0
fail() { echo "FAIL: $1" >&2; FAILURES=$((FAILURES + 1)); }
ok()   { echo "  ok — $1"; }

repo="$TMP_DIR/repo"
wts="$repo/.claude/worktrees"
mkdir -p "$repo"
cd "$repo" || exit 1
git init -q -b main
git config user.email test@example.com
git config user.name test
echo '.claude/worktrees/' > .gitignore
git add -A && git commit -qm base
git init -q --bare "$TMP_DIR/origin.git"
git remote add origin "$TMP_DIR/origin.git"
git push -q origin main

add() { git worktree add -q -b "$1" "$wts/$1" main && touch "$wts/$1/.prunable"; }
add merged
add dirty;    echo x > "$wts/dirty/new.txt"
add unpushed; git -C "$wts/unpushed" commit -q --allow-empty -m local
add pushed;   git -C "$wts/pushed" commit -q --allow-empty -m pushed
git -C "$wts/pushed" push -q -u origin pushed
add current
git worktree add -q -b unflagged "$wts/unflagged" main

sh "$SCRIPT" --dry-run --current "$wts/current" 2>/dev/null
[ -f "$wts/merged/.prunable" ] && [ -d "$wts/merged" ] && ok "--dry-run removes nothing" || fail "--dry-run removed a worktree"

out=$(sh "$SCRIPT" --current "$wts/current" 2>&1)

[ ! -d "$wts/merged" ] && ok "merged and clean: removed" || fail "merged and clean worktree kept: $out"
git show-ref -q --verify refs/heads/merged && fail "merged branch not deleted" || ok "merged branch deleted"
[ -d "$wts/dirty" ] && [ -f "$wts/dirty/new.txt" ] && ok "uncommitted file: kept" || fail "worktree with an uncommitted file removed"
[ -d "$wts/unpushed" ] && ok "unmerged and unpushed: kept" || fail "unpushed worktree removed"
[ ! -d "$wts/pushed" ] && ok "pushed but unmerged: removed" || fail "pushed worktree kept: $out"
git show-ref -q --verify refs/heads/pushed && ok "unmerged branch kept" || fail "unmerged branch deleted"
[ -d "$wts/current" ] && ok "the checkout running it: kept" || fail "current checkout removed"
[ -d "$wts/unflagged" ] && ok "no marker: kept" || fail "unflagged worktree removed"

if [ "$FAILURES" -gt 0 ]; then echo "housekeeping: $FAILURES failure(s)" >&2; exit 1; fi
echo "housekeeping: all cases passed"
