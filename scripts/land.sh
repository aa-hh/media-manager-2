#!/bin/sh
# Puts the current branch's pull request in GitHub's merge queue. Run it ONLY
# after the owner has said yes; the Claude merge-approval hook asks either way.
#
# It checks nothing itself. The main ruleset holds the PR until the `tests`
# check and the `review` status (posted by scripts/review-branch.sh) are
# green, then the queue re-runs the tests on the merged result and merges.
#
# Usage: sh scripts/land.sh
set -eu

pr=$(gh pr view --json number -q .number) || { echo "No pull request for this branch." >&2; exit 2; }
gh pr merge "$pr" --merge --auto
echo "PR #$pr is queued; it merges once tests and review are green."
