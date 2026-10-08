# AA-41 work order: Run background work and deliver browser updates

### Goal

Implement Linear AA-41 in the media-manager-2 Hono server: a background-job runner that keeps scheduled work running with every browser closed, an in-memory event hub other epics publish into, and an authenticated server-sent-events route `GET /api/events` that pushes those events to the signed-in owner's browser. This is plumbing for later epics (AA-33 rTorrent polling, AA-34 health): they register jobs and publish events; this ticket delivers neither real jobs nor event contents. The owner session is re-checked before every private write so sign-out or expiry stops delivery, and the process stops cleanly on SIGTERM/SIGINT without leaving duplicate timers.

### Verified facts

- Baseline: worktree `/Users/alechenderson/Projects/media-manager-2/.claude/worktrees/aa-41-background-updates`, branch `claude/aa-41-background-updates`, HEAD `80f1481e3a3bfb3ec7596a1be99804acbb8c1016`, `git status --short` empty. No folder-level AGENTS.md exists; root `AGENTS.md` rules apply (no wall-clock waits `AGENTS.md:101`, defect comment per test `AGENTS.md:85`, wrappers only `AGENTS.md:54`).
- `createApp(options)` and its option type: `src/server/app.ts:8-15` (`clientDirectory, listeningHost, ownerPlexId?, publicOrigin?, now?, fetch?`). Context variables type `AppEnvironment.Variables` has only `sessionExpiresAt`: `src/server/app.ts:17-21`.
- `privateGuard` reads the session cookie, calls `authentication.validateSession(session.value)`, sets `sessionExpiresAt`, and is mounted with `app.use('/api', …)` and `app.use('/api/*', …)` at `src/server/app.ts:224-241`. `GET /api/session` is at line 242; the JSON 404 catch-alls for `/api` and `/api/*` are lines 243-244. Routes registered between 242 and 243 run after the guard.
- `authentication.validateSession(session?: string)` returns `{ kind: 'success', expiresAt } | { kind: 'unauthenticated' | 'expired' }` and deletes an expired session: `src/server/auth.ts:355-365`. `logout` deletes the session hash: `src/server/auth.ts:350-353`. Session lifetime is 24 h: `src/server/auth.ts:16`.
- The app-wide middleware sets `Cache-Control: no-store` after `next()`: `src/server/app.ts:94-100`. Hono's `c.header()` writes onto the already-created response when one exists (`node_modules/hono/dist/context.js`, `header = (name, value, options) => { … this.#res ? this.#res.headers : …`). Probe confirmed: a `streamSSE` response passes through that middleware with `cache-control: no-store`.
- Hono 4.13.13 (`package.json:19`). `streamSSE(c, cb, onError?)` is exported from `hono/streaming` (`node_modules/hono/package.json:286-290`, `node_modules/hono/dist/types/helper/streaming/sse.d.ts:14`). It sets `Content-Type: text/event-stream`, runs `cb` synchronously up to its first `await`, and calls `stream.close()` when `cb` resolves: `node_modules/hono/dist/helper/streaming/sse.js:26-55`. `writeSSE({data, event?, id?})` emits exactly `event: <event>\ndata: <data>\nid: <id>\n\n` in that order and throws if `event` or `id` contains `\r`/`\n`: `sse.js:9-25`. `stream.write(text)` writes raw text and swallows write errors; `stream.onAbort(listener)` fires when the readable is cancelled: `node_modules/hono/dist/utils/stream.js:28-36, 38-44, 69-71`.
- Probe (Node 22.23.2, `app.request()`): each `write`/`writeSSE` arrives as one `reader.read()` chunk; `reader.cancel()` fires `onAbort`, after which the callback can resolve and `stream.closed` becomes true; when the callback resolves server-side, the client's next `reader.read()` returns `{ done: true }`; the callback body runs before `app.request()` resolves.
- Hono routes HEAD to the GET handler and discards the body: `node_modules/hono/dist/hono-base.js:263`. `c.req.method` returns the raw method (`node_modules/hono/dist/request.js:218-220`), so a handler can refuse HEAD; probe confirmed HEAD gets the handler's 405.
- `@hono/node-server` 2.1.4: when the Node response socket closes it cancels the body reader (`node_modules/@hono/node-server/dist/index.mjs:758-766`), which reaches `onAbort`. `serve()` returns `ServerType = Server | Http2Server | Http2SecureServer` (`node_modules/@hono/node-server/dist/index.d.mts:46, 78`); with no `createServer` option it is an `http.Server`. `http.Server.closeAllConnections` exists in Node 22 (probe: `typeof … === 'function'`).
- `src/server/index.ts:10-28`: opens the database, calls `createApp({ clientDirectory, listeningHost, ownerPlexId, publicOrigin })`, then `serve(...)` logging `Listening on http://…`. No signal handlers exist.
- Tests: single file `tests/production.test.mjs`; `makeApp` builds the app from `dist/server/app.js` with an injected `clock = { value }` and Plex fixture (`tests/production.test.mjs:325-343`); `startAuthentication` (345), `completeAuthentication` (355), `plexStateFromUrl` (193), `cookieValue` (188), `jsonHeaders` (174). Logout call shape: `tests/production.test.mjs:696-698`. Expiry is driven by setting `clock.value` (677). The production-server test spawns `dist/server/index.js`, keeps `exited = once(child, 'exit')` and sends SIGTERM in `t.after` only if the child is still running (`tests/production.test.mjs:47-71`). Module URL constants are at lines 23-26.
- Baseline count: 44 tests (16 in `production server serves…`, 19 in `Plex owner authentication`, 9 standalone). `scripts/test.sh` builds then runs `node --test "$@" tests/production.test.mjs` (`scripts/test.sh:45-46`); `--full` adds the review-script check (`scripts/test.sh:41-43`).
- README's AA-41 obligation paragraph is `README.md:56`; background-jobs paragraph `README.md:58`; route list `README.md:42-48`. `docs/handover-2026-10-08-aa37.md:41` says "no stream exists yet" (dated handover, left alone).
- `scripts/review-branch.sh:62-70` has no risk paths configured.

