#!/usr/bin/env bash
# Tests for .claude/hooks/guard-bash.sh: the bare commands it must deny and
# the wrapper calls and look-alikes it must let through.
#
# Usage: scripts/test-guard-bash.sh

set -uo pipefail   # deliberately NOT -e: a case failing must not stop the rest

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="$SCRIPT_DIR/../.claude/hooks/guard-bash.sh"

FAILURES=0
fail() { echo "FAIL: $1" >&2; FAILURES=$((FAILURES + 1)); }
ok()   { echo "  ok — $1"; }

decision() {
    python3 -c 'import json,sys; print(json.dumps({"tool_input":{"command":sys.argv[1]}}))' "$1" | sh "$HOOK"
}

denied() {
    if decision "$1" | grep -q '"permissionDecision": "deny"'; then ok "denies: $1"; else fail "should deny: $1"; fi
}

allowed() {
    if [ -z "$(decision "$1")" ]; then ok "allows: $1"; else fail "should allow: $1"; fi
}

denied 'gradle build'
denied './gradlew test'
denied 'android-tv/gradlew assembleDebug'
denied 'sh android-tv/gradlew test'
denied 'cd android-tv && ./gradlew test'
denied 'env JAVA_HOME=x ./gradlew test'
denied 'npm test'

allowed 'sh scripts/android-tv.sh test'
allowed 'git log -- android-tv/gradlew'
allowed 'cat android-tv/gradle/libs.versions.toml'
allowed 'sh scripts/test.sh'

if [ "$FAILURES" -ne 0 ]; then
    echo "guard-bash: $FAILURES case(s) failed" >&2
    exit 1
fi
echo "guard-bash: all cases passed"
