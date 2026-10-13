#!/bin/sh
# The one way tests run in this repo. Hooks, agents and humans all call this,
# never the bare test command, so how tests run is decided in one place.
#
# Usage: sh scripts/test.sh [--full] [extra args passed to the test runner]
#   (no flag)  the fast run Guard 4 uses at commit
#   --full     the full suite; pre-push and CI run it
#   --review-script  check the review script with macOS Bash, then the shell self-tests
#   --production  check the already built production application
set -eu
cd "$(dirname "$0")/.."
# The tests copy this environment into the servers they start, and the app
# reads these names from it, so a shell that exports one changes the results.
unset APP_ORIGIN BACKUP_ACCESS_KEY_ID BACKUP_BUCKET BACKUP_ENDPOINT BACKUP_FOLDER \
    BACKUP_KEY BACKUP_REGION BACKUP_RESTORE_KEY BACKUP_SECRET_ACCESS_KEY DB_PATH \
    HOST PLEX_OWNER_ID PORT TRACKER_RULES

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
    /bin/bash scripts/test-review-branch.sh
    /bin/bash scripts/test-guard-agents-docs.sh
    /bin/bash scripts/test-screenshots.sh
    exit 0
fi

if [ "${1:-}" = --production ]; then
    shift
    exec node --test "$@" tests/production.test.mjs
fi

full=0
[ "${1:-}" = --full ] && { full=1; shift; }

if [ "$full" = 1 ]; then
    sh scripts/test.sh --review-script
fi

sh scripts/build.sh
exec node --test "$@" tests/production.test.mjs
