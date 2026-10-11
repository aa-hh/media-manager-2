# 0001. Back up SQLite from inside the app

Status: accepted

## Context

The app keeps all of its state in one SQLite file on a Whatbox slot. A disk failure on the slot, or a move to another host, loses that file unless a copy lives elsewhere. Whatbox gives no root access and no service manager for extra processes; whether the slot can run containers is still open (AA-67), so a sidecar such as Litestream has nowhere reliable to run. The app requires Node 22.13, and `node:sqlite`'s `backup()` arrived in 22.14, so it cannot be used. `VACUUM INTO` works on 22.13, accepts a bound path, and produces a consistent copy while another connection holds a write lock.

## Decision

A background job inside the server process runs every 5 minutes. It writes a consistent copy with `VACUUM INTO` into a fresh temporary directory, gzips it, and uploads it to a Cloudflare R2 bucket through R2's S3 API, signing each request with a hand-written AWS Signature Version 4 so no package is added. A run is skipped as `unchanged` when neither this connection's `total_changes()` nor `PRAGMA data_version` has moved since the last upload. Each run, uploaded, skipped or failed, is stored in the `backup_runs` table and published as a `backup` event; it does not open a problem or touch `dependency_status`, which would put a row on the Downloads screen.

## Consequences

Backups need nothing on the slot beyond the app itself and four settings. The snapshot and gzip run synchronously and pause the event loop briefly; that is acceptable while the database stays small. There is no point-in-time replay of individual writes: the worst case is losing the last 5 minutes. A future health screen reads `backup_runs` rather than asking R2. Restoring is a command-line step the owner runs with the server stopped, described in the README.
