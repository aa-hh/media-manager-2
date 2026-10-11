# 0003. Seal backups to a key pair made in the app

Status: accepted; amends 0001 and 0002

## Context

0002 seals every backup with `BACKUP_KEY`, 64 hex characters the owner makes with a `node -e` command and adds to the server's env file. Setting up backups therefore means editing a file on the host and restarting the server, which the setup wizard cannot do for them. The server also holds the only key a restore needs, so anyone who copies the server's env file and reaches the backup destination can read every saved credential.

## Decision

The owner creates the backup key from the app with `POST /api/setup/backup/key`. The server generates an X25519 key pair, stores only the public half, and returns the private half once as `mm2-restore-` followed by the 43 base64url characters of its 32 raw bytes. The private half is never stored, logged or shown again, and there is no confirmation step. Creating another pair replaces the stored public half; there is no rotation or list of older keys, so backups made before still need the older restore key. The command-line restore reads that string only from `BACKUP_RESTORE_KEY`, with no interactive prompt. The public half is kept in the `preferences` table under `backup.keyPair` as `{"publicKey":"<base64url>","createdAt":<ms since epoch>}`. A backup sealed to the pair starts with the 9 ASCII bytes `mm2x25519`, then a one-off X25519 public key (32 bytes), then the nonce, AES-256-GCM ciphertext and tag laid out as before; the AES key is HKDF-SHA256 of the two keys' shared secret with an empty salt and the marker plus both public keys as info. `BACKUP_KEY` remains the fallback: backups seal with it only while no pair exists, and once one exists it is not read at all. Restore picks the key by whether the body starts with the marker. A run with neither key fails with `No backup key: create one in the app or set BACKUP_KEY.`

## Consequences

Backups can be set up without touching the host, and the server alone can no longer read its own backups. Losing the restore key loses every backup sealed with it, with no way to recover it from the server. Backups sealed with `BACKUP_KEY` before a pair existed still need `BACKUP_KEY` to restore, so an owner who switches keeps both until those backups age out. Snapshot names, retention, destinations and the `backup_runs` record are unchanged.
