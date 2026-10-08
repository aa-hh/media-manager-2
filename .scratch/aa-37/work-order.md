### Goal

Implement [AA-37](https://linear.app/aa-hh/issue/AA-37) so only the configured owner’s server-verified Plex account can obtain an application session. Provide the complete sign-in and sign-out flow in the owner-selected light “Modern utility” design. Establish authorization for future private features without implementing their endpoints or reducing the agreed first-version functionality. Create new editable Pen frames reflecting the implemented sign-in states on desktop and phone, preserving the existing canvas.

### Verified facts

- Research baseline: `/Users/alechenderson/Projects/media-manager-2/.claude/worktrees/codex-aa37-plex-sign-in`, branch `codex/aa37-plex-sign-in`, commit `c6ede2f9cf7e248202137df90c619a8926519088`. Initial and final `git status --short` were empty. Scoping changed no source files.
- Root rules require wrapper commands, behavior tests for security boundaries, defect comments, and no fixed waits: `AGENTS.md:54`, `AGENTS.md:85`, `AGENTS.md:101`. The inventory found no nested `AGENTS.md`.
- The server serves compiled files and an extensionless HTML fallback; it has no private application endpoints: `src/server/index.ts:8`, `src/server/index.ts:12`, `src/server/index.ts:22`.
- SQLite opens before listening: `src/server/index.ts:32`. Settings are server-only database operations, not HTTP endpoints: `src/server/settings.ts:22`, `src/server/settings.ts:37`, `src/server/settings.ts:58`. Database permissions and migrations already exist: `src/server/database.ts:66`, `src/server/database.ts:107`, `src/server/database.ts:141`.
- The browser renders only the product heading; its stylesheet has two imports: `src/client/main.tsx:4`, `src/client/globals.css:1`.
- Node 22+, Hono, React, Base UI, Tailwind, shadcn, `clsx` and `tailwind-merge` are dependencies: `package.json:6`, `package.json:14`. Existing `cn` combines classes: `src/client/lib/utils.ts:4`.
- Installed Hono provides cookie helpers and request-size limits: `node_modules/hono/dist/types/helper/cookie/index.d.ts:14`, `node_modules/hono/dist/types/middleware/body-limit/index.d.ts:41`. Base UI Button renders a native button: `node_modules/@base-ui/react/button/Button.d.ts:4`.
- Existing tests exercise compiled server requests, storage and credential leakage: `tests/production.test.mjs:44`, `tests/production.test.mjs:161`, `tests/production.test.mjs:493`. The test wrapper accepts runner arguments: `scripts/test.sh:33`, `scripts/test.sh:45`. Builds replace `dist`: `scripts/build.sh:6`.
- The first version has one owner and Plex sign-in: `PRODUCT.md:17`, `PRODUCT.md:33`. Components use shadcn/ui on Base UI: `docs/design/design-library-requirements.md:130`.
- The user selected **Modern utility (light)** during Shape’s correction round. This overrides graphite `DESIGN.md` styling for this surface. Personally inspected through Pen MCP: `design/mediaManager2.pen` in the `codex-design-finish` worktree, frame `G0oVq`, History `EGUPz`, Downloads `K7IEj`. They use Inter; ground `#F6F8F7`, white controls, ink `#152123`, dark green `#233B35`, borders `#DAE2DF`, and controls rounded around 8px.
- The user subsequently required AA-37 executors to create new Pen frames based on their changes. A fresh Pen MCP inspection confirms the active canvas is `/Users/alechenderson/Projects/media-manager-2/.claude/worktrees/codex-design-finish/design/mediaManager2.pen`, with 30 existing top-level nodes, including shared controls `bi8Au` and `Sidequest` `Le3r1`. The latter occupies x=-5262, y=16478, width=8791, height=5405. Use fresh MCP placement at execution time; these observations are not permission to move or change existing nodes.
- Current [Plex authentication documentation](https://developer.plex.tv/pms/#section/API-Info/Authenticating-with-Plex) recommends its public-key PIN flow for new applications. It specifies `clients.plex.tv/api/v2/pins`, Ed25519 device signatures, `app.plex.tv/auth#?` and returned `authToken`. Verify tokens through `https://plex.tv/api/v2/user`.
- Feasibility probe: official PIN creation returned **201**; signed checking of the unclaimed PIN returned **200**, `authToken: null`; Node 22’s built-in Ed25519 signing/verification succeeded. This did not sign in an account or prove a completed live round trip.
- The live [Plex sign-in page](https://app.plex.tv/auth) references this official [SVG icon](https://app.plex.tv/auth/favicon-mask.svg). Fetched and checked: 367 bytes; SHA-256 `5b2a8cf07e39bc5dbc807cff19ae5e36c640c571488b789c3cb87f1c3f9ba1ff`; 72×72 viewBox, native black fill. Preserve those bytes. Indexed [Plex trademark guidance](https://www.plex.tv/en-au/about/privacy-legal/plex-trademarks-and-guidelines/) permits its icon as a link to Plex and prohibits altered/distorted marks. Direct retrieval of that guidance and the supplied logo article returned 403; do not claim a complete current legal-page review.
- Official Inter font and license fetched successfully: [variable font](https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf), [license](https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt). Font SHA-256: `29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031`.

The complete first-version map was checked against [AA-5](https://linear.app/aa-hh/issue/AA-5), all six epics, AA-6 through AA-28 and decision comments, `docs/handover-2026-10-08.md:7`, and `docs/design/sonarr-radarr-review.md:13`. “Protect” means owner authorization for browser reads/actions and private updates when their owning ticket implements them.

| # | Functionality to preserve and protect | Authority / owner |
|---|---|---|
| 1 | Movie/TV search, identifiers, Sonarr/Radarr routing and adding with saved defaults | [AA-31](https://linear.app/aa-hh/issue/AA-31), `docs/design/sonarr-radarr-review.md:21` |
| 2 | Release comparisons and hand-picked grabs; owned items offer Replace or Second version | AA-31 |
| 3 | Forced tracked replaces, retained seeding and “manual download” protection without unmonitoring | AA-31, [AA-20](https://linear.app/aa-hh/issue/AA-20), [AA-25](https://linear.app/aa-hh/issue/AA-25) |
| 4 | Independent second-version grabs, imports, durable records and deletion | [AA-32](https://linear.app/aa-hh/issue/AA-32) |
| 5 | Separate library-file/torrent deletion; cautious hit and run advice; movie deletion defaults to removing its Radarr record, with keeping it unmonitored optional | AA-32, [AA-24](https://linear.app/aa-hh/issue/AA-24), `docs/design/sonarr-radarr-review.md:25` |
| 6 | Direct rTorrent status, download controls and shared live progress | [AA-33](https://linear.app/aa-hh/issue/AA-33), [AA-7](https://linear.app/aa-hh/issue/AA-7) |
| 7 | Missed-search/stall recovery, retry limits, retained partial downloads and recorded outcomes | AA-33, [AA-13](https://linear.app/aa-hh/issue/AA-13) |
| 8 | Service, tracker, disk, backup and background-job health; exact refusal text; no health-warning snooze in the first version | [AA-34](https://linear.app/aa-hh/issue/AA-34), [AA-17](https://linear.app/aa-hh/issue/AA-17), `docs/design/sonarr-radarr-review.md:39` |
| 9 | View-only week/month/forecast calendar with live progress; forecast means a rolling few days; no calendar actions | [AA-30](https://linear.app/aa-hh/issue/AA-30), `docs/design/sonarr-radarr-review.md:37` |
| 10 | One-owner sign-in; private settings reads/changes, credentials, connections and hosting | [AA-29](https://linear.app/aa-hh/issue/AA-29); AA-37 owns sign-in only |
| 11 | Overview-first navigation, files/versions/seeding/history, automatic search and cached release details | AA-30 |
| 12 | Library opens most recently added first, with progress, chosen fields and totals; no bulk editing | AA-30, `docs/design/sonarr-radarr-review.md:19` |
| 13 | Show/season/episode monitoring; range selection includes episodes only and versions are selected separately | AA-30, `docs/design/sonarr-radarr-review.md:23` |
| 14 | Missing/Below cutoff filters and search history/actions; manual downloads excluded | AA-34 |
| 15 | Global/title history with service and automation details | AA-34 |
| 16 | Confirmed mark-as-failed, blocklist and unblock/Undo; preserve current file and seeding | AA-34 |
| 17 | Manual import, original failure reason, valid assignments and preserved hardlinks | AA-33 |
| 18 | Movie/episode/quality overrides before grabbing, retaining Replace/Second version choice | AA-31 |
| 19 | Delayed releases, remaining delay and Grab now in Downloads | AA-33 |

Cross-feature obligations remain: server-only service/image credentials, ten-minute search caching, private browser updates, settings-based host/service/tracker configuration, backup/restoration and background jobs that continue without an open browser or owner session. AA-38 through AA-43 own these implementations. Authentication gates user HTTP reads/actions/browser updates, not trusted internal jobs. Open filesystem, second-version, tracker and manual-download decisions remain with AA-18 and AA-20 through AA-25. Friend requests, playback statistics, phone push and **storage forecasting** remain excluded; the agreed calendar forecast view remains included.

### Steps

1. **`tests/production.test.mjs`, existing production-server test: write the first failing security test.** Add a defect-named subtest requesting `GET /api/session` with `Accept: text/html`, without a cookie. Require JSON **401**, not the application document. Run `sh scripts/test.sh --test-name-pattern 'production server serves'` and paste the failing assertion before any implementation edit. Existing fallback returns HTML **200**, proving the absent authorization boundary.

2. **`tests/production.test.mjs`, add the remaining authentication cases before production edits.** Extend the request-based style with a group named `Plex owner authentication`. Import the built `dist/server/app.js` and exercise the `createApp` contract in Step 4 using injected provider responses and an injected clock. Obtain sessions only through real start/complete routes and cookies; never seed sessions or add feature endpoints. Cover the Verification matrix. The provider fixture must cryptographically validate each submitted device JWT using the public JWK received at PIN creation before returning any PIN result. Existing database/leakage tests remain intact.

3. **New `src/server/auth.ts`: implement provider exchange and application sessions.** Own provider requests, pending attempts, session validation, expiry and revocation. Use Node crypto, built-in fetch and memory maps; no dependency or database migration. Internal naming is the executor’s choice; the public application contract is fixed in Step 4.

   Required behavior:
   - `PLEX_OWNER_ID` is a server-only, canonical positive decimal Plex account ID within JavaScript’s safe-integer range. Compare it with the positive safe-integer `id` returned by Plex’s user endpoint. Never use username, email, client fields, token decoding alone or first-visitor ownership. Reject identities Plex marks restricted or anonymous.
   - `APP_ORIGIN` is the configured public origin. Accept HTTPS, or HTTP loopback for local work. Reject URL credentials, paths beyond `/`, queries, fragments and malformed values. HTTP requires a loopback listening host. Never derive callback/security decisions from forwarded headers. Missing/invalid configuration disables sign-in/private access while keeping the public screen available; never expose configuration values.
   - Each attempt gets an independent client identifier from `randomUUID()`, independent `kid` from `randomUUID()`, an Ed25519 key pair, random 32-byte browser binding, and separate random 32-byte state. Reuse that identifier/key for all requests in that attempt, and discard attempt material afterward.
   - Export the generated public key as JWK. Send only `kty: OKP`, `crv: Ed25519`, its exported base64url `x`, the generated `kid`, and `alg: EdDSA`. Never send the private `d` field. Create a strong PIN with JSON `{strong:true,jwk:…}` at `POST https://clients.plex.tv/api/v2/pins`. Send `Accept: application/json`, `Content-Type: application/json`, `X-Plex-Product: media-manager-2` and the same `X-Plex-Client-Identifier`.
   - Construct the handoff with `URL`/`URLSearchParams`, preserving `https://app.plex.tv/auth#?`. Parameters are `clientID`, `code`, `context[device][product]`, and fixed `APP_ORIGIN/auth/callback?state=…`. No caller-selected return destination.
   - Check the stored PIN at `https://clients.plex.tv/api/v2/pins/{id}?deviceJWT=…`. The compact JWT header has exactly `alg: EdDSA`, the matching `kid`, and `typ: JWT`; payload has `aud: plex.tv`, `iss` equal to the attempt’s client identifier, `iat = floor(now()/1000)`, and `exp = iat + 60`. Base64url-encode header/payload JSON without padding; sign the ASCII `header.payload` bytes with the matching Ed25519 private key and base64url-encode the signature. Send the same client-identifier/product headers and JSON Accept header.
   - Verify a returned token through `GET https://plex.tv/api/v2/user`, with `X-Plex-Token` and the same client identifier/product/Accept headers. Require HTTP 200 and a valid matching owner ID. Discard the Plex token after verification; no refresh or service connections.
   - Provider requests use fixed HTTPS endpoints, `redirect: error`, and a ten-second timeout. Malformed responses, redirects, network/provider errors and failed identity checks never create sessions. Do not expose upstream bodies, keys, tokens or request URLs.
   - Attempts expire at the earlier of ten minutes or valid provider `expiresAt`; reject missing/invalid provider expiry. Store browser binding/state only as hashes. Expiry begins at `now >= expiresAt`.
   - Null `authToken` means pending. Reject concurrent completion while a check is running. After awaited provider calls, recheck the attempt is still current so cancel, restart or sign-out cannot create a late session.
   - Starting again replaces that browser’s pending attempt. Success consumes it once and replaces any session that browser supplied.
   - Application session tokens are independent random 32-byte opaque values, stored only as hashes with owner ID/expiry. Lifetime is **24 hours absolute**, no sliding renewal. Sign-out revokes the current session immediately; process restart loses sessions/attempts; another device’s valid session survives browser sign-out.
   - Bound memory to 100 pending attempts and 100 sessions. Remove expired entries before capacity checks; refuse excess without evicting active sessions. Limit PIN creation to ten starts per minute per process, with a retryable rate-limit result. Use the injected clock.
   - Use one session-validation operation for the HTTP guard, checking owner ID and expiry every time. Do not introduce a permissive alternative for future updates.

4. **New `src/server/app.ts`: assemble Hono and enforce the HTTP contract.** Export `createApp(options)`, returning a Hono application supporting its normal `.request` and `.fetch` methods. `options` has required `clientDirectory: string` (absolute built-client directory) and `listeningHost: string`; optional `ownerPlexId: string`, `publicOrigin: string`, `now: () => number` (milliseconds), and `fetch: typeof globalThis.fetch`. Omitted `now`/`fetch` use `Date.now`/built-in fetch. Missing/invalid owner/origin is the disabled configuration described above. Each factory call owns independent attempt/session/limit state. Tests use this interface; do not add a second test API or environment bypass.

   JSON errors use `{error:"<code>"}`. Public authentication routes:

   | Route | Required behavior |
   |---|---|
   | `GET /auth/status` | **200** `{configured:boolean,pending:boolean}` for this browser; no identity or credentials |
   | `POST /auth/start` | Empty JSON object; **201** `{url:string}` plus binding cookie; **503** `not_configured`/`plex_unavailable`; **429** `rate_limited` with `Retry-After` |
   | `GET /auth/callback` | Public application document only; no authentication side effect |
   | `POST /auth/complete` | JSON containing only `state`; **200** `{expiresAt:number}` plus new session cookie after owner verification; **202** `{status:"pending"}` for unclaimed PIN |
   | `POST /auth/cancel` | **204**, invalidate pending attempt/clear its cookie; idempotent |
   | `POST /auth/logout` | **204**, revoke current session and pending attempt/clear both cookies; idempotent |

   Completion failures: **400** `invalid_request` for malformed input, **401** `invalid_flow`/`flow_expired`, **409** `in_progress`, **403** `owner_only`, **503** `plex_unavailable`. Terminal outcomes invalidate the attempt; pending/in-progress retain it. All timestamps in browser JSON are Unix milliseconds.

   Additional requirements:
   - All authentication POSTs require exact matching `Origin`, JSON Content-Type and `X-Requested-With: media-manager-2`. Reject missing, `null` or foreign origins and cross-site Fetch Metadata with **403** `invalid_origin`. Limit bodies to 1,024 bytes using Hono’s existing middleware; oversized requests return **413**. No cross-origin access. Cancel/logout also accept only an empty JSON object.
   - Guard both `/api` and `/api/*` for every method before private handlers/static fallback. Unknown private-prefix paths require authorization, then return **404**, never HTML.
   - The sole private endpoint introduced is `GET /api/session`: **200** `{expiresAt:number}` for an owner session. Missing/forged/revoked sessions return **401** `unauthenticated`; expired sessions return **401** `session_expired`. Clear invalid session cookies.
   - Unsafe `/api` methods also require the origin/header checks before handlers execute. Authentication absence must still prevent every private method.
   - Cookies: HttpOnly, SameSite=Lax, host-only, `Path=/`, explicit Max-Age, Secure for HTTPS. HTTPS names: `__Host-mm_session`/`__Host-mm_plex`; loopback HTTP: `mm_session`/`mm_plex`. Read only the appropriate names. Reject duplicate authentication cookies rather than choosing an ambiguous value. Deletion uses matching cookie attributes.
   - Set `Cache-Control: no-store` on auth/private responses/application document, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, and `X-Frame-Options: DENY`.
   - Preserve public compiled assets and existing HTML navigation fallback; exclude `/auth` and `/api` namespaces from generic fallback. Unsupported authentication paths/methods return **404** or **405** without effects.
   - Every future browser data/action endpoint belongs under guarded `/api`. Add no settings, search, health or event-stream endpoint.

5. **`src/server/index.ts`, construction/startup: connect the factory.** Move existing routing to `app.ts`, preserving compiled-file resolution and database-before-listen behavior. Pass `PLEX_OWNER_ID`, `APP_ORIGIN` and existing listening host to the factory. Preserve the fixed database startup failure message. Never log secret-bearing authentication requests/responses.

6. **`README.md`, configuration/authorization contract: document settled choices.** Document both environment variables, loopback restrictions, 24-hour absolute sessions, restart sign-out, per-browser sign-out, no token refresh, fixed return destination and server-only credentials. The operator must supply their Plex ID from their own verified Plex account record; no first-login ownership. Document actual routes and future obligations:
   - Settings, media/images, search, grabs, replaces, imports, deletion, download controls, flags/history/health/calendar and updates belong under the owner guard.
   - AA-41 must authorize event-stream setup before headers, revalidate before every private event, and close on expiry/revocation. AA-37 has no stream and cannot claim stream-termination verification.
   - Trusted background jobs continue without browser sessions. Future webhooks need their own authenticated service contract; none are implemented/exempted now.
   - Link the saved complete 19-feature map instead of duplicating it.
   - Use production Hono for sign-in verification; do not add a Vite proxy or imply Vite alone implements sign-in.

7. **New `src/client/assets/plex-icon.svg`: include the official asset unchanged.** Fetch the linked asset and verify its SHA-256 above. No tracing, generic chevron, geometry editing, recoloring, filter, distortion or third-party substitution.

8. **New `src/client/assets/inter-variable.ttf`: include the verified font.** Fetch the linked font and verify SHA-256. Serve locally through Vite; no remote runtime font request.

9. **New `src/client/assets/inter-OFL.txt`: retain the complete upstream font license unchanged.**

10. **New `src/client/components/ui/button.tsx`: add only the needed Base UI button wrapper.** Follow existing shadcn/Base UI configuration and [official Button guidance](https://ui.shadcn.com/docs/components/base/button). Use installed Base UI and `cn`; include only the outline/quiet treatments required here. No added dependency, variant library or component catalogue. Preserve native semantics, disabled behavior and visible focus.

11. **`src/client/globals.css`: implement the narrow light sign-in styling.** Retain imports; add local Inter font-face and CSS variables from Modern utility. Components use Tailwind classes, not inline styles. Ground `#F6F8F7`, primary ink `#152123`, readable secondary ink such as inspected `#53605F`, white controls, `#DAE2DF` borders, dark-green focus and approximately 8px button corners. Keep the Plex action white/dark text so its native black icon remains clear. Require 4.5:1 text contrast and 3:1 focus/control contrast. Do not reproduce the prototype’s low-contrast small labels.

12. **New `src/client/SignIn.tsx`: implement the corrected Shape brief and complete flow.** Operate surface for one owner; narrow left-aligned group on light ground with product name, heading, explanation and one primary action. No sidebar, service status, library preview, decorative card or sign-up.

   | State | Content/action |
   |---|---|
   | Initial | “Sign in”; “Only the owner’s Plex account can open this app.”; “Sign in with Plex” |
   | Privacy | “You’ll sign in on Plex, then return here. This app never receives your Plex password.” |
   | Preparing | “Opening Plex…”; prevent duplicate starts |
   | Handoff | Current-tab navigation to the server-returned URL after validating its exact Plex origin/path |
   | Return | Require one state query parameter; capture it, immediately remove it from history, announce “Checking your Plex account…” and complete |
   | Unclaimed PIN | “Plex sign-in isn’t finished.”; “Check again”, “Try again”, “Cancel” |
   | Browser Back/interrupted handoff | Read `/auth/status`; pending without return state offers “Try again”/“Cancel” |
   | Wrong owner | “This Plex account can’t open this app. Sign in with the owner’s account.”; “Try again” |
   | Provider failure | “Plex sign-in is unavailable. Try again.” |
   | Expired/invalid attempt | Explain expiry or failed verification; “Try again” creates a new attempt |
   | Expired session | “Your session expired. Sign in again.” |
   | Missing configuration | “Sign-in isn’t configured.”; no working sign-in action |
   | Sign-out | Announce success and return to initial screen; failed sign-out never claims server revocation |

   No popup is used, so no popup-blocking state is needed. Navigation failure/interruption retains retry/cancel. Do not poll Plex automatically. Keep captured callback state only in component memory; malformed/duplicate callback parameters must not complete authentication.

   Show the real icon at 24×24 CSS pixels, preserve aspect ratio and use empty alternative text/decorative semantics beside the text label. Phone controls are at least 44px high. Use one layout capped around 400px with 24px phone margins; no horizontal scrolling at 320px.

   Use semantic headings, native controls, visible focus, polite progress and announced errors. Focus the relevant heading/error after completed transitions. Disable duplicate requests, cancel obsolete client requests and ignore stale completion after retry/cancel/sign-out. Keep credentials/owner ID out of browser storage.

13. **`src/client/main.tsx`: gate the shell and connect sign-out.** Check `/api/session` before rendering the signed-in shell. Success retains the existing product heading and adds Sign out; do not invent product screens. Hide shell during checks/after **401**. Recheck on restored page, focus and return from a hidden tab; schedule known absolute expiry. Use `BroadcastChannel` to clear other same-browser tabs immediately after successful sign-out; the server remains authoritative. Stale checks cannot restore a signed-out view.

14. **New `.impeccable/surfaces/src-client-sign-in.md`: record Shape and provenance.** Target `src/client/SignIn.tsx`; record the selected light Modern utility direction, inspected Pen file/node IDs, layout/states/accessibility, official Plex URL/hash/native black fill, font/license sources and trademark-page retrieval limitation. State that current `DESIGN.md` is older for this surface. Record the user’s additional requirement for new Pen frames matching the implementation. In Step 15, append the created frame names/IDs, viewport/state mapping and MCP verification evidence here. Do not rewrite global design.

15. **Active `mediaManager2.pen`, new AA-37 frames only: document the implemented UI through Pen MCP.** Target exactly `/Users/alechenderson/Projects/media-manager-2/.claude/worktrees/codex-design-finish/design/mediaManager2.pen`. The UI executor owns only its newly created AA-37 nodes. Read the Pen skill, schema and execute documentation; use MCP for all Pen reads, edits and verification. Never inspect, copy, hash or diff the source `.pen` through the filesystem.

   Create **26 new editable screen frames**, one 1440×900 desktop frame and one 390×844 phone frame for each of these 13 states, in this order: Initial; Opening Plex; Checking Plex account; Pending; Wrong owner; Plex unavailable; Sign-in not configured; Attempt expired; Session expired; Signed in; Signing out; Sign-out failed; Signed out. Name them `AA-37 / Desktop / <state>` and `AA-37 / Phone / <state>`.

   Use the implemented screen’s text, spacing, type, colors, control states and official Plex icon. Signed in contains only the implemented heading and Sign out. Signed out shows the actual initial screen after successful sign-out; record any nonvisual announcement in frame context without inventing a toast. Pending reflects the returned-but-unclaimed PIN with its implemented actions. Do not draw Plex’s external account page or invent extra product behavior. Use editable native Pen text/layout/control nodes, not a screenshot pasted as the entire frame. Import the official icon’s existing path geometry/viewBox/fill verbatim from the unchanged SVG asset; do not trace, redraw or generate a replacement.

   Before editing, read the current top-level node inventory through MCP and retain its IDs/names/bounds in the execution evidence. Find an empty **1990×13140** area below the existing canvas using `FindEmptySpace`, direction `bottom`, padding 160. Recompute at execution time; do not assume the canvas stayed unchanged. Arrange 13 rows: desktop at the returned x, phone at x+1600; successive rows at y+1020. All screens remain top-level frames with `clip: true`. Keep `placeholder: true` while constructing each frame and remove it when that frame is complete. Do not move existing content to make room.

   Create the first desktop/phone pair, then copy only those newly created AA-37 frames for the remaining states and update their new descendants. Do not modify existing frames, components, variables, themes or bindings. Keep visual values local to the new nodes so existing design tokens remain untouched. Use clear names for every child. Inspect each completed pair through MCP layout bounds/problems and screenshots; fix only new nodes. Record final frame IDs and state mapping in the Step 14 brief.

### Out of scope — do not touch

- `src/server/database.ts`, `src/server/settings.ts`, schema, settings semantics and credential permissions.
- All pre-existing Pen nodes, components, variables and themes; all other `.pen` files; global `DESIGN.md`, `PRODUCT.md`, `CONTEXT.md`, library decisions and unrelated screens. The sole Pen exception is Step 15’s new AA-37 frames in the exact active canvas path.
- Package manifests/lockfile, build/test scripts, Vite configuration, hooks and review tooling.
- AA-38–43 implementations and all other product features in the 19-feature map. Keep their requirements; do not build them here.
- Settings/sample feature endpoints, fake event streams, test-only production routes, authentication bypasses and configurable Plex API origins.
- Friend accounts, passwords, tracker sign-in, first-visitor ownership, token refresh, account/session-management screens.
- No cleanup, no abstractions beyond the specified app factory/auth module/button, no error handling for impossible cases, no backwards-compatibility shims.
- No commits, pushes, merges, deployment or machine configuration changes.

### Verification

Test seam: `tests/production.test.mjs:44` exercises production HTTP behavior. The defect is unauthorized requests reaching private handlers or HTML fallback without a valid server-verified owner session.

Pre-change test baseline: **not run by the scoper**, because Step 1 writes/runs the failing authorization test first. Scoping only inspected source and ran the stated crypto/Plex feasibility probe; no tracked changes resulted. The orchestrator separately reports a successful sanctioned baseline build. The second Mac is unavailable for this repository’s tests in this session; use the authorized local fallback.

Run from the AA-37 worktree with:
```sh
export PATH="/Users/alechenderson/.nvm/versions/node/v22.23.2/bin:$PATH"
```

**Server track**

Step 1 must fail with expected **401**, actual **200**, before implementation. After implementation:
```sh
sh scripts/test.sh --test-name-pattern 'Plex owner authentication|production server serves'
```
Expected exit **0**, all selected tests pass. The matrix must cover:

- Owner success through actual start, callback document, complete and session routes.
- Cryptographic correctness: capture the PIN-creation JWK, reconstruct its public key using Node crypto and verify the compact device JWT’s Ed25519 signature over the exact encoded header/payload. Assert `kty`, `crv`, valid exported `x`, nonempty independent `kid`, `alg`, absence of private `d`; exact JWT `alg`/`typ`/matching `kid`; exact `aud`, matching `iss`, injected-clock `iat`, `exp=iat+60`; identifier consistency across create/check/user requests and handoff; required product/Accept/content-type headers and fixed endpoints. The fixture rejects any mismatch before returning success. Prove the verifier rejects a changed payload/signature and wrong public key; a fixture returning 200 regardless of signature is unacceptable.
- Missing/forged/malformed/duplicate/expired/signed-out cookies; wrong owner, restricted/anonymous identities and malformed/missing IDs.
- HTTPS/loopback cookie attributes, HTTPS rejecting local cookie names, token rotation and absence of credentials in browser output/logs.
- State/browser mismatch, another browser’s callback, missing/duplicate state, replay, PIN expiry, null token and concurrent completion.
- Cancel/restart/logout during unresolved provider verification; resolving it afterward creates no session.
- Provider non-200, malformed JSON/shapes, redirect refusal, timeout/network rejection and failed identity validation. Verify requests receive timeout signals and reject redirects; no fixed waits.
- Exact 24-hour boundary, no sliding extension, process/factory restart invalidation, current-browser sign-out and another device retaining its session.
- Missing/null/foreign origin, spoofed forwarded headers, unsafe methods, wrong content type, excessive bodies and forbidden return-URL inputs.
- Rate-limit boundary, expired-entry cleanup and capacity refusal.
- Every actual route/method in the inventory. `/api` and unknown `/api/*` deny unauthorized callers, including HTML/event-stream Accept; owners receive **404** for unimplemented paths. This does not prove settings or stream implementation.
- Existing static-file, navigation, database and credential-leakage checks remain passing.

**Browser track**

Read Impeccable `reference/craft-floor.md` immediately before UI edits. Context already ran this session; do not rerun it.
```sh
sh scripts/test.sh --full
/Users/alechenderson/.agents/skills/impeccable/scripts/impeccable detect --json --no-design-system src/client/SignIn.tsx src/client/main.tsx src/client/globals.css src/client/components/ui/button.tsx
```
Omit global design matching because the owner replaced this surface’s visual authority. Do not suppress other findings. Report exit status; separate concrete defects from documented false positives.

Review compiled Hono at **1440×900** and **390×844**, plus 320px width/200% zoom. Exercise initial, preparing, return/pending, cancellation, wrong owner, provider failure, expiry, retry, success and sign-out. A temporary local fixture may construct the real app with injected Plex responses for inaccessible states; it must not add production routes or bypass session creation. Mark fixture evidence explicitly.

Check keyboard-only use, focus, announcements, contrast, displayed icon, private-content flashes, Back/restored tabs and same-browser sign-out. Save evidence under `.impeccable/review/aa-37/`. Inspect once, fix in one batch, confirm at most once.

Pen verification is separate from browser behavior and security tests. Through MCP, confirm all 26 named frames exist with the specified viewport dimensions, editable contents, correct state text/actions, unchanged official icon geometry, no remaining placeholders, no clipped content and no overlap. Compare the new desktop/phone frames against the implemented browser states. Retain the pre-existing top-level IDs/names/bounds, and verify none was removed or moved; mutations must have targeted only the new AA-37 IDs. Read any unexpected existing-node change as possible concurrent user work and report it without reverting. Record screenshots and the final frame IDs in the surface brief; do not use filesystem access or Git diff on `.pen` content. The bounded inspection/fix/confirmation rule also applies to the completed Pen pairs. No automated UI-layout test is needed; MCP rendering and browser comparison provide the visual evidence.

**Combined verification by the orchestrator**

After integration and after repairs:
```sh
sh scripts/test.sh --full
git diff --check
git status --short
```
Expected: first two commands exit **0**, all tests pass, changed/untracked files match ownership. Report actual test counts. These commands run in the AA-37 worktree; the active Pen document lives in the separate `codex-design-finish` worktree and is verified only through MCP. The orchestrator also verifies the 26 new frames and preservation of existing canvas content through MCP. Do not copy the `.pen` into another worktree or treat the AA-37 Git status as evidence that the canvas was saved.

Fixtures and visual review do **not** prove live authenticated Plex sign-in. Record a real owner sign-in/sign-out separately if an authorized owner session is available. Otherwise report it pending, alongside the successful unclaimed-PIN protocol probe. Never claim a complete live account round trip from the probe or fixture tests.

### Execution plan

- **Track A, Steps 1–6:** `gpt-5.6-sol`, **high**. Owns `tests/production.test.mjs`, `src/server/auth.ts`, `src/server/app.ts`, `src/server/index.ts`, `README.md`. Security, cryptographic request validation and concurrent completion require careful reasoning. Starts from the exact baseline; runs server checks. No production edit before Step 1’s red output. The Pen addition does not change this already-running track.
- **Track B, Steps 7–15:** `gpt-5.6-sol`, **medium**. Owns the three named assets, button wrapper, `globals.css`, `SignIn.tsx`, `main.tsx`, named surface brief, and only its new AA-37 frames in the exact active Pen document. Appearance, states and HTTP contracts are settled; the added frames reproduce those implemented states rather than require new product decisions. Runs after Track A passes, using its uncommitted implementation in the same worktree; runs browser and Pen checks. No separate approval is needed for the user-requested frames.
- **Concurrency:** serial. Browser work needs real authentication routes, and builds replace shared `dist`. Do not create a checkout omitting Track A’s uncommitted changes or demand a commit. The Pen canvas is shared; refresh its inventory before edits and preserve concurrent user work. Only Track B may mutate the new AA-37 nodes for this task.
- The orchestrator saves this work order at `.scratch/aa-37/work-order.md`, records starting state for each track, runs combined checks and requests fresh Astra review. Review is mandatory for authorization changes. The added Pen requirement is an explicit user instruction; all prior server contracts and first-version requirements remain unchanged.
- The single allowed repair cycle is specified in the appended Repair section and uses `gpt-6.1-sol` **high**. The original Track A/Track B model labels record the completed executions; do not restart them. Return contradicted contracts to the scoper before repair.
- The updated scope-and-run2 skill selects `gpt-6.1-sol` for new Sol execution/repair assignments. Do not reuse the completed workers’ older model selection or substitute unavailable Luna/Terra IDs.
- Executors are not alone in the repository or Pen canvas. Preserve others’ changes. Report steps/files, exact commands, exit statuses, relevant output, created Pen node IDs and unresolved verification limits.

### Executor rules (copy verbatim into the handoff prompt)

> - Follow the steps in order. Do not add, merge, reorder, or skip steps.
> - Before editing in any folder, read the nearest AGENTS.md above it (and the root one) if the repo has them — folder rules and traps bind even when the work order doesn't repeat them.
> - If reality contradicts a Verified fact or a step is impossible as written, STOP and report the discrepancy. Do not improvise a workaround.
> - Before reporting progress, audit each claim against a tool result from this session. Only report work you can point to evidence for. If tests fail, say so with the output.
> - If the work order names a new test, run it before making the change and paste the failing output. A test that passes before the change proves nothing.
> - Completion requires the checks assigned to your track to pass. Report exact commands, working directory, exit status, and relevant output. The orchestrator verifies the combined result.
> - Touch nothing in the Out-of-scope list. Other agents may be working; preserve their edits and existing user changes. Do not commit or push.
> - Deliver what was asked, at the scope intended. If the spec seems mistaken or a better approach exists, say so in a sentence and continue as specified rather than quietly narrowing, widening, or transforming it.

### Repair — single allowed cycle after independent review

Repair only the six findings below. All accepted behavior, the complete 19-feature map, server protocol and existing Pen frames remain binding. The parent’s pre-repair combined check passed 43/43 tests and `git diff --check`; this does not cover the newly identified defects. The two Impeccable findings concern the mandated Inter font. Preserve that selected font.

**Verified repair facts**

- `src/server/app.ts:30` distinguishes duplicate/invalid cookies. Cancel at line 190 and logout at line 198 ignore ambiguous values and return 204, so the browser can claim cancellation/revocation while server state survives.
- `src/client/main.tsx:42` checks sessions; line 57 preserves a mounted signed-out view after a failed check. The restored-page listener at line 72 does not refresh that view’s pending-attempt status. `src/client/SignIn.tsx:150` navigates away while retaining `preparing`.
- `src/client/main.tsx:60` chooses the expired message only from the server error. A browser that already removed its expired cookie receives `unauthenticated`, losing the known expiry reason.
- `src/client/main.tsx:162` renders a heading without programmatic focus; successful sign-in unmounts the focused checking heading. `src/client/SignIn.tsx:246` already focuses its own state headings.
- `src/client/SignIn.tsx:167` starts cancellation without a synchronous duplicate guard or busy state. Its pending/interrupted actions at lines 327 and 334 remain enabled during that request.
- `.impeccable/review/aa-37/browser-review.md:15` correctly says the requested 200% browser zoom was not applied. The claim at line 21 about restored-page recovery needs narrower, observed evidence.
- `/Users/alechenderson/.agents/skills/scope-and-run2/SKILL.md:10` now names `gpt-6.1-sol` for new Sol assignments; lines 58 and 78 allow this one repair/review cycle.

**Ordered edits and checks**

1. **`tests/production.test.mjs`, existing `Plex owner authentication` group: add the failing regression before production edits.** Reuse `makeApp`, `startAuthentication`, `completeAuthentication`, cookie helpers and public requests. Add a defect comment explaining that acknowledging ambiguous cancellation/sign-out as successful must fail. Cover both `/auth/cancel` and `/auth/logout`, with duplicate binding cookies, duplicate session cookies, and malformed present values for either appropriate cookie name. Include equal duplicate values as well as differing values. Obtain real attempts/sessions through the production routes; never seed internal state. Expect **400** `{error:"invalid_request"}`, no cookie deletion and no session/attempt mutation. After rejection, use the original unambiguous cookies to prove the session remains valid and the pending attempt remains pending; then retry with those cookies, require 204 and prove the intended cancellation/revocation. Preserve missing-cookie idempotence and the existing other-device-session check. Table-drive equivalent cases; do not duplicate the full suite. Run `sh scripts/test.sh --test-name-pattern 'Plex owner authentication'` now and retain expected **400**, actual **204** output. Stop if it does not reproduce; do not fabricate red proof.

2. **`src/server/app.ts`, cancel/logout handlers: reject ambiguous input before effects.** After existing origin/body checks, read both applicable authentication cookie names. If either is duplicate or malformed, return **400** `{error:"invalid_request"}` without calling cancellation/logout or setting/deleting cookies. Validate the whole request before any mutation, including when the other cookie is valid. Missing cookies remain permitted and idempotent; a single syntactically valid unknown token remains an idempotent no-op. On valid input, preserve current 204 behavior and cookie attributes. Do not change the auth module, protocol, expiry, other routes or add an abstraction. Rerun the focused suite; it must pass.

3. **`src/client/SignIn.tsx`, restored-page recovery: refresh only an interrupted outbound handoff.** Reuse the existing `/auth/status` request/response handling as a local callback and call it on normal initial entry as today. Add a `pageshow` listener that checks `event.persisted` and the current view. Only when the restored view is `preparing` and there is no captured callback state, supersede the old outbound request and read `/auth/status`. A configured pending attempt becomes the existing interrupted state with enabled Try again/Cancel; no pending attempt becomes initial; existing unavailable/not-configured handling remains. Clean up the listener and preserve request-version checks. Do not remount SignIn on ordinary focus/visibility/session checks, reread a scrubbed callback URL, clear genuine pending callback state, or interrupt active callback verification. The existing main session check remains authoritative and may replace the view on a valid session. This is local component wiring, not a new event framework or public API.

4. **`src/client/main.tsx`, expiry reason and completed focus: preserve known expiry across checks.** Retain the last verified session expiry in a ref independent of transient `checking` state. Set it on a successful session response or completed sign-in; clear it on explicit successful sign-out, cross-tab sign-out, or after consuming it into a final signed-out result. On **401**, choose `session-expired` when the server says `session_expired` or the last verified expiry is at/before the current browser time. Otherwise use normal signed-out handling. Never treat local expiry as authorization, keep private content hidden while checking, and preserve stale-response/version guards. Network failures must not be relabelled as confirmed expiry solely from an error. Add a heading ref and `tabIndex={-1}` to the signed-in product heading. Schedule focus after successful authentication commits that heading; cancel stale scheduled focus on unmount/sign-out. Do not steal focus on routine session rechecks or add a new visible success screen.

5. **`src/client/SignIn.tsx`, cancellation: prevent duplicate or competing actions until completion.** Add a synchronous ref guard plus rendered cancellation-busy state. Set the guard before starting the request, retain the pending/interrupted layout, mark the section busy, announce “Cancelling sign-in…” and label the Cancel button “Cancelling…”. Disable every visible action in that group with native disabled behavior. Start, Check again and Cancel handlers must also refuse competing activations while cancellation is active, covering repeated events before React rerenders. Ignore stale results using existing request versions; only the current cancellation may release its lock/busy state. A 204 clears callback state and returns to initial with the existing success announcement. A rejected/network-failed cancellation must not announce success: render “Plex sign-in couldn’t be cancelled.” with “Try cancelling again” and “Try again”. The first retries cancellation; the second begins a replacement attempt through the existing start route. Retain captured callback state until cancellation succeeds or a replacement flow deliberately supersedes it, but do not offer Check again from the cancellation-failure state. Aborted obsolete requests/unmounts must not update a later view. No new dependencies or general state-machine abstraction.

6. **Browser/Pen evidence and brief: verify the repairs and reflect only changed visuals.** Update `.impeccable/review/aa-37/browser-review.md` with observed commands/actions/results, replacing the unsupported broad restored-page claim. Use the existing temporary real-app/provider fixture or a replacement with the same constraints; do not add production fixture endpoints or seed sessions. Preserve the 26 accepted AA-37 frames and all 30 earlier top-level nodes. Through Pen MCP only, add one desktop/phone pair for Cancelling sign-in and one pair for Cancellation failed, copied from the new AA-37 pending frames, reflecting Step 5’s actual implemented UI. Names are `AA-37 / Desktop / Cancelling sign-in`, `AA-37 / Phone / Cancelling sign-in`, `AA-37 / Desktop / Cancellation failed`, and `AA-37 / Phone / Cancellation failed`. Place these four top-level frames in fresh empty space below the AA-37 group with 160px separation, desktop 1440×900 and phone 390×844. Use the existing Step 15 placeholder, editable-node, icon and MCP-only rules. Update only previously created AA-37 nodes if an existing visual changed; do not modify the 30 pre-AA-37 nodes or global components/variables. Append IDs/screenshots/state mapping to `.impeccable/surfaces/src-client-sign-in.md`. Expected task-owned total becomes **30 AA-37 frames**; record the actual canvas total and any concurrent additions instead of assuming it. Do not read/hash/diff `.pen` files through the filesystem, and do not claim autosave/on-disk persistence without a tool result confirming it.

**Repair verification**

Use Node 22 PATH and the AA-37 worktree from the original Verification section. After Step 1’s negative proof and Step 2’s focused pass, run:
```sh
sh scripts/test.sh --full
git diff --check
/Users/alechenderson/.agents/skills/impeccable/scripts/impeccable detect --json --no-design-system src/client/SignIn.tsx src/client/main.tsx src/client/globals.css src/client/components/ui/button.tsx
```
The first two commands must exit 0. Report actual test count. Report detector output honestly; do not change the required Inter font to silence its known warnings. Investigate any new finding. No wall-clock sleeps, new test dependencies or copied implementation assertions.

Browser regressions use the compiled app, public routes and observed conditions. Capture the broken restored-page/focus/cancel behavior before their UI edits when the available browser permits it; report the exact reproduction limit otherwise. After edits, require these checks:

- Start sign-in, navigate to the provider and Back. A persisted `pageshow` from the outgoing page must recover to actionable interrupted/initial state instead of remaining Opening Plex. If the browser does not retain the page, additionally dispatch a documented synthetic persisted PageTransitionEvent while the actual outgoing view is preparing and label this event simulation; a normal reload alone is not proof. Ordinary focus/visibility and a persisted restoration of a genuine pending callback must retain Check again and its original callback state; it can still finish the flow.
- With a previously verified session, advance the browser clock past its stored expiry using the browser’s supported clock controls or an explicitly labelled browser test fixture, remove the expired cookie to reproduce browser Max-Age behavior, then restore/focus the page. The real session route must return **401 unauthenticated**, private content stays hidden, and “Your session expired.” appears. An unexpired revoked session shows ordinary signed-out copy; successful explicit/cross-tab sign-out still shows its signed-out announcement. Do not wait 24 hours or invent production time controls.
- Complete sign-in through the fixture’s real flow using the keyboard. After rendering the signed-in shell, `document.activeElement` is its heading; Tab reaches Sign out. A routine successful session recheck must not deliberately redirect focus to the heading.
- Hold the cancel response using a controllable browser/fixture request barrier. Repeated Cancel/Check again/Try again activation while held produces only one cancel request and no competing start/complete request. The rendered buttons are disabled and busy state is announced. Release 204 and verify initial state; separately release 400/network failure and verify the actionable cancellation-failure state with no success claim. Retry cancellation successfully. Verify stale results after replacement/unmount cannot restore an earlier view. Drive barriers by observed requests/promises, not fixed sleeps.
- Recheck the changed states at 1440×900 and 390×844 and existing 320px reflow; check focus/announcements/disabled semantics and the four added Pen frames. One bounded inspection, one batch of corrections, one confirmation.

For the outstanding **200% browser zoom**, make one bounded capability attempt using the available CUA browser/native menu or documented browser zoom API. Read that surface’s tool documentation, set zoom to 200%, and verify the browser UI/API reports 200% before claiming success. Check initial, pending and cancellation-failure screens for readable text, reachable controls and no clipping; restore the prior zoom afterward. Device scale factor, screenshots enlarged afterward and CSS `zoom` are not browser zoom. If genuine zoom cannot be controlled/verified, retain the explicit “200% browser zoom unverified” limitation. As supplemental evidence only, a temporary browser style may enlarge the rendered text to twice its computed size; record measured before/after font sizes and recheck wrapping/controls, then remove that style. This supplement does not satisfy the original browser-zoom acceptance criterion. Source repairs may be accepted with that named manual verification item still open; the final report must not call all verification complete.

**Repair execution and scope**

One fresh repair executor: `gpt-6.1-sol`, **high**. Security-cookie atomicity, preserved callback state across browser lifecycle events and stale async responses justify this effort. Run serially in the current AA-37 worktree, retaining both completed tracks’ uncommitted changes. Owned implementation files: `tests/production.test.mjs`, `src/server/app.ts`, `src/client/main.tsx`, `src/client/SignIn.tsx`. Owned evidence: `.impeccable/review/aa-37/`, `.impeccable/surfaces/src-client-sign-in.md`; owned Pen changes: only the existing task-created AA-37 nodes and the four specified additions. The temporary browser fixture may be adapted outside production source. All other original fences remain, including no auth-module/database changes, dependencies, commits, pushes or merges. No source cleanup or extra product work.

The executor must read the original full work order plus this appendix and preserve other agents’ edits. Report red and green proof, browser evidence, Pen node IDs, exact save-status evidence or its absence, and remaining limits. The parent reruns the original combined verification and requests one fresh Astra review of the repaired result against both documents. This is the one allowed repair cycle; if that review still finds a blocking defect, report it rather than beginning another autonomous cycle.

### Repair clarification — re-entry after a previously verified session

This clarifies Step 4 of the existing single repair cycle; it does not authorize another cycle, new feature or broader cleanup. The current `gpt-6.1-sol` **high** repair worker may resume the same assignment after reading this addendum. Ownership and all other acceptance criteria remain unchanged.

Personally verified current source: `src/client/main.tsx:59` stores the verified expiry, but lines 64–65 clear it and pass an undefined entry reason after unexpired rejection. `src/client/SignIn.tsx:239` interprets that undefined reason on `/auth/callback` as a fresh provider return, although line 246 already scrubbed the earlier callback query. This produces the invalid-callback message when the user needs an ordinary sign-in screen. The worker’s real fixture reproduction is the negative evidence; the earlier 44 passing server tests do not prove this browser transition.

1. In `src/client/main.tsx`, extend the signed-out reason union with `session-unavailable`. In each current session-check failure path that changes a previously verified session to signed-out, determine whether `verifiedExpiryRef.current` is present before clearing it. Keep the existing 401 expiry calculation. Select `session-expired` for that confirmed expiry condition; otherwise select `session-unavailable` when a verified expiry was present, and leave the reason undefined for an initial unauthenticated entry that has never verified a session. Apply the same previously-verified distinction to the network-error fallback, without labelling network failure as expiry or successful sign-out. Read this evidence from the independent ref, not only `previous.kind`, because overlapping focus checks may see transient `checking`. Preserve request-version guards and clearing of the consumed expiry. Explicit successful sign-out and cross-tab sign-out retain their existing `signed-out` reason.

2. In `src/client/SignIn.tsx`, add the matching optional `session-unavailable` entry reason. It means that the main component has already verified and subsequently lost a session; it must skip fresh callback parsing and use the existing status-refresh path. The current `entryReason === undefined` callback condition already expresses that boundary once the new reason is supplied. Do not add persistent browser storage, a URL exception, a global consumed-callback flag, or erase real callback validation. For a configured response with no pending attempt and no expiry reason, render the existing initial Sign in screen and explicitly set its announcement to `Signed out.` only for `entryReason === 'signed-out'`, otherwise the empty string. This also clears a stale interrupted/pending announcement after a status refresh reports no pending attempt. Preserve the separate not-configured, unavailable, pending and expired branches.

3. Resume the existing bounded browser verification. Through real fixture start/callback/completion, reach a verified unexpired session while the address remains the scrubbed `/auth/callback`. Revoke that session through real logout, then focus/restore: require real `/api/session` **401 unauthenticated**, followed by the configured/no-pending status result and the ordinary Sign in screen. Assert no invalid-callback message, no expiry message and no `Signed out.` success announcement. Record this as the repaired counterpart to the existing failed reproduction. Also retain checks that a fresh valid callback still completes, a fresh missing/duplicate-state callback remains invalid, genuine pending callback state survives ordinary focus and can complete, expiry retains its expiry copy, and explicit/cross-tab sign-out retains its success announcement. A network failure after a verified session must keep private content hidden without reinterpreting the scrubbed callback as a new return. Do not expand this into unrelated browser behavior.

Rerun `sh scripts/test.sh --full` and `git diff --check` after the clarification edit; record actual output alongside the browser evidence. No new Pen frame is needed: this result uses the existing Initial frame and changes callback handling/announcements only. Continue the remaining checks and the single fresh re-review already required by the repair appendix. Do not claim completion from the earlier 44-test pass.

## Additional repair authorized by the owner

### Goal

Repair the remaining AA-37 cancellation defect so sign-out from another tab leaves the mounted sign-in screen actionable. This is the additional repair explicitly authorized by the user; it supersedes the previous cycle limit only for this defect. Preserve the original work order, accepted repairs and complete 19-feature map.

### Verified facts

- `SignIn` retains cancellation ownership in `cancellationVersionRef` and renders its busy state separately: `src/client/SignIn.tsx:68`.
- `beginRequest` aborts the previous request and advances its version: `src/client/SignIn.tsx:79`. Start, completion and cancellation reject actions while cancellation owns the guard: lines 92, 141 and 175.
- Cancellation releases its guard only when both request version and cancellation ownership still match: `src/client/SignIn.tsx:196`.
- `refreshStatus` supersedes the active request without releasing cancellation ownership, then can render initial sign-in: `src/client/SignIn.tsx:204`, `src/client/SignIn.tsx:226`.
- A cross-tab `signed-out` message changes the mounted component’s entry reason: `src/client/main.tsx:98`, `src/client/main.tsx:177`. Its entry effect then calls `refreshStatus`: `src/client/SignIn.tsx:238`.
- The temporary fixture serves the compiled real application, verifies provider signatures, holds cancellation requests and exposes normal browser controls: `/tmp/aa37-browser-fixture.mjs:29`, `:66`, `:81`, `:95`. Its existing browser fetch instrumentation already holds successful start responses: `:13`.
- The earlier browser review checks obsolete cancellation after **unmount**, not this mounted-component replacement: `.impeccable/review/aa-37/browser-review.md:45`.
- The test wrapper builds before running production tests; `--full` also checks the review script: `scripts/test.sh:38`. Building replaces shared `dist`: `scripts/build.sh:6`.
- The current workflow names `gpt-6.1-sol` for new Sol assignments: `/Users/alechenderson/.agents/skills/scope-and-run2/SKILL.md:10`.

### Steps

1. **Temporary fixture and browser evidence: reproduce before editing production source.** Extend `/tmp/aa37-browser-fixture.mjs` only as needed to hold delivery of an actual cancellation response and release individual held responses. Preserve real routes, cookies and session creation; do not seed authentication state. Record a defect statement: “Replacing cancellation with a status request must not leave sign-in actions permanently blocked.”

   Reach genuine pending/interrupted sign-in, start cancellation and observe its held response. Cause another same-origin tab to complete real `/auth/logout` and deliver `signed-out` through `BroadcastChannel`. Prefer the application’s actual Sign out control. If browser focus makes that sequence unavailable, use an explicitly labelled temporary fixture control that performs the real logout and sends the message; record that the notification was fixture-generated.

   Require configured/no-pending `/auth/status`, initial Sign in, and a click on “Sign in with Plex”. Before the fix, record the retained busy state and absence of a new `/auth/start` request. Stop if the defect does not reproduce. Use normal CUA browser input; evaluation may only inspect. Put any instrumentation or simulated events in the temporary fixture, never browser evaluation or production source.

2. **`src/client/SignIn.tsx`, `refreshStatus`: release superseded cancellation ownership.** Immediately after its existing synchronous `beginRequest` call, clear any obsolete `cancellationVersionRef` and its rendered `cancellationBusy` state, before awaiting the status response. This status request now owns the replacement operation.

   Keep the cancellation handler’s existing current-version-and-owner check in `finally`; an old cancellation must never clear a later cancellation’s guard or busy state. Keep all action guards and stale-result checks. Do not clear captured callback state here, change effect dependencies, remount SignIn, or change status-result handling. Preserve failure/retry behavior, genuine pending callback recovery, announcements and focus.

3. **`.impeccable/review/aa-37/browser-review.md`: append observed repair evidence.** Repeat Step 1 after rebuilding and require initial sign-in with `aria-busy=false`, an actionable button and a new real `/auth/start` **201**.

   Also hold delivery of that successful replacement start response. Releasing the obsolete cancellation must leave Opening Plex and its announcement intact. For the later-cancellation case, retain one obsolete cancellation delivery, recover the replacement attempt through the existing fixture’s labelled persisted-page event, and start a second held cancellation. Release the obsolete response first: the second cancellation must remain busy, its actions disabled, and its announcement unchanged. Release the current response and require its correct success/failure result.

   Recheck duplicate-action blocking during current cancellation, failed cancellation followed by successful retry, genuine pending callback preservation through ordinary focus, successful callback completion and heading focus. Record request counts, response statuses, page state and active element. Identify fixture-generated notifications/events explicitly.

### Out of scope — do not touch

- All production files except `src/client/SignIn.tsx`, including `main.tsx`, server files, existing tests, styles, dependencies and build scripts.
- All Pen documents, frames, surface briefs and design assets. This repair introduces no new visual state.
- `docs/handover-2026-10-08-aa37.md`, owned by the separate handover writer.
- Original server contracts, callback validation, expiry handling and the 19-feature map.
- No cleanup, no abstractions, no error handling for impossible cases, no backwards-compat shims.
- No permanent browser-test framework, production fixture endpoints or authentication bypasses.
- No executor commits, staging, pushes or merges; the parent handles the user-authorized Git work.

### Verification

**Test seam:** the compiled-app browser fixture at `/tmp/aa37-browser-fixture.mjs:6`, with retained results in `.impeccable/review/aa-37/browser-review.md:29`. It catches cancellation ownership surviving a replacement status request. The existing server suite cannot observe this React transition.

**Baseline:** I inspected the saved prior result showing 44 passing tests, zero failures, and the detector’s two Inter warnings. I ran `git diff --check`, exit 0. I did not rerun the suite or claim browser reproduction during scoping; Step 1 supplies the required pre-edit negative proof. Scoping changed no files. HEAD remains `c6ede2f9cf7e248202137df90c619a8926519088`, with the existing AA-37 implementation uncommitted.

Run from `/Users/alechenderson/Projects/media-manager-2/.claude/worktrees/codex-aa37-plex-sign-in`:

```sh
export PATH="/Users/alechenderson/.nvm/versions/node/v22.23.2/bin:$PATH"
sh scripts/test.sh --full
git diff --check
/Users/alechenderson/.agents/skills/impeccable/scripts/impeccable detect --json --no-design-system src/client/SignIn.tsx src/client/main.tsx src/client/globals.css src/client/components/ui/button.tsx
git status --short
```

The suite and whitespace check must exit 0; expect the existing 44 tests and report the actual count. Detector exit 2 is accepted only for the existing Inter warnings at `globals.css:5` and `:41`; report any new finding.

The parent owns the second-Mac availability decision. Use its confirmed remote arrangement if available; otherwise record local fallback. Browser verification requires the rebuilt local application. Do not run simultaneous builds against shared `dist`.

Preserve the existing limitations: genuine 200% browser zoom and live Plex owner sign-in remain unverified. Earlier Pen save-status limitations remain unchanged.

### Execution plan

One fresh serial repair track owns Steps 1–3.

- **Model:** `gpt-6.1-sol`. The scoped edit is small, but proving overlapping cancellation responses without weakening authentication-flow behavior requires careful integration work.
- **Effort:** `high`, for the controlled browser reproduction and stale-response checks.
- **Owned files:** `src/client/SignIn.tsx`, `.impeccable/review/aa-37/browser-review.md`, and narrowly named supporting evidence under that review directory. Temporary fixture changes are permitted at `/tmp/aa37-browser-fixture.mjs`.
- **Starting state:** exact HEAD above plus all current uncommitted AA-37 changes. Read the complete saved work order and this addition. Preserve others’ edits.
- **Concurrency:** source repair stays in the current worktree because it depends on uncommitted implementation. The disjoint handover writer may continue; no concurrent build or fixture mutation.
- **Completion:** executor supplies negative/positive browser evidence and exact command results. Parent independently reruns combined commands, then requests a fresh `gpt-6-astra` review at `high` effort. No further repair cycle is implied by this addition.

### Executor rules (copy verbatim into the handoff prompt)

> - Follow the steps in order. Do not add, merge, reorder, or skip steps.
> - Before editing in any folder, read the nearest AGENTS.md above it (and the root one) if the repo has them — folder rules and traps bind even when the work order doesn't repeat them.
> - If reality contradicts a Verified fact or a step is impossible as written, STOP and report the discrepancy. Do not improvise a workaround.
> - Before reporting progress, audit each claim against a tool result from this session. Only report work you can point to evidence for. If tests fail, say so with the output.
> - If the work order names a new test, run it before making the change and paste the failing output. A test that passes before the change proves nothing.
> - Completion requires the checks assigned to your track to pass. Report exact commands, working directory, exit status, and relevant output. The orchestrator verifies the combined result.
> - Touch nothing in the Out-of-scope list. Other agents may be working; preserve their edits and existing user changes. Do not commit or push.
> - Deliver what was asked, at the scope intended. If the spec seems mistaken or a better approach exists, say so in a sentence and continue as specified rather than quietly narrowing, widening, or transforming it.
