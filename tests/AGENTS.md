# tests

## Purpose

The whole automated suite: one test file run against the compiled server in `dist/`, plus fakes of the outside services it talks to. Run it only through `scripts/test.sh`, which builds first; a bare run tests stale code.

## Rules

- One test file by design. Add a test to `production.test.mjs` or a row to an existing table; never start a second file.
- A fake must answer the way the real service does, or a test passes for code that fails in production. Known gap: `tests/fakes/arr.mjs` treats a queue removal without `removeFromClient` as false, while real Sonarr and Radarr treat it as true, so a call that leaves the flag out looks safe in tests and erases the torrent in production.
- A migration test finds its migration by name with `findIndex`, never by position such as `slice(0, -1)`, so the next migration added does not break it.
- No wall-clock waits. Poll with a generous ceiling or drive an injected clock; a line that truly needs real time carries `real-time-ok: <reason>`.
- Every temp path comes from `mkdtemp`, so parallel tests never share a folder or database.
- The suite must not depend on the app's environment variables (`TRACKER_RULES`, `BACKUP_KEY`, `BACKUP_RESTORE_KEY`, `DB_PATH`). Pass what a test needs explicitly; a value exported in the caller's shell otherwise changes outcomes and fails only on that machine.

## Map

- `production.test.mjs` → every test, against the built server, database and CLI.
- `fakes/arr.mjs` → in-memory Sonarr and Radarr with real paging and status codes.
