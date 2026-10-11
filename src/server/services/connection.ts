import type { DatabaseSync } from 'node:sqlite';
import { getSetting } from '../settings.js';

export type ConnectionStatus =
  | { kind: 'not_configured' }
  | { kind: 'ok'; version: string }
  | { kind: 'rejected' }
  | { kind: 'unreachable' };

export type ServiceOptions = { fetch?: typeof globalThis.fetch };

export const requestWithTimeout = (
  fetchImpl: typeof globalThis.fetch,
  url: string,
  init: RequestInit,
  timeoutMs = 10_000,
) => fetchImpl(url, {
  ...init,
  redirect: 'error',
  signal: AbortSignal.timeout(timeoutMs),
});

export const readSetting = (database: DatabaseSync, category: string, key: string): string | undefined => {
  const value = getSetting(database, category, key);
  return value === '' ? undefined : value;
};