### Steps

1. **`tests/production.test.mjs`, module constants (after line 26): add `eventsModuleUrl` and `jobsModuleUrl`** pointing at `../dist/server/events.js` and `../dist/server/jobs.js`, same form as line 25.

2. **`tests/production.test.mjs`, `makeApp` (lines 325-343): pass through two new inputs.** Destructure `events` and `timers` from `input` alongside `fetch, fixtureOptions` and pass them to `createApp` as `events` and `timers`. Omitted values stay `undefined` so every existing call is unchanged.

3. **`tests/production.test.mjs`, new helpers next to `completeAuthentication` (after line 359):**
   - `createFakeTimers(clock)` returns `{ setInterval, clearInterval, advance }`. `setInterval(callback, ms)` stores `{ callback, ms, remaining: ms }` in a Set and returns that object as the handle; `clearInterval(handle)` deletes it; `advance(elapsed)` first does `clock.value += elapsed`, then for each stored handle (snapshot of the Set) subtracts `elapsed` from `remaining` and, while `remaining <= 0` and the handle is still in the Set, adds the handle's own `ms` (its interval) back to `remaining` and calls `callback()`. Setting `clock.value` directly never fires anything.
   - `signIn(app)` performs `startAuthentication` → `completeAuthentication` with `plexStateFromUrl(...).state`, asserts status 200, and returns `{ session: cookieValue(completed, '__Host-mm_session'), expiresAt: (await completed.json()).expiresAt }`.
   - `openStream(app, session)` does `app.request('/api/events', { headers: { Cookie: session } })` and returns `{ response, reader: response.body.getReader(), next }` where `next()` awaits `reader.read()` and returns `{ done, text }` with `text` decoded by a `TextDecoder`. A test ends a stream by `await reader.cancel()` (client disconnect) or by reading until `done` is true (server-side close).
   - `drain()` returns `new Promise((resolve) => setImmediate(resolve))`; it lets a finished job clear its in-flight state before the next `advance`.

