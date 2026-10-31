#!/bin/sh
# Removes worktrees flagged as finished: a worktree under .claude/worktrees/
# whose root holds a `.prunable` file is removed, and its branch deleted when
# merged, but only once every gate below proves nothing can be lost.
# Ported from AirPlay Controller's scripts/housekeeping.sh (its prune job only).
#
# build.sh calls this best-effort, so it runs whenever a build or test run
# happens. Also runnable by hand.
#
# Flag a worktree once its branch is merged, or abandoned:
#     touch .claude/worktrees/<slug>/.prunable
# A flag on a dirty or unpushed worktree is refused loudly, not obeyed.
#
# Gates (all required):
#   - not the checkout running this, and not the primary checkout
#   - no running process works out of the worktree (an editor, a build, a server)
#   - `git status --porcelain` clean apart from the marker
#   - HEAD is in origin/main, or equals its pushed upstream
#   - the branch is deleted only when merged (`git branch -d`, never -D)
#
# Usage: sh scripts/housekeeping.sh [--current <repo-root>] [--dry-run]
#   --current  the checkout to protect (default: the one this runs from)
#   --dry-run  say what would happen, touch nothing
# Env: MM2_NO_HOUSEKEEPING=1 does nothing.
set -u

[ "${MM2_NO_HOUSEKEEPING:-0}" = "1" ] && exit 0

dry_run=0
current=""
while [ $# -gt 0 ]; do
    case "$1" in
        --dry-run) dry_run=1 ;;
        --current) shift; current=${1:-} ;;
        *) echo "housekeeping: unknown arg '$1'" >&2; exit 2 ;;
    esac
    shift
done

# The common git dir is always <primary>/.git, even from a worktree.
common_dir=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0
primary=$(dirname "$common_dir")
worktrees_dir="$primary/.claude/worktrees"
[ -d "$worktrees_dir" ] || exit 0
[ -n "$current" ] || current=$(git rev-parse --show-toplevel 2>/dev/null || echo "$primary")
current=$(cd "$current" 2>/dev/null && pwd -P || echo "$current")

# One run at a time: two builds starting together must not race on the same
# worktree. shlock (macOS) reclaims the lock when its PID is dead; busy means
# another run is already doing this, so skip.
lock=/tmp/media-manager-2-housekeeping.lock
if [ "$dry_run" -eq 0 ] && [ -x /usr/bin/shlock ]; then
    /usr/bin/shlock -f "$lock" -p $$ || exit 0
    trap 'rm -f "$lock"' EXIT HUP INT TERM
fi

say() { echo "  housekeeping: $*" >&2; }

# Open = a live process running out of this path. pgrep alone also matches a
# process that only names the path in an argument (a `du` in an agent's shell),
# so each candidate must have its program or working directory inside it.
in_use() {
    for pid in $(pgrep -f "$1" 2>/dev/null); do
        cmd=$(ps -o command= -p "$pid" 2>/dev/null)
        case "$cmd" in "$1"/*) return 0 ;; esac
        cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')
        case "$cwd" in "$1" | "$1"/*) return 0 ;; esac
    done
    return 1
}

for wt in "$worktrees_dir"/*/; do
    wt=$(cd "$wt" && pwd -P)
    [ -f "$wt/.prunable" ] || continue
    name=$(basename "$wt")
    if [ "$wt" = "$current" ] || [ "$wt" = "$(cd "$primary" && pwd -P)" ]; then
        say "SKIP $name: it is the checkout running this."
        continue
    fi
    if in_use "$wt"; then
        say "SKIP $name: a running process works in it."
        continue
    fi
    dirt=$(git -C "$wt" status --porcelain 2>/dev/null | grep -v '^?? \.prunable$' || true)
    if [ -n "$dirt" ]; then
        say "SKIP $name: uncommitted changes (flag it again once clean):"
        printf '%s\n' "$dirt" | sed 's/^/      /' >&2
        continue
    fi
    merged=0
    git -C "$wt" merge-base --is-ancestor HEAD origin/main 2>/dev/null && merged=1
    if [ "$merged" -eq 0 ]; then
        up=$(git -C "$wt" rev-parse '@{upstream}' 2>/dev/null || true)
        if [ -z "$up" ] || [ "$up" != "$(git -C "$wt" rev-parse HEAD)" ]; then
            say "SKIP $name: HEAD is neither in origin/main nor pushed."
            continue
        fi
    fi
    branch=$(git -C "$wt" symbolic-ref --short HEAD 2>/dev/null || true)
    if [ "$dry_run" -eq 1 ]; then
        if [ "$merged" -eq 1 ] && [ -n "$branch" ]; then
            say "would remove $name and delete merged branch $branch."
        else
            say "would remove $name (branch kept)."
        fi
        continue
    fi
    # `worktree remove` refuses untracked files without --force; deleting the
    # marker first keeps --force out, so any other untracked file still refuses.
    rm -f "$wt/.prunable"
    if git -C "$primary" worktree remove "$wt" 2>/dev/null; then
        say "removed worktree $name."
        if [ "$merged" -eq 1 ] && [ -n "$branch" ]; then
            git -C "$primary" branch -d "$branch" >/dev/null 2>&1 && say "deleted merged branch $branch."
        fi
    else
        touch "$wt/.prunable" 2>/dev/null
        say "SKIP $name: git worktree remove refused (locked or untracked files)."
    fi
done
exit 0
