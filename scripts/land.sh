#!/bin/sh
# Turns on auto-merge for the current branch's pull request. Run it ONLY
# after the owner has said yes; the Claude merge-approval hook asks either way.
#
# It checks nothing itself. The main ruleset holds the PR until the `tests`
# check and the `review` status (posted by scripts/review-branch.sh) are
# green, then GitHub merges it. (GitHub's merge queue is not available on
# personal-account repos.)
#
# Usage: sh scripts/land.sh
set -eu

pr=$(gh pr view --json number -q .number) || { echo "No pull request for this branch." >&2; exit 2; }
gh pr merge "$pr" --merge --auto
echo "PR #$pr will auto-merge; it merges once tests and review are green."
