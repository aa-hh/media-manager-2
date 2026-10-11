import type { DatabaseSync } from 'node:sqlite';
import { readSetting, requestWithTimeout, type ServiceOptions } from './connection.js';

export type Tracker = 'blutopia' | 'privatehd' | 'beyondhd';
export const trackers: readonly Tracker[] = ['blutopia', 'privatehd', 'beyondhd'];

export type BlutopiaAccount = {
  username: string;
  group: string;
  uploaded: string;
  downloaded: string;
  ratio: number | null;
  buffer: string;
  seeding: number | null;
  leeching: number | null;
  seedbonus: number | null;
  hitAndRuns: number | null;
};

export type TrackerAccountStats =
  | { tracker: Tracker; kind: 'not_configured' | 'rejected' | 'unreachable' }
  | { tracker: 'blutopia'; kind: 'ok'; stats: BlutopiaAccount }
  | { tracker: 'privatehd' | 'beyondhd'; kind: 'ok'; stats: 'unsupported' };

type Outcome = { kind: 'not_configured' | 'rejected' | 'unreachable' } | { kind: 'ok'; stats: BlutopiaAccount | 'unsupported' };

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const asText = (value: unknown) => (typeof value === 'string' ? value : '');
const asNumber = (value: unknown) => {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value.replace(/,/g, '')) : Number.NaN;
  return Number.isFinite(number) ? number : null;
};

export const createTrackerAccounts = (database: DatabaseSync, options: ServiceOptions = {}) => {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const url = (tracker: Tracker) => readSetting(database, 'serviceAddresses', `${tracker}.url`)?.replace(/\/+$/, '');
  const credential = (key: string) => readSetting(database, 'credentials', key);

  // Sends one request and returns the status and parsed body; a failed request or unreadable body is reported as undefined, never as an error carrying the URL.
  const send = async (target: string, init: RequestInit): Promise<{ status: number; body: unknown } | undefined> => {
    let response: Response;
    try {
      response = await requestWithTimeout(fetchImpl, target, init);
    } catch {
      return undefined;
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    return { status: response.status, body };
  };

  const blutopia = async (): Promise<Outcome> => {
    const base = url('blutopia');
    const token = credential('blutopia.apiToken');
    if (base === undefined || token === undefined) return { kind: 'not_configured' };
    const result = await send(`${base}/api/user`, { method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    if (result === undefined) return { kind: 'unreachable' };
    if (result.status === 401 || result.status === 403) return { kind: 'rejected' };
    const body = asRecord(result.body);
    if (result.status < 200 || result.status > 299 || body === undefined) return { kind: 'unreachable' };
    return {
      kind: 'ok',
      stats: {
        username: asText(body.username),
        group: asText(body.group),
        uploaded: asText(body.uploaded),
        downloaded: asText(body.downloaded),
        ratio: asNumber(body.ratio),
        buffer: asText(body.buffer),
        seeding: asNumber(body.seeding),
        leeching: asNumber(body.leeching),
        seedbonus: asNumber(body.seedbonus),
        hitAndRuns: asNumber(body.hit_and_runs),
      },
    };
  };

  const privatehd = async (): Promise<Outcome> => {
    const base = url('privatehd');
    const username = credential('privatehd.username');
    const password = credential('privatehd.password');
    const pid = credential('privatehd.pid');
    if (base === undefined || username === undefined || password === undefined || pid === undefined) return { kind: 'not_configured' };
    const result = await send(`${base}/api/v1/jackett/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ username, password, pid }).toString(),
    });
    if (result === undefined) return { kind: 'unreachable' };
    if (result.status === 401 || result.status === 403 || result.status === 422) return { kind: 'rejected' };
    const token = asRecord(result.body)?.token;
    // razor: the bearer token is discarded after the check; the upgrade path is caching it in memory for AA-48 searches.
    if (result.status < 200 || result.status > 299 || typeof token !== 'string' || token === '') return { kind: 'unreachable' };
    return { kind: 'ok', stats: 'unsupported' };
  };

  const beyondhd = async (): Promise<Outcome> => {
    const base = url('beyondhd');
    const apiKey = credential('beyondhd.apiKey');
    if (base === undefined || apiKey === undefined) return { kind: 'not_configured' };
    const rssKey = credential('beyondhd.rssKey');
    // The API key sits in the path because that is the only form Beyond-HD accepts.
    const result = await send(`${base}/api/torrents/${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(rssKey === undefined ? { action: 'search', page: 1 } : { action: 'search', page: 1, rsskey: rssKey }),
    });
    if (result === undefined) return { kind: 'unreachable' };
    if (result.status === 401 || result.status === 403) return { kind: 'rejected' };
    const body = asRecord(result.body);
    if (result.status < 200 || result.status > 299 || body === undefined) return { kind: 'unreachable' };
    if (body.status_code === 1) return { kind: 'ok', stats: 'unsupported' };
    if (body.status_code === 0 && typeof body.status_message === 'string' && /key/i.test(body.status_message)) return { kind: 'rejected' };
    return { kind: 'unreachable' };
  };

  const checks = { blutopia, privatehd, beyondhd };
  const settingKeys: Record<Tracker, [string, string][]> = {
    blutopia: [['serviceAddresses', 'blutopia.url'], ['credentials', 'blutopia.apiToken']],
    privatehd: [['serviceAddresses', 'privatehd.url'], ['credentials', 'privatehd.username'], ['credentials', 'privatehd.password'], ['credentials', 'privatehd.pid']],
    beyondhd: [['serviceAddresses', 'beyondhd.url'], ['credentials', 'beyondhd.apiKey']],
  };

  const check = async (tracker: Tracker): Promise<TrackerAccountStats> => {
    const outcome = await checks[tracker]();
    return { tracker, ...outcome } as TrackerAccountStats;
  };

  return {
    check,
    stats: () => Promise.all(trackers.map(check)),
    configured: (tracker: Tracker) => settingKeys[tracker].every(([category, key]) => readSetting(database, category, key) !== undefined),
  };
};

export const getTrackerAccountStats = (database: DatabaseSync, options?: ServiceOptions) => createTrackerAccounts(database, options).stats();
