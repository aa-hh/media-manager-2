import { randomInt } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

// Recent app logs a TV sends from its Settings page. The TV shows the short reference, and the owner reads the log back
// by it. Only the newest few are kept, and none for long, because a log is only wanted while a problem is looked at.
export const MAX_DEVICE_LOG_CHARACTERS = 256 * 1_024;
const KEPT_LOGS = 20;
const KEPT_MS = 30 * 24 * 60 * 60_000;
// No 0/O, 1/I/L, so a reference read off a TV across the room is typed back right.
const REFERENCE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const REFERENCE_LENGTH = 6;
export const REFERENCE_PATTERN = `[${REFERENCE_ALPHABET}]{${REFERENCE_LENGTH}}`;

export type DeviceLogSummary = { reference: string; deviceName: string | null; appVersion: string; receivedAt: number; characters: number };
export type DeviceLog = DeviceLogSummary & { log: string };

const newReference = () => Array.from({ length: REFERENCE_LENGTH }, () => REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)]).join('');

export const createDeviceLogs = (database: DatabaseSync, now: () => number) => {
  const save = (deviceName: string | null, appVersion: string, log: string): string => {
    const receivedAt = now();
    database.prepare('DELETE FROM device_logs WHERE received_at <= ?').run(receivedAt - KEPT_MS);
    const insert = database.prepare('INSERT OR IGNORE INTO device_logs (reference, device_name, app_version, received_at, log) VALUES (?, ?, ?, ?, ?)');
    let reference = newReference();
    // About 887 million references against at most 20 kept, so a second try is already rare.
    while (Number(insert.run(reference, deviceName, appVersion, receivedAt, log).changes) === 0) reference = newReference();
    database.prepare(`DELETE FROM device_logs WHERE reference NOT IN (
      SELECT reference FROM device_logs ORDER BY received_at DESC, rowid DESC LIMIT ${KEPT_LOGS})`).run();
    return reference;
  };

  const list = () => database.prepare(`SELECT reference, device_name AS deviceName, app_version AS appVersion, received_at AS receivedAt,
    length(log) AS characters FROM device_logs WHERE received_at > ? ORDER BY received_at DESC, rowid DESC`).all(now() - KEPT_MS) as DeviceLogSummary[];

  const read = (reference: string) => database.prepare(`SELECT reference, device_name AS deviceName, app_version AS appVersion,
    received_at AS receivedAt, length(log) AS characters, log FROM device_logs WHERE reference = ? AND received_at > ?`)
    .get(reference, now() - KEPT_MS) as DeviceLog | undefined;

  return { save, list, read };
};

export type DeviceLogs = ReturnType<typeof createDeviceLogs>;
