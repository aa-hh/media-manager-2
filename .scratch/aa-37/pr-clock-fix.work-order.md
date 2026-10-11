### Goal

Repair PR #7’s session-check loop when the browser clock differs from the server clock. Schedule expiry from server-reported remaining time, preserve server authorization and automatic expiry checks, and retain the accepted cancellation and focus behavior. This appendix supersedes earlier file restrictions only for the files named below; the original product scope remains binding.

### Verified facts

- `main.tsx` calculates a timeout from server expiry minus browser `Date.now()`. Every successful check creates another session object and reruns that effect: `src/client/main.tsx:58`, `src/client/main.tsx:116`. A browser clock ahead of expiry therefore repeatedly schedules immediate requests while the server continues returning 200.
- Session checks hide the shell, cancel superseded requests and reject stale results: `src/client/main.tsx:36`, `src/client/main.tsx:45`. Focus, visibility and page restoration trigger checks: `src/client/main.tsx:79`.
- The current expiry-message fallback also uses browser `Date.now()`: `src/client/main.tsx:63`.
- Successful callback completion supplies only `expiresAt`; `signedIn` immediately renders the shell and requests heading focus: `src/client/SignIn.tsx:100`, `src/client/main.tsx:123`.
- Both successful HTTP responses currently contain only `expiresAt`: `src/server/app.ts:187`, `src/server/app.ts:242`. The app already supplies the same injected `now` function to authentication: `src/server/app.ts:71`.
- Authentication stores a fixed 24-hour expiry and rejects sessions when server time reaches it: `src/server/auth.ts:333`, `src/server/auth.ts:355`. Logout revokes the supplied session: `src/server/auth.ts:350`.
- Existing tests obtain real sessions through public routes, inject server time and check absolute expiry: `tests/production.test.mjs:325`, `tests/production.test.mjs:345`, `tests/production.test.mjs:651`. Successful session-body assertions also occur at `tests/production.test.mjs:400`.
- The temporary fixture serves compiled production code, verifies provider signatures and counts real requests: `/tmp/aa37-browser-fixture.mjs:2`, `/tmp/aa37-browser-fixture.mjs:89`, `/tmp/aa37-browser-fixture.mjs:109`. Its existing expiry control changes both clocks and removes the cookie, so it cannot establish clock-offset behavior unchanged: `/tmp/aa37-browser-fixture.mjs:63`, `/tmp/aa37-browser-fixture.mjs:105`.
- Tests run through the wrapper; each normal test run rebuilds and replaces `dist`: `scripts/test.sh:45`, `scripts/build.sh:6`. Formal review round two examines the repair; a third round refuses: `scripts/review-branch.sh:13`.

A client-only repair cannot determine remaining server lifetime from `expiresAt` alone. Suppressing subsequent checks loses automatic expiry; retry delays introduce polling. The orchestrator explicitly approved the narrow `app.ts` and test expansion below.

### Steps

1. **`tests/production.test.mjs`, existing authentication tests: establish failing contract proof.**
   Add a defect comment stating that omitting current server time prevents clock-independent expiry scheduling. Update the successful `/api/session` assertion and extend the existing absolute-expiry test to require exactly `{ expiresAt, serverNow }`, both Unix milliseconds. Request the same session at two injected times before expiry; `serverNow` must equal each injected time while `expiresAt` remains unchanged. Retain the exact-boundary 401 assertion and all rotation/restart checks. Leave `/auth/complete` expectations unchanged.

   Run:
   ```sh
   sh scripts/test.sh --test-name-pattern 'Plex owner authentication'
   ```
   Require failure because `serverNow` is missing. Save the output before production edits.

2. **`/tmp/aa37-browser-fixture.mjs`, labelled controls: reproduce the browser defect before production edits.**
   Add independent server-time and browser-wall-clock controls. Obtain expiry from real authentication responses; preserve real cookies, provider signatures and public routes. Hold delivery of the fourth session response after explicitly arming reproduction, preventing an unlimited request flood.

   Obtain a genuine fixture session. Set server time to expiry minus 30 seconds and browser `Date.now()` to server time plus 60 seconds; retain the cookie. Trigger one labelled focus check. Require repeated real session 200 responses without additional user events, followed by the held response and hidden checking screen. Record counts, unchanged expiry and both clock values. Stop if this does not reproduce.

   For later verification, permit a ticking server clock anchored at a selected time, inspection of scheduled timeout delays, individual session-response delivery holds, and narrowly labelled controls for cookie removal and real logout. Browser automation uses CUA input; evaluation remains read-only. Stop the old fixture before rebuilding or restarting it.

