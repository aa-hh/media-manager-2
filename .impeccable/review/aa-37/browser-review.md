# AA-37 browser review

Reviewed the built application in the hidden in-app browser with a temporary fixture at `/tmp/aa37-browser-fixture.mjs`. The fixture constructs the real Hono application from compiled `src/server/app.ts` and injects the Plex provider and clock. Authentication uses the production routes, cookies and sessions without seeded sessions. The temporary wrapper supplies the labelled browser controls described below; production source contains no fixture endpoints. The browser did not use the Vite development server.

This fixture review is not a live Plex owner sign-in. No authorized Plex account was used.

## Viewports and keyboard

- 1440×900 desktop and 390×844 phone layouts matched the implemented light sign-in screen.
- At 320px, `innerWidth` and `scrollWidth` were both 320px, so the page had no horizontal overflow.
- The Plex icon rendered at 24×24 with empty alternate text and `aria-hidden`.
- Buttons rendered at least 44px high.
- Keyboard Tab moved focus to the Plex button and showed a solid 2px dark-green outline.
- The heading-to-background contrast measured 15.46:1.
- The browser control did not apply the requested 200% zoom. A 200% browser zoom review remains unverified.

## States and recovery

The browser rendered Initial, Opening Plex, Checking Plex account, Pending, interrupted/back, Cancel, Wrong owner, Plex unavailable, Sign-in not configured, Attempt expired, success, Signed in, Signing out, Signed out and Sign-out failed states.

Ordinary focus preserved the pending callback. The bounded repair checks below distinguish a synthetic persisted event from a browser Back navigation that reloads the page.

For successful cross-tab sign-out, the originating tab received HTTP 204 from `/auth/logout`. The originating tab and the second tab both rendered `Sign in`; the second tab also exposed the `Signed out.` live announcement.

For the network-loss case, the fixture process was stopped after the authenticated page loaded. Sign-out then rendered `Sign-out failed. Your session may still be active.` with `Try sign out again`. It did not claim that the server session had ended.

Console messages retained from a real `https://app.plex.tv/auth-form/` page were external Plex page messages, not errors from the local application.

## Bounded repair verification

The repair fixture served the compiled Hono app on loopback ports 4312 and 4317. Its provider fixture verifies the actual signed JWT against its JWK. Sessions and attempts came from real start, callback, complete, status, session, cancel and logout routes. No session was seeded. An explicitly labelled temporary panel supplies provider outcomes, response barriers, clock/cookie expiry and synthetic browser events. These controls are outside production source. CUA evaluation only read the page; controls were activated through normal browser input.

Before UI repair, successful completion left `document.activeElement` on BODY and the signed-in heading had no tabindex. Provider navigation and Back rendered an interrupted screen, but the observed `pageshow.persisted` was false. This browser did not reproduce retained-page restoration. The pre-repair fixture had no cancellation barrier, so it did not capture a held cancellation before editing.

After repair:

- A real start response processed its binding cookie while its body remained held and the screen showed Opening Plex. The fixture's explicitly synthetic persisted `PageTransitionEvent` then read real `/auth/status` and displayed interrupted copy with enabled Try again/Cancel. Releasing the obsolete start body did not navigate or change that state.
- With no pending attempt, the same synthetic event returned to Sign in and cleared Opening Plex and prior expiry announcements. This also passed after entry through the session-expired reason.
- A genuine pending callback retained Check again through synthetic focus, visibility and persisted events. Check again completed that original flow. Successful completion focused the signed-in heading; Tab reached Sign out. Routine successful session rechecks retained the fixture control's focus.
- Advancing the fixture browser/server clock beyond the verified expiry and deleting the HttpOnly cookie reproduced real `/api/session` 401 unauthenticated. Private content stayed hidden and Your session expired appeared. This was simulated clock/cookie expiry, not a 24-hour wait.
- Unexpired revocation at the scrubbed callback first reproduced the invalid-callback defect. After the saved clarification, real logout followed by focus produced real session 401, configured/no-pending status and ordinary Sign in with an empty announcement. A fixture network failure after a verified session also hid private content and returned to ordinary Sign in without invalid-callback, expiry or signed-out success copy. The negative and repaired JSON/JPG pairs are retained.
- Fresh missing-state and duplicate-state callbacks still displayed invalid-callback copy. Fresh valid callbacks still completed. Explicit and cross-tab sign-out retained the earlier verified Signed out announcement.
- While cancellation was held, every visible action was natively disabled, the section was busy and the live announcement said Cancelling sign-in. Repeated Cancel, Check again and Try again activations produced one cancel request and no competing start/complete request.
- Releasing a rejected cancellation displayed Plex sign-in couldn’t be cancelled with Try cancelling again and Try again, without Check again or a success claim. Retrying cancellation returned 204 and initial copy. Try again from this failure created a real replacement start response: the final request counter rose from 3 to 4. Synthetic persisted recovery superseded that response; releasing it left the interrupted screen. Actual cancellation then returned initial copy and Plex sign-in cancelled.
- Completing the real session in another tab while cancellation was held unmounted SignIn. Releasing the obsolete cancellation failure did not replace the signed-in screen.

