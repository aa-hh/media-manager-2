# Agent-ready repo template

The workflow scaffolding from Audiout — git guards, the multi-pass branch
review, AGENTS.md discipline, Claude Code hooks and skills — with every
Audiout-specific rule removed. CI is GitHub Actions
(`.github/workflows/tests.yml`, one job named `tests`). A ruleset on `main`
requires that check and the `review` status before a PR can merge, and
`gh pr merge --merge --auto` merges it once both are green. The pre-push hook
is the early local gate.

Delete this file once the project is set up.

## Adopting it

1. **Create the repo.** Either mark the repo holding this template as a
   GitHub template (Settings → Template repository) and use "Use this
   template", or copy the directory into a fresh repo:
   `cp -R template/. ../new-project/ && cd ../new-project && git init`.
2. **Fill the placeholders.** `grep -rn '{{' .` lists them:
   `{{PROJECT_NAME}}`, `{{PROJECT_SLUG}}` and `{{ONE_LINE_DESCRIPTION}}` in `AGENTS.md`,
   `CLAUDE.md`, `CONTEXT.md` and `docs/review/*.md`.
3. **Wire your stack** — the only per-language parts:
   - `scripts/test.sh` and `scripts/build.sh`: the real commands.
   - `.githooks/project.conf`: `SOURCE_PATHS` and `COMMENT_EXTS`.
   - `.claude/hooks/guard-bash.sh`: `BARE_CMDS`, the commands agents may not
     run bare.
4. **Name your risks.** `is_risk_path` at the top of
   `scripts/review-branch.sh`, the matching bullets in `docs/review/deep.md`,
   the trap list in `docs/review/cheap.md`, and the house invariants in
   `.claude/skills/pr-review/SKILL.md`. Leave them empty until something bites;
   every entry should be a trap that actually happened.
5. **Run** `sh scripts/setup.sh` (add `--sync-main` on macOS), then
   `bash scripts/test-guard-agents-docs.sh` to confirm the hooks work.

## What is in it

| Piece | Where | From Audiout |
|---|---|---|
| No commits on main (Guard 1) | `.githooks/pre-commit` | same |
| AGENTS.md symbol check (Guard 2) | `.githooks/agents-md-symbol-check.py` | same, language-neutral |
| Comment-slop screen (Guard 7) | `.githooks/guard-self-review.sh` | Swift-only → any `COMMENT_EXTS` |
| AGENTS.md budget / history (Guard 12) | `.githooks/guard-agents-docs.sh` | same, self-test uses its own fixture |
| Tests at commit (Guard 4) | `.githooks/pre-commit` → `scripts/test.sh` | SwiftPM scoping dropped |
| Full suite + no push to main | `.githooks/pre-push` | early local gate; CI is the real one |
| CI | `.github/workflows/tests.yml` | runs `scripts/test.sh --full`; no Swift shards or caches |
| Merge gate | ruleset "Main via PR checks" | requires `tests` + `review`; no merge queue (personal accounts cannot have one) |
| Branch review (skip/cheap/full, scorer, 2 rounds) | `scripts/review-branch.sh`, `docs/review/` | repo auto-detected, risk paths blank |
| Local main mirror | `scripts/sync-main.sh`, `scripts/launchd/` | plist generated per clone |
| Bare-command deny | `.claude/hooks/guard-bash.sh`, `.claude/settings.json` | in-repo; merge approval stays in the user-level `require-merge-approval.py` |
| `/pr-review` skill | `.claude/skills/pr-review/` | generic attention list |
| Issue tracker, triage, domain docs | `docs/agents/`, `.scratch/`, `CONTEXT.md`, `docs/adr/` | same |
| Readability rubric | `docs/REVIEW-RUBRIC.md` | generic |

**Left out on purpose** (Audiout- or Swift-specific): the capacity permit
pool and second-Mac routing, the live-test slot, the suite cache and
sharding, Guard 4's per-file test scoping, Guards 3/5/6/8/9/11 (Swift test
isolation, XCTest, AirPlayEngine, shared-package leaks, headless windows, Swift
test discipline), housekeeping, and the impeccable design skill (install it
per project if a project has UI).

## Repo settings to turn on

- Allow auto-merge (Settings → General), so `gh pr merge --auto` waits for
  the required checks.
- A ruleset on `main` requiring a pull request and the `tests` and `review`
  checks. `review-branch.sh` posts `review` as a commit status; the status is
  per commit, so a new push needs a new review.
