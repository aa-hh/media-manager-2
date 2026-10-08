#!/bin/sh
# The one way tests run in this repo. Hooks, agents and humans all call this,
# never the bare test command, so how tests run is decided in one place.
#
# Usage: sh scripts/test.sh [--full] [extra args passed to the test runner]
#   (no flag)  the fast run Guard 4 uses at commit
#   --full     the full suite; pre-push runs it (this repo has no CI)
#   --review-script  check the review script with macOS Bash
#
# Fill in the two commands below for your stack.
set -eu
cd "$(dirname "$0")/.."

if [ "${1:-}" = --review-script ]; then
    # Restoring the heredoc command substitution breaks parsing on macOS Bash.
    /bin/bash -n scripts/review-branch.sh
    if output=$(/bin/bash scripts/review-branch.sh --invalid-review-script-argument 2>&1); then
        status=0
    else
        status=$?
    fi
    if [ "$status" -ne 2 ]; then
        printf 'review script: expected exit 2, got %s\n%s\n' "$status" "$output" >&2
        exit 1
    fi
    if ! printf '%s\n' "$output" | grep -Fx 'usage: bash scripts/review-branch.sh [--continue]' >/dev/null; then
        printf 'review script: missing usage line\n%s\n' "$output" >&2
        exit 1
    fi
    echo "review script: Bash syntax and invalid argument checks passed"
    exit 0
fi

full=0
[ "${1:-}" = --full ] && { full=1; shift; }

if [ "$full" = 1 ]; then
    echo "scripts/test.sh: no full-suite command configured yet — edit scripts/test.sh" >&2
    # e.g.  npm test -- "$@"   |  pytest "$@"   |  go test ./... "$@"
else
    echo "scripts/test.sh: no fast test command configured yet — edit scripts/test.sh" >&2
    # e.g.  npm test -- --changed "$@"  |  pytest -x -q "$@"
fi