The changed busy/failure screens were inspected at measured 1440×900 and 390×844 viewports. At 320px, the failure and genuine-pending screens had `innerWidth === scrollWidth === 320` and 44px actions. JPG captures record the busy/failure layouts; `repair-final-replacement.json` and `repair-final-cancel-confirmed.json` record the final replacement/cancellation result.

The browser advertised viewport/visibility capabilities and no zoom capability or accessible native zoom UI. Genuine 200% browser zoom remains unverified. No CSS zoom or device scale was treated as browser zoom. The fixture is not a live Plex account review. Pen MCP confirmed the four additional editable states and exported their images; its tools did not confirm on-disk save status.

## Repair command evidence

All commands ran in the AA-37 worktree with Node 22.23.2 first in PATH. The second Mac was unavailable, so these are local results.

| Command | Result | Evidence |
| --- | --- | --- |
| `sh scripts/test.sh --test-name-pattern 'Plex owner authentication'` before server fix | exit 1; expected 400, actual 204 | `repair-test-red.log` |
| Same focused command after server fix | exit 0; 19/19 tests | `repair-test-focused.log` |
| `sh scripts/test.sh --full` after clarification | exit 0; 44/44 tests | `repair-test-full-final.log` |
| `git diff --check` after source and evidence edits | exit 0 | executor final report |
| `impeccable detect --json --no-design-system src/client/SignIn.tsx src/client/main.tsx src/client/globals.css src/client/components/ui/button.tsx` | exit 2; only required Inter warnings at globals.css lines 5 and 41 | `repair-detector.json` |

The Inter warnings remain because the selected design requires that font. The detector introduced no other finding.

## Additional cancellation repair authorized by the owner

Defect: “Replacing cancellation with a status request must not leave sign-in actions permanently blocked.”

Before the production edit, the compiled application reproduced the defect. A real start returned 201; its held delivery and the fixture's labelled persisted-page event reached interrupted sign-in. Cancellation returned a real 204, with delivery held in the browser. A second same-origin tab then performed real logout, received 204 and sent `signed-out` through BroadcastChannel. That tab had no application Sign out control, so the labelled temporary fixture control generated the notification. The mounted first tab read status 200 with `configured:true,pending:false`, rendered Sign in, but retained `aria-busy=true`. Clicking its enabled Sign in with Plex button produced no request: start/cancel/logout counts remained 1/1/1. `additional-cancel-negative.json` and `.jpg` retain the result.

The only production change clears obsolete cancellation ownership and rendered busy state immediately after `refreshStatus` begins its replacement request. The existing guarded cancellation `finally` remains intact.

After rebuilding, the same mounted transition rendered Sign in with `aria-busy=false`, enabled Sign in with Plex and focus on its heading. Clicking sent a new real start 201, raising the cumulative start count from 2 to 3. Its response delivery stayed held. Releasing obsolete cancellation 204 preserved Opening Plex, its disabled button and Opening Plex announcement. See `additional-cancel-initial-actionable.json`, `additional-cancel-replacement-start-held.json` and `additional-cancel-obsolete-during-opening.json`.