4. **`tests/production.test.mjs`, production-server test (lines 47-172): add the last subtest `'SIGTERM exits with code 0'`** after the `/api/session` subtest. It calls `child.kill('SIGTERM')` and awaits `once(child, 'exit', { signal: AbortSignal.timeout(5_000) })` (mark the line `real-time-ok: ceiling on process exit, not a fixed wait`), then asserts code `0` and signal `null`. The existing `t.after` then sees `exitCode !== null` and skips its kill. Comment: "Removing the signal handler or failing to close the HTTP server leaves SIGTERM exiting by signal instead of code 0." Run `sh scripts/test.sh --test-name-pattern 'production server serves'` and keep the red output (currently exits by signal `SIGTERM`, code `null`).

5. **`tests/production.test.mjs`: add top-level `test('event stream delivery', …)` after the `Plex owner authentication` test (after line 867)** with these subtests, each built via `makeApp({ clock, events, timers })` where `events = (await import(eventsModuleUrl)).createEventHub()` and `timers = createFakeTimers(clock)`:
   1. `'unauthenticated, expired and revoked sessions get 401 JSON and HEAD gets 405 before any stream'`: no cookie → 401 `{error:'unauthenticated'}` with JSON content-type; signed-in then logged-out session (logout call shape at lines 696-698) → 401 `{error:'unauthenticated'}`; signed-in session after `clock.value += 24 * 60 * 60_000` → 401 `{error:'session_expired'}`; signed-in `HEAD /api/events` → 405. Comment: "Registering the stream route outside the owner guard, or letting HEAD open a stream, turns this red."
   2. `'an owner session receives published events with id, event and data framing'`: `openStream`; assert status 200, content-type starts with `text/event-stream`, cache-control `no-store`; `events.publish('demo', { value: 1 })` returns `1` and the next chunk is exactly `event: demo\ndata: {"value":1}\nid: 1\n\n`; `events.publish('demo', [2])` returns `2` and the next chunk is `event: demo\ndata: [2]\nid: 2\n\n`; then `reader.cancel()`. Comment: "Changing the event, data or id framing, or dropping the stream route, turns this red."
   3. `'logout ends the stream before the next event and later events are not delivered'`: open stream, publish and read one event, logout, publish again → next read has `done === true`. Comment: "Skipping session revalidation before an event write turns this red."
   4. `'keepalive comments are written every 25 seconds and expiry closes the stream at the next keepalive'`: open stream; `timers.advance(25_000)` → chunk `: keepalive\n\n`; `advance(25_000)` → same; set `clock.value = expiresAt` from `signIn`; `advance(25_000)` → `done === true`. Comment: "Removing the keepalive, changing its 25-second period, or skipping revalidation at the keepalive turns this red."
   5. `'a reconnecting browser receives only events published after it reconnects'`: stream A reads event id 1; `readerA.cancel()`; stream B with the same session; publish → B's first chunk contains `id: 2` and not `id: 1`; cancel B. Comment: "Replaying earlier events to a new stream, or failing to deliver after a reconnect, turns this red."
   6. `'the 21st concurrent stream is refused with 503 and a closed stream frees its slot'`: open 20 streams (each status 200); the 21st `app.request` → 503 `{error:'too_many_streams'}` JSON; cancel one reader; the next request → 200; cancel every reader. Comment: "Removing the stream cap, or failing to release a slot when a client disconnects, turns this red."

