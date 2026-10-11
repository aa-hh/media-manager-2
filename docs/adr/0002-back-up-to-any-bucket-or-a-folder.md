# 0002. Back up to any S3-compatible bucket or a folder

Status: accepted; amends 0001

## Context

0001 sent backups only to Cloudflare R2. The app is meant to be usable by anyone who runs Sonarr and Radarr, and many of them have no R2 account, use another S3-compatible service, or would rather copy backups to a second disk or a network share. Backups were already skipped when unconfigured, but the README presented R2 as part of setup.

## Decision

Backups stay optional, and `backup off` records an owner's choice to run without them, which silences the health reminder and skips every run until `backup on`. Once a destination is set, a missing `BACKUP_KEY` fails the run instead of being skipped, so the health screen warns. The destination is either a folder (`hostPaths backup.folder`) or any S3-compatible bucket (`backup.endpoint`, `backup.bucket`, an optional `backup.region` defaulting to `auto`, and the two credentials). Setting both fails the run rather than picking one silently. The folder is never created by the app, so a missing folder fails the run. An unmounted drive's mount point still exists as an empty folder, so the README tells people to point at a folder inside the drive, which disappears when the drive is unmounted. A migration renames the old `r2.*` settings to `backup.*`, and the restore commands read `BACKUP_*` environment variables instead of `R2_*`.

## Consequences

Snapshot format, encryption, retention and the `backup_runs` record are unchanged; only where the bytes go has changed. A folder destination writes each file beside its final name and renames it, so a crash never leaves a half-written snapshot under a real name. Anyone who exported `R2_*` for a restore must use the `BACKUP_*` names.