A second run retained obsolete cancellation delivery 1, replaced it through the same labelled cross-tab notification, then recovered the replacement start through the labelled synthetic persisted-page event. Cancellation delivery 2 held a real 400, produced by the fixture presenting a malformed cookie to the real route. Releasing delivery 1 left cancellation 2 busy, both actions disabled and Cancelling sign-in unchanged. Repeated input sent no further start/cancel/complete requests: counts stayed 4/4/0. An Enter attempt on the disabled Cancel button was refused by browser automation as disabled; forced mouse input also produced no request. Releasing delivery 2 showed the cancellation-failure heading and announcement, enabled Try cancelling again/Try again and focused the failure heading. Retry returned real 204; releasing delivery 3 rendered initial copy, `aria-busy=false`, Plex sign-in cancelled and heading focus. See the `additional-cancel-second-cancel-held`, `old-response-keeps-new-busy`, `duplicate-actions-blocked`, `failure-400` and `retry-204` JSON files.

A genuine pending callback returned 202 and retained Check again after the fixture's explicitly synthetic ordinary focus event and real session 401. Check again returned another real 202 for the captured callback. While a later cancellation 400 delivery was held, Check again, Try again and Cancelling were natively disabled. Repeated mouse input left start/cancel/complete counts at 5/6/2. The fixture output eventually grew beyond the viewport; a mouse release action did not fire, so keyboard Enter activated that same labelled release control. The real 400 then displayed actionable failure. Try again started replacement attempt 6 with 201. Its genuine callback returned 202, survived another labelled ordinary focus event and completed with 200 through keyboard Check again after the fixture provider was set to success. Focus landed on the signed-in heading; Tab reached Sign out. A routine session 200 check retained focus on the fixture control. The actual application Sign out button then returned logout 204 and initial copy with Signed out. See `additional-cancel-pending-*`, `additional-cancel-final-pending-focus.json`, `additional-cancel-completion-*`, `additional-cancel-routine-session-focus.json` and `additional-cancel-final-request-counts.json`.

Final cumulative real route counts: start 6 (six 201); cancel 6 (204,204,204,400,204,400); logout 4 (four 204); callback document 2 (two 200); complete 4 (202,202,202,200); status 12 (twelve 200); session 14 (thirteen 401, then 200). Full observations are retained in `additional-cancel-observations.json`; the positive JPG shows the final actionable initial screen. Evaluation only read browser state; all actions and simulations used normal CUA input and labelled temporary fixture controls. This review used synthetic persisted/focus events and fixture Plex responses, not a retained-page navigation or a live owner account.

Commands ran locally from `/Users/alechenderson/Projects/media-manager-2/.claude/worktrees/codex-aa37-plex-sign-in`, with `/Users/alechenderson/.nvm/versions/node/v22.23.2/bin` first in PATH. The parent confirmed the second Mac's Space drive was unavailable and authorized local fallback.

| Command | Result | Evidence |
| --- | --- | --- |
| `sh scripts/test.sh --full` after this edit | exit 0; 44 tests passed, zero failed/skipped/cancelled | `additional-cancel-test-full.log` |
| `git diff --check` | exit 0 | executor command output |
| `/Users/alechenderson/.agents/skills/impeccable/scripts/impeccable detect --json --no-design-system src/client/SignIn.tsx src/client/main.tsx src/client/globals.css src/client/components/ui/button.tsx` | exit 2; only existing Inter warnings at globals.css:5 and :41 | `additional-cancel-detector.json` |
| `git status --short` | exit 0; prior AA-37 changes retained | executor command output |

An initial test-command wrapper exited 1 because its zsh variable `status` is read-only; no source test failure was reported. The exact suite command was then rerun successfully as recorded above.

Genuine 200% browser zoom, live Plex owner sign-in and the earlier Pen save-status limitation remain unverified. This additional repair changed no Pen document, visual state, handover file, server contract, callback validation or expiry handling.