3. **`src/server/app.ts`, `/api/session` success handler: expose server time.**
   Return `{ expiresAt: context.get('sessionExpiresAt'), serverNow: now() }` after the existing private guard succeeds. Use the existing injected clock. Do not change `/auth/complete`, error responses, cookies, authorization, stored expiry or session lifetime.

4. **`src/client/main.tsx`, session checking, completion and expiry effect: replace browser-wall-clock timing.**
   Capture `performance.now()` immediately before each session request. This clock measures elapsed time independently of wall-clock corrections. After JSON parsing and the current-request check, require finite numeric `expiresAt` and `serverNow`.

   Calculate a conservative elapsed-time deadline from request-start time plus `expiresAt - serverNow`. Accept a signed-in result only while that deadline remains in the future. Retain the deadline independently of transient checking state; schedule the existing single expiry timeout from its remaining elapsed time, retaining the existing timeout maximum and cleanup.

   **A response whose calculated deadline has already passed must enter the existing `session-unavailable` handling, keep the shell hidden, clear retained verification/timing, and schedule no automatic retry.** Apply the same unavailable handling to invalid timing metadata. Do not claim confirmed expiry or revoke a cookie from that estimate. This explicitly prevents delayed 200 responses from rearming immediate checks.

   On completed sign-in, keep the `SignIn` callback interface unchanged. Record its verified expiry and pending heading-focus intent, enter hidden checking, and perform a guarded `/api/session` request before displaying the shell. Make this completion check distinguishable from ordinary checks while already signed out: its failure must leave checking and produce `session-unavailable`, without reinterpreting the scrubbed callback URL. Ordinary unsuccessful focus checks must continue preserving mounted pending sign-in.

   Preserve deadline information through checking and sign-out failure; clear it wherever verification is consumed or explicitly cleared. Replace the existing `Date.now()` expiry-message fallback with the retained server-derived elapsed deadline, still requiring HTTP 401; explicit `session_expired` remains authoritative. Network errors remain unavailable.

   Preserve request cancellation/version guards, cross-tab sign-out, sign-out retries, all lifecycle listeners, heading focus after successful authentication, and no deliberate heading focus on routine checks. No polling or recursive automatic retries.

5. **`.impeccable/review/aa-37/browser-review.md` and supporting evidence: append observed results.**
   Complete the browser matrix below against rebuilt production code. Record request counts, statuses, clock values, scheduled delays, visible state and focus. Retain the negative proof and exact command output. Identify every fixture-generated event.

6. **`docs/handover-2026-10-08-aa37.md`, “Design and evidence”: update only repair evidence.**
   Add the server-relative timing repair, link its browser evidence and update the actual final test count. Preserve the requested post-merge framing, AA-38 instructions and all outstanding manual limitations. The orchestrator remains responsible for verifying that merging succeeds.

### Out of scope — do not touch

- `src/client/SignIn.tsx`, `src/server/auth.ts`, database/settings code, styles, assets, package files, scripts, hooks and configuration.
- Authentication policy, 24-hour absolute expiry, callback validation, cancellation behavior and the complete 19-feature map.
- Pen documents, frames and surface briefs. No new visual state is required.
- No cleanup, no abstractions, no error handling for impossible cases, no backwards-compat shims.
- No new dependencies, browser-test framework, production fixture routes or authentication bypass.
- No executor staging, commits, pushes or merges.

### Verification

**Test seam:** extend `tests/production.test.mjs:651` for server timing without sliding expiry. The compiled-app fixture at `/tmp/aa37-browser-fixture.mjs:6` proves the React timer behavior that the server tests cannot observe.

**Defect:** a valid session with browser time ahead of server expiry repeatedly schedules immediate checks; delayed successful responses must not recreate that loop.

**Baseline:** initial and final scoping status were clean at `b1233bb9ae1266f9c01323a3613155e34a912fbe`. `git diff --check` exited 0. I inspected the saved 44-pass, zero-failure result in `additional-cancel-test-full.log`; I did not rerun it or claim browser reproduction. Steps 1–2 provide fresh negative proof before production changes. Scoping changed no files.

Run from:
`/Users/alechenderson/Projects/media-manager-2/.claude/worktrees/codex-aa37-plex-sign-in`

