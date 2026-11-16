# scripts

## Purpose

The only sanctioned way to build, test, review, land and deploy this repo. Hooks, CI, agents and humans all call these wrappers, so each job is decided in one place.

## Rules

- Build and test only through `build.sh`, `test.sh` and `android-tv.sh`. The Claude hook denies the bare commands; only `test.sh` keeps the build fresh.
- The review's size thresholds, model choices and risk paths live together at the top of `review-branch.sh` (`is_risk_path`, `is_product_path`). Change them there and nowhere else; a risk file missing from `is_risk_path` lets a small dangerous change skip review.
- `setup.sh` points `core.hooksPath` at `.githooks`, so every worktree of a clone shares one set of hooks. A hook must work from any worktree, not only the checkout holding it.
- A guard that a path pattern can bypass is a defect, not a limitation. When adding a file type or folder, check that the hooks' `SOURCE_PATHS` and the review's path functions still see it.
- After editing `review-branch.sh`, run `sh scripts/test.sh --review-script`: macOS ships an old Bash that parses some constructs differently.

## Map

- `build.sh` → compile and typecheck everything.
- `test.sh` → the test suite and its modes.
- `android-tv.sh` → TV app build, tests, install.
- `cloud-android-sdk.sh` → TV SDK for cloud containers.
- `review-branch.sh` → picks and runs the branch review, posts the `review` status.
- `housekeeping.sh` → removes `.prunable` worktrees; `build.sh` runs it.
- `test-*.sh` → self-tests; `test.sh --review-script` runs them.
- `setup.sh` → one-time hook setup; `--sync-main` installs the mirror job from `launchd/`.
- `sync-main.sh` → keeps local `main` matching `origin/main`.
- `desktop-build.sh` → build, sign and notarise the desktop app.
- `deploy.sh`, `ensure-running.sh` → deploy to and keep the server running on the host.
- `screenshots/` → headless-Chrome title-page shots against the arr fake; macOS.
