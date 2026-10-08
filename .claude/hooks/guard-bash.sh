#!/bin/sh
# PreToolUse hook for Bash. Reads the tool call as JSON on stdin.
#
#   deny  the bare build/test commands listed in BARE_CMDS — agents go
#         through scripts/build.sh and scripts/test.sh so there is one place
#         that knows how this repo builds and tests
#
# Merges are gated by the user-level hook ~/.claude/hooks/require-merge-approval.py
# (gh pr merge needs the owner's yes; merging main into a work branch does not).
#
# Edit BARE_CMDS for your stack (an extended regex matched at a command start).
BARE_CMDS='(npm (test|run build)|pnpm (test|build)|yarn (test|build)|pytest|go (test|build)|cargo (test|build)|swift (test|build|run))'

cmd=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null) || exit 0

decide() {
    python3 -c 'import json,sys; print(json.dumps({"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":sys.argv[1],"permissionDecisionReason":sys.argv[2]}}))' "$1" "$2"
    exit 0
}

start='(^|[;&|(]|&&|\|\|)[[:space:]]*(env [^;&|]*[[:space:]])?'
if printf '%s\n' "$cmd" | grep -Eq "$start$BARE_CMDS([[:space:]]|\$)"; then
    decide deny "Use scripts/test.sh or scripts/build.sh instead of the bare command (CLAUDE.md, Build & test)."
fi
exit 0