6. **`tests/production.test.mjs`: add top-level `test('background job runner', …)` after step 5's test** using `const { createJobRunner } = await import(jobsModuleUrl)`, a `clock`, `createFakeTimers(clock)` passed to `createJobRunner(timers)`, and `drain()` after every `advance`:
   1. `'runs each job once per interval after start, with no immediate run and no duplicate timer from a second start'`: register `'a'` at 1000 ms counting runs; `start()`; `advance(500)` → 0; `start()` again; `advance(500)` → 1; `advance(500)` → 1; `advance(500)` → 2. Comment: "Running a job at start, or letting a second start add a second timer, turns this red."
   2. `'skips a tick while the previous run is in flight'`: job awaits a gate promise; `advance(1000)` → 1 run; `advance(1000)` → still 1; resolve gate, drain; `advance(1000)` → 2. Comment: "Letting a tick start a run while the same job's previous run is unfinished turns this red."
   3. `'a failing job is logged by name only and keeps its schedule'`: `t.mock.method(console, 'error', () => {})`; for each of a synchronously throwing job and an `async` rejecting job (error message `'secret-value'`, job name `'risky'`) in a fresh runner: `advance(1000)` twice → 2 runs; `console.error.mock.calls.length >= 1`; the JSON of all logged arguments contains `risky` and does not contain `secret-value`. Comment: "Letting a job's exception escape the timer, or logging the error contents, turns this red."
   4. `'stop awaits the in-flight run, fires nothing afterwards, and start resumes the schedule'`: gated job; `advance(1000)` → 1 in flight; `const stopping = runner.stop()` with a `.then` flag; drain → flag false; resolve gate; `await stopping`; `advance(5000)` → still 1; `runner.start()`; `advance(1000)` → 2. Comment: "Resolving stop before the in-flight run finishes, or leaving the old timer scheduled after stop, turns this red."
   5. `'duplicate names and registering after start throw'`: registering `'a'` twice throws `{ message: 'Duplicate job: a' }`; after `start()`, registering `'b'` throws `{ message: 'Register jobs before start.' }`. Comment: "Silently accepting a duplicate or late registration turns this red."

   Run `sh scripts/test.sh --test-name-pattern 'event stream delivery|background job runner'` and keep the red output (module import of `dist/server/events.js` fails) before any source edit.

7. **New `src/server/events.ts`.** Export `type PublishedEvent = { id: number; type: string; data: unknown }`, `type EventHub = { publish(type: string, data: unknown): number; subscribe(listener: (event: PublishedEvent) => void): () => void }`, and `createEventHub(): EventHub`. `publish` throws a `TypeError` if `type` is empty or contains `\r` or `\n` (Hono would otherwise throw inside the listener), assigns the next integer id starting at 1, calls every current listener synchronously in subscription order over a snapshot of the listener set, and returns the id. `subscribe` returns an unsubscribe function that is harmless to call twice. No buffering. Put this comment on the hub: `// razor: no replay buffer and no Last-Event-ID; a reconnecting browser receives only later events. Upgrade path: ring buffer keyed by id replayed from Last-Event-ID.`

8. **New `src/server/jobs.ts`.** Export `type Timers = { setInterval(callback: () => void, ms: number): unknown; clearInterval(handle: unknown): void }` and `createJobRunner(timers?: Timers)` (default: thin wrappers over the global `setInterval`/`clearInterval`) returning `{ register, start, stop }`:
   - `register(name: string, intervalMs: number, run: () => void | Promise<void>)`: throws `new Error(\`Duplicate job: ${name}\`)` on a repeated name and `new Error('Register jobs before start.')` if called while started.
   - `start()`: no-op if already started; otherwise creates one interval per job. No immediate run; the first run is one interval after `start()`.
   - Each tick: if that job has an in-flight run, return (tick skipped). Otherwise invoke `run` synchronously inside a try/catch, normalise the result to a promise, and on either a synchronous throw or a rejection call `console.error(\`Job failed: ${name}\`)` with nothing else (no error object, no arguments); when the run settles clear the in-flight marker. The job stays scheduled.
   - `stop(): Promise<void>`: clears every interval, marks the runner stopped, awaits all in-flight runs, then resolves. Resolves immediately when not started. `start()` after `stop()` schedules the jobs again.
   - Jobs receive no arguments: no session, no HTTP context.

9. **`src/server/app.ts`: options and context.** Add `events?: EventHub` and `timers?: Timers` to `CreateAppOptions` (lines 8-15), importing the types from `./events.js` and `./jobs.js`, plus `createEventHub` for the default (`options.events ?? createEventHub()`) and global-timer wrappers for the default timers. Add `sessionToken: string` to `AppEnvironment.Variables` (line 19) and set it in `privateGuard` next to `context.set('sessionExpiresAt', …)` (line 235) from `session.value`.

