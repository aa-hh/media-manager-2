import { useCallback, useEffect, useRef, useState } from 'react';
import { postAction } from '../downloads/useDownloads';

// Shapes served by /api/health; the server types in src/server/health.ts are the source of truth.
export type HealthLevel = 'ok' | 'notice' | 'warning' | 'error';
export type ConnectionStatus =
  | { kind: 'not_configured' }
  | { kind: 'ok'; version: string; serverName?: string }
  | { kind: 'rejected' }
  | { kind: 'unreachable' };
export type HealthProblem = {
  id: string;
  level: Exclude<HealthLevel, 'ok'>;
  source: 'Sonarr' | 'Radarr' | 'media-manager-2';
  check: string;
  message: string;
  docsUrl: string | null;
};
export type HealthSnapshot = {
  checkedAt: number;
  level: HealthLevel;
  problems: HealthProblem[];
  services: { name: 'sonarr' | 'radarr' | 'rtorrent' | 'plex' | 'jellyfin' | 'tmdb' | 'mdblist'; label: string; status: ConnectionStatus; update: string | null }[];
  trackers: {
    host: string;
    reachable: boolean;
    cooldown: { host: string; since: number; text: string; known: boolean; triggerHash: string } | null;
    account:
      | { kind: 'not_set_up' }
      | { kind: 'unavailable'; reason: 'rejected' | 'unreachable' | 'unsupported' }
      | { kind: 'ok'; ratio: number | null; ratioMinimum: number | null; hitAndRuns: number | null; hitAndRunsIsLifetime: boolean };
  }[];
  disks: { path: string; label: string; freeBytes: number; totalBytes: number; sources: ('sonarr' | 'radarr')[] }[];
  jobs: { name: string; intervalMs: number; lastStartedAt: number | null; lastFinishedAt: number | null; lastFailed: boolean; late: boolean }[];
  backup: { kind: 'not_set_up' } | { kind: 'off' } | { kind: 'failing'; detail: string } | { kind: 'ok' | 'stale'; lastAt: number };
};

export type HealthState = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; snapshot: HealthSnapshot };

const POLL_MS = 60_000;
// A request that never answers fails after this, so the screen leaves loading or Checking and offers Try again.
const READ_TIMEOUT_MS = 30_000;
const CHECK_TIMEOUT_MS = 90_000;

export const useHealth = (onUnauthorized: () => void) => {
  const [state, setState] = useState<HealthState>({ kind: 'loading' });
  const unauthorizedRef = useRef(onUnauthorized);
  unauthorizedRef.current = onUnauthorized;

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/health', { credentials: 'same-origin', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(READ_TIMEOUT_MS) });
      if (response.status === 401) {
        unauthorizedRef.current();
        return;
      }
      if (!response.ok) throw new Error('Health could not be read.');
      const snapshot = await response.json() as HealthSnapshot;
      // A poll started before Run all checks can answer after it; keep the newer snapshot.
      setState((current) => (current.kind === 'ready' && current.snapshot.checkedAt > snapshot.checkedAt ? current : { kind: 'ready', snapshot }));
    } catch {
      setState((current) => (current.kind === 'ready' ? current : { kind: 'failed' }));
    }
  }, []);

  useEffect(() => {
    void load();
    const handle = window.setInterval(() => { void load(); }, POLL_MS);
    return () => window.clearInterval(handle);
  }, [load]);

  const runChecks = useCallback(async () => {
    try {
      const status = await Promise.race([
        postAction('/api/health/check'),
        new Promise<never>((_, reject) => { window.setTimeout(() => reject(new Error('Checks timed out.')), CHECK_TIMEOUT_MS); }),
      ]);
      if (status === 401) {
        unauthorizedRef.current();
        return;
      }
    } catch {
      // The reload below shows the last snapshot or the failed state.
    }
    await load();
  }, [load]);

  return { state, runChecks };
};