```sh
export PATH="/Users/alechenderson/.nvm/versions/node/v22.23.2/bin:$PATH"
sh scripts/test.sh --full
git diff --check
/Users/alechenderson/.agents/skills/impeccable/scripts/impeccable detect --json --no-design-system src/client/SignIn.tsx src/client/main.tsx src/client/globals.css src/client/components/ui/button.tsx
git status --short
```

Suite and whitespace checks must exit 0. Extending existing tests should retain 44 tests; report actual output. Detector exit 2 is accepted only for the existing Inter warnings at `globals.css:5` and `:41`.

Run the temporary fixture with Node 22 after the build:
```sh
node /tmp/aa37-browser-fixture.mjs
```

Required browser checks:

- Repeat the negative scenario after repair with browser offsets of **+60 seconds and −60 seconds**. Each explicit check returns one valid session response and schedules a positive server-relative delay, without repeated immediate requests or an expiry message.
- Start a fresh successful callback under each offset. Hold its subsequent session verification: shell stays hidden. Release valid timing: shell appears and heading receives focus.
- With ticking server time and a short remaining lifetime, observe the scheduled check reach real server expiry and return 401 `session_expired`, without a focus event. Private content stays hidden. Use condition-based observation with a ceiling, not fixed sleeps.
- Hold a real 200 response until its reported remaining lifetime has elapsed. On release, require ordinary unavailable sign-in, no shell and no automatic follow-up request or timer. A later explicit focus check may retry. Preserve the negative pre-fix loop evidence separately.
- Hold a valid session response, perform real sign-out/cross-tab notification, then release it. The stale response must not restore the shell.
- Recheck expired-cookie 401 after the retained elapsed deadline, unexpired revocation, session-network failure on scrubbed `/auth/callback`, explicit/cross-tab sign-out, and failed sign-out followed by retry. Require the existing appropriate copy and announcements.
- Recheck genuine pending callback through ordinary focus and successful completion; mounted cancellation replacement must still become actionable. Routine successful checks must not deliberately focus the product heading.

Preserve the recorded limitations: live owner Plex sign-in, genuine 200% browser zoom, actual retained-page restoration and Pen on-disk saving remain unverified.

### Execution plan

One serial repair track owns Steps 1–6.

- **Model:** `gpt-6.1-sol`, as selected by Alec.
- **Effort:** `high`; conservative timing, overlapping responses and controlled browser proof require careful integration.
- **Owned files:** `tests/production.test.mjs`, `src/server/app.ts`, `src/client/main.tsx`, `.impeccable/review/aa-37/browser-review.md`, narrowly named supporting evidence there, and the specified handover paragraph. Temporary fixture ownership is exclusive.
- **Starting state:** the exact clean commit above, plus the parent’s newly saved appendix. Read the complete existing work order and root `AGENTS.md`; no nested `AGENTS.md` was found.
- **Concurrency:** use the current PR worktree serially. No concurrent build, fixture mutation or handover edit. The parent already confirmed the second Mac’s Space drive unavailable; label wrapper results as local fallback.
- **Completion:** executor supplies fresh red/green output and browser results. Parent independently runs the combined commands, obtains fresh Astra review, then performs mandatory formal review round two through `bash scripts/review-branch.sh` and its printed passes followed by `--continue`. Only a green review permits the separately authorized merge; executor completion alone does not.

### Executor rules (copy verbatim into the handoff prompt)

> - Follow the steps in order. Do not add, merge, reorder, or skip steps.
> - Before editing in any folder, read the nearest AGENTS.md above it (and the root one) if the repo has them — folder rules and traps bind even when the work order doesn't repeat them.
> - If reality contradicts a Verified fact or a step is impossible as written, STOP and report the discrepancy. Do not improvise a workaround.
> - Before reporting progress, audit each claim against a tool result from this session. Only report work you can point to evidence for. If tests fail, say so with the output.
> - If the work order names a new test, run it before making the change and paste the failing output. A test that passes before the change proves nothing.
> - Completion requires the checks assigned to your track to pass. Report exact commands, working directory, exit status, and relevant output. The orchestrator verifies the combined result.
> - Touch nothing in the Out-of-scope list. Other agents may be working; preserve their edits and existing user changes. Do not commit or push.
> - Deliver what was asked, at the scope intended. If the spec seems mistaken or a better approach exists, say so in a sentence and continue as specified rather than quietly narrowing, widening, or transforming it.