10. **`src/server/app.ts`: the stream route, registered immediately after `GET /api/session` (line 242) and before the `/api` 404 catch-alls.** Import `streamSSE` from `'hono/streaming'`. Keep a closure counter of open streams. Handler, in order:
    - `context.req.method !== 'GET'` → `context.json({ error: 'method_not_allowed' }, 405)`.
    - counter `>= 20` → `context.json({ error: 'too_many_streams' }, 503)`.
    - Otherwise increment the counter and return `streamSSE(context, async (stream) => { … })`. Inside, before the first `await`: read `token = context.get('sessionToken')`; define `finish()` (idempotent via a flag: unsubscribe, `timers.clearInterval`, decrement the counter, resolve a local "closed" promise); `stream.onAbort(finish)`; subscribe a listener that calls `authentication.validateSession(token)` and, if `kind !== 'success'`, calls `finish()`, else writes `stream.writeSSE({ id: String(event.id), event: event.type, data: JSON.stringify(event.data) })` without awaiting; start `timers.setInterval` at `25_000` ms whose callback validates the same way and on success writes `stream.write(': keepalive\n\n')`. Then `await` the closed promise and return (Hono closes the stream).
    - Nothing in this handler sets headers; `Content-Type` comes from `streamSSE` and `Cache-Control: no-store` from the existing middleware (verified fact).

