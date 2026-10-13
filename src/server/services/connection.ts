import { isAbsolute, relative } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { logEvent } from '../log.js';
import { getSetting } from '../settings.js';

export type ConnectionStatus =
  | { kind: 'not_configured' }
  | { kind: 'ok'; version: string; serverName?: string }
  | { kind: 'rejected' }
  | { kind: 'unreachable' };

export type ServiceOptions = { fetch?: typeof globalThis.fetch };

// Logs host and path only: TMDB and MDBList keys ride in the query, the other keys in headers.
export const requestWithTimeout = async (
  fetchImpl: typeof globalThis.fetch,
  url: string,
  init: RequestInit,
  timeoutMs = 10_000,
) => {
  const { host, pathname } = new URL(url);
  const fields = { host, method: init.method ?? 'GET', path: pathname };
  const started = performance.now();
  const elapsed = () => Math.round((performance.now() - started) * 10) / 10;
  try {
    const response = await fetchImpl(url, {
      ...init,
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
    logEvent('upstream', { ...fields, status: response.status, ms: elapsed() });
    return response;
  } catch (error) {
    logEvent('upstream', { ...fields, error: error instanceof Error ? error.name : typeof error, ms: elapsed() });
    throw error;
  }
};

export const readSetting = (database: DatabaseSync, category: string, key: string): string | undefined => {
  const value = getSetting(database, category, key);
  return value === '' ? undefined : value;
};

// The folder itself counts as inside.
export const isInsideFolder = (folder: string, path: string) => {
  const inside = relative(folder, path);
  return !inside.startsWith('..') && !isAbsolute(inside);
};
