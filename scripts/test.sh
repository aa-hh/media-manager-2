#!/bin/sh
# The one way tests run in this repo. Hooks, agents and humans all call this,
# never the bare test command, so how tests run is decided in one place.
#
# Usage: sh scripts/test.sh [--full] [extra args passed to the test runner]
#   (no flag)  the fast run Guard 4 uses at commit
#   Both runs add the TV app's unit tests when the branch touches android-tv/.
#   --full     the full suite, plus the Storybook stories this branch changes,
#              in headless Chromium with their accessibility check; pre-push
#              and CI run it
#   --review-script  check the review script with macOS Bash, then the shell self-tests
#   --production  check the already built production application
#   --story-args  print the story test arguments --full uses (for the self-test)
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
    /bin/bash scripts/test-story-args.sh
    /bin/bash scripts/test-housekeeping.sh
    /bin/bash scripts/test-guard-bash.sh
    /bin/bash scripts/test-android-tests.sh
    /bin/bash scripts/test-android-release.sh
    /bin/bash scripts/test-check-apk-cert.sh
    /bin/bash scripts/test-android-ffmpeg-cache.sh
    /bin/bash scripts/test-cloud-android-sdk.sh
    exit 0
fi

if [ "${1:-}" = --story-args ]; then
    # Only the stories whose file, or a file it imports, changed since this
    # branch left main; on main itself, since the previous commit. Prints
    # nothing, which runs every story, when a file every story depends on
    # changed or there is no main to compare with; a run of every story fails
    # when it finds none, so a broken stories pattern cannot pass.
    if base=$(git merge-base HEAD origin/main 2>/dev/null); then
        if [ "$base" = "$(git rev-parse HEAD)" ]; then
            base=$(git rev-parse -q --verify HEAD~1) || exit 0
        fi
        if git diff --quiet "$base" -- package.json package-lock.json vite.config.ts .storybook src/client/globals.css; then
            echo "--changed $base --passWithNoTests"
        fi
    fi
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

# The TV app's unit tests, when this branch (working tree included) touches it;
# the base is the one --story-args uses. No main to compare with runs them.
# A machine without the Android SDK (exit 97) skips them, except in CI.
android_base=
if android_base=$(git merge-base HEAD origin/main 2>/dev/null); then
    if [ "$android_base" = "$(git rev-parse HEAD)" ]; then
        android_base=$(git rev-parse -q --verify HEAD~1) || android_base=
    fi
fi
if [ -z "$android_base" ] || git diff --name-only "$android_base" -- android-tv scripts/android-tv.sh | grep -q .; then
    if sh scripts/android-tv.sh test; then :; else
        status=$?
        if [ "$status" -ne 97 ] || [ -n "${CI:-}" ]; then exit "$status"; fi
        echo "test.sh: skipped the TV app's tests: no Android SDK on this machine" >&2
    fi
fi

sh scripts/build.sh
if [ "$full" = 1 ]; then
    # The stories this branch changes (see --story-args) render and pass their
    # accessibility check. Chromium comes from `sh scripts/setup.sh` locally
    # and from the workflow in CI.
    npx vitest run --project storybook $(sh scripts/test.sh --story-args)
fi
exec node --test "$@" tests/production.test.mjs