11. **`src/server/index.ts`: wiring and shutdown.** Import `createEventHub`, `createJobRunner`, and `type Server` from `'node:http'`. Inside the `database !== undefined` block: `const events = createEventHub()`, `const runner = createJobRunner()`, pass `events` to `createApp`, call `runner.start()` before `serve`, and keep `const server = serve(...) as Server` (node-server builds an `http.Server` when no `createServer` option is given). Add a `shutdown` function guarded by a boolean (a second signal is ignored) that: `await runner.stop()`; `server.close(() => process.exit(0))`; `server.closeAllConnections()`. Register it with `process.once('SIGTERM', …)` and `process.once('SIGINT', …)`. Rationale recorded: `closeAllConnections` is what closes the open event streams (socket close reaches each stream's `onAbort` through node-server, verified fact); without it `server.close()` waits on the streaming sockets. Register no jobs. Leave the database-failure branch and the `Listening on` log untouched.

12. **`README.md`.** Add `GET /api/events` to the route list after line 48 (`/api/session`). Replace the paragraph at line 56 with a description of what now exists: the stream authorizes under the `/api` owner guard before any header is sent; each event is `event: <type>`, `data: <JSON>`, `id: <integer>` with ids increasing per process; a `: keepalive` comment every 25 seconds keeps proxied connections (Whatbox, Cloudflare) open; the owner session is re-checked before every event and keepalive and the stream closes when it has expired or been signed out; at most 20 streams per process, the next gets 503 `too_many_streams`; no replay, so a reconnecting browser receives only later events. Keep line 58's background-jobs sentence and add, after it, the job-runner contract for later epics: register every job before `start()`, a job never overlaps its own previous run (that tick is skipped), a failing job is logged by name only and stays scheduled, jobs run with no session or request, the first run is one interval after start, and SIGTERM/SIGINT stops the runner (waiting for in-flight runs), closes open streams and the server, and exits 0. Mention that the schedule lives in memory only, so a restart starts from an empty schedule.

### Out of scope — do not touch

- `src/server/auth.ts`, `src/server/database.ts`, `src/server/settings.ts`, all of `src/client/`, `vite.config.ts`, `scripts/`, `.githooks/`, `package.json`, `package-lock.json`, `tsconfig*.json`.
- No registered jobs, no event types or payload schemas, no health reporting, no rTorrent polling, no cache logic, no `Last-Event-ID`/replay buffer, no persistence of schedules.
- No changes to existing tests or existing routes beyond the `sessionToken` context variable; `/api/session` behaviour stays as is.
- `docs/handover-2026-10-08-aa37.md`, `docs/handover-2026-10-08.md`, `.scratch/aa-37/work-order.md` (dated records; leave their "no stream exists yet" wording).
- No cleanup, no abstractions beyond the hub/runner/route specified, no error handling for impossible cases, no backwards-compat shims, no new dependencies.
- No commits, pushes or merges in this track; the orchestrator handles git.

### Retired terms

- `does not implement an event stream` (README.md:56 sentence removed by step 12)
- `AA-41 must` (README.md:56 obligation phrasing replaced by step 12)

Expected remaining hits after the steps: `docs/handover-2026-10-08-aa37.md:41` and `.scratch/aa-37/work-order.md:102` — dated records, report and leave.

### Verification

Run from `/Users/alechenderson/Projects/media-manager-2/.claude/worktrees/aa-41-background-updates` with `export PATH="/Users/alechenderson/.nvm/versions/node/v22.23.2/bin:$PATH"`.

Red first (paste both):
- after step 4: `sh scripts/test.sh --test-name-pattern 'production server serves'` → the SIGTERM subtest fails (code `null`, signal `SIGTERM`).
- after step 6: `sh scripts/test.sh --test-name-pattern 'event stream delivery|background job runner'` → fails on importing `dist/server/events.js`.

Green after step 11:
- `sh scripts/test.sh --test-name-pattern 'production server serves|event stream delivery|background job runner'` → exit 0, `# fail 0`; 16 + 1 + 7 + 6 = 30 tests selected.

Final, after step 12:
- `sh scripts/test.sh --full` → exit 0, `# tests 58`, `# pass 58`, `# fail 0` (44 existing + 14 added: 1 SIGTERM subtest, 7 in `event stream delivery`, 6 in `background job runner`).
- `git diff --check` → exit 0.
- `git grep -n -i 'does not implement an event stream\|AA-41 must' -- src tests '*.md'` → only the two dated-record hits listed under Retired terms.

### Execution plan

One track, steps 1-12, files: `tests/production.test.mjs`, `src/server/events.ts`, `src/server/jobs.ts`, `src/server/app.ts`, `src/server/index.ts`, `README.md`.

- **Model:** opus. The stream lifecycle (abort, revocation, keepalive, idempotent cleanup, cap accounting) and the runner's overlap/stop semantics are concurrency logic across four files.
- **Effort:** high.
- **Concurrency:** single track, nothing to parallelise; the job runner is too small to earn its own worktree and would share the test file and README anyway.
- **Starting state:** fork from `80f1481`; the branch has no uncommitted work.

### Executor rules

> - Follow the steps in order. Do not add, merge, reorder, or skip steps.
> - Before editing in any folder, read the nearest AGENTS.md above it (and the root one) if the repo has them — folder rules and traps bind even when the work order doesn't repeat them.
> - If reality contradicts a Verified fact or a step is impossible as written, STOP and report the discrepancy. Do not improvise a workaround.
> - Before reporting progress, audit each claim against a tool result from this session. Only report work you can point to evidence for. If tests fail, say so with the output.
> - "Done" means the Verification commands were run in this session and passed. Paste their output.
> - Touch nothing in the Out-of-scope list.
> - Deliver what was asked, at the scope intended. If the spec seems mistaken or a better approach exists, say so in a sentence and continue as specified rather than quietly narrowing, widening, or transforming it.
> - If a step changes code that another screen, window or surface also draws or calls and the work order does not name that surface, STOP and report it as a discrepancy before editing. Flagging it and continuing is not enough; the owner decides whether the change applies there.
> - When the work order lists Retired terms, after the last step run `git grep -n -i` for each term across `src/`, `tests/` and every `*.md`, fix the hits a step covers, and list every other hit with file:line in your report. A new or moved test carries one comment sentence naming the code change that turns it red.
> - A test you add or move carries one comment sentence naming the code change that turns it red; a new test extends an existing suite before it starts a new file; folder AGENTS.md lines carry no dates, rulings or decision ids, and AGENTS-HISTORY.md is only appended to; DESIGN.md sections are rewritten from the shipped code, never from the plan.
