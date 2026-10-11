import type { DatabaseSync } from 'node:sqlite';
import { deleteSetting, getSetting, setSetting } from '../settings.js';
import { listTrackerHosts } from '../trackerRules.js';
import { readSetting, requestWithTimeout, type ServiceOptions } from './connection.js';

// The software a tracker's site runs; one connector per software serves every tracker running it. "other" has no
// account connection, only the hit-and-run rule.
export type Software = 'unit3d' | 'gazelle' | 'nexusphp' | 'other';
export const softwares: readonly Software[] = ['unit3d', 'gazelle', 'nexusphp', 'other'];

// Null wherever the software reports no such field.
export type TrackerAccountStats = {
  ratio: number | null;
  uploadedBytes: number | null;
  downloadedBytes: number | null;
  bufferBytes: number | null;
  seeding: number | null;
  leeching: number | null;
  bonus: number | null;
  hitAndRuns: { count: number; kind: 'lifetime' } | null;
  requiredRatio: number | null;
};
export type TrackerConnection =
  | { kind: 'ok'; stats: TrackerAccountStats }
  | { kind: 'not_configured' | 'rejected' | 'unreachable' | 'too_old' | 'unsupported' };

// Stock UNIT3D allows 30 API calls a minute and Gazelle's ajax.php is rate limited too, so a result is reused for this long.
export const CHECK_INTERVAL_MS = 5 * 60_000;
const BODY_LIMIT_BYTES = 1_000_000;

const softwareKey = (host: string) => `software.${host}`;
const credentialKey = (host: string) => `trackers.${host}`;
export const isSoftware = (value: unknown): value is Software => (softwares as readonly unknown[]).includes(value);
export const trackerSoftware = (database: DatabaseSync, host: string): Software => {
  const saved = getSetting(database, 'trackerConfiguration', softwareKey(host));
  return isSoftware(saved) ? saved : 'other';
};
export const saveTrackerSoftware = (database: DatabaseSync, host: string, software: Software) => (
  setSetting(database, 'trackerConfiguration', softwareKey(host), software)
);
export const trackerCredential = (database: DatabaseSync, host: string) => readSetting(database, 'credentials', credentialKey(host));
export const saveTrackerCredential = (database: DatabaseSync, host: string, value: string) => setSetting(database, 'credentials', credentialKey(host), value);
export const forgetTrackerAccount = (database: DatabaseSync, host: string) => {
  deleteSetting(database, 'trackerConfiguration', softwareKey(host));
  deleteSetting(database, 'credentials', credentialKey(host));
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const asNumber = (value: unknown) => {
  const number = typeof value === 'number' ? value
    : typeof value === 'string' && value.trim() !== '' ? Number(value.replace(/[,\s  ]/g, '')) : Number.NaN;
  return Number.isFinite(number) ? number : null;
};

const unitBytes: Record<string, number> = {
  b: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, pb: 1e15, kib: 2 ** 10, mib: 2 ** 20, gib: 2 ** 30, tib: 2 ** 40, pib: 2 ** 50,
};
// A byte count sent as a number, a plain number string, or UNIT3D's display text ("1.23 TiB", "-5.5 GiB"): binary units
// count in 1024s, decimal ones in 1000s. Anything else, such as "∞", is null.
export const parseBytes = (value: unknown): number | null => {
  if (typeof value !== 'string') return asNumber(value);
  const match = /^(-?[\d,]*\.?\d+)\s*([kmgtp]i?b|b)?$/i.exec(value.replace(/[  ]/g, ' ').trim());
  if (match === null) return null;
  const number = asNumber(match[1]);
  return number === null ? null : Math.round(number * unitBytes[(match[2] ?? 'b').toLowerCase()]);
};

type Fetch = typeof globalThis.fetch;
type Reply = { status: number; body: unknown } | undefined;

// The body is read only up to BODY_LIMIT_BYTES; a larger or unreadable one is reported as undefined.
const readBody = async (response: Response): Promise<unknown> => {
  if (Number(response.headers.get('content-length') ?? 0) > BODY_LIMIT_BYTES || response.body === null) return undefined;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > BODY_LIMIT_BYTES) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return undefined;
  }
};

// A failed request is undefined, never an error: an error could carry the URL or a header into a log.
const send = async (fetchImpl: Fetch, url: string, authorization: string): Promise<Reply> => {
  try {
    const response = await requestWithTimeout(fetchImpl, url, { method: 'GET', headers: { Authorization: authorization, Accept: 'application/json' } });
    return { status: response.status, body: await readBody(response) };
  } catch {
    return undefined;
  }
};

const failure = (reply: Reply): TrackerConnection | undefined => {
  if (reply === undefined) return { kind: 'unreachable' };
  if (reply.status === 401 || reply.status === 403) return { kind: 'rejected' };
  if (reply.status < 200 || reply.status > 299) return { kind: 'unreachable' };
  return undefined;
};
const empty: TrackerAccountStats = {
  ratio: null, uploadedBytes: null, downloadedBytes: null, bufferBytes: null, seeding: null, leeching: null, bonus: null, hitAndRuns: null, requiredRatio: null,
};

// UNIT3D's GET /api/user, stock since v8.3.4: sizes may be display text, ratio "∞" with nothing downloaded, and
// hit_and_runs a lifetime counter that only ever goes up.
const unit3d = async (fetchImpl: Fetch, base: string, token: string): Promise<TrackerConnection> => {
  const reply = await send(fetchImpl, `${base}/api/user`, `Bearer ${token}`);
  if (reply?.status === 404) return { kind: 'too_old' };
  const failed = failure(reply);
  const body = asRecord(reply?.body);
  if (failed !== undefined || body === undefined) return failed ?? { kind: 'unreachable' };
  const hitAndRuns = asNumber(body.hit_and_runs);
  return {
    kind: 'ok',
    stats: {
      ...empty,
      ratio: asNumber(body.ratio),
      uploadedBytes: parseBytes(body.uploaded),
      downloadedBytes: parseBytes(body.downloaded),
      bufferBytes: parseBytes(body.buffer),
      seeding: asNumber(body.seeding),
      leeching: asNumber(body.leeching),
      bonus: asNumber(body.seedbonus),
      hitAndRuns: hitAndRuns === null ? null : { count: hitAndRuns, kind: 'lifetime' },
    },
  };
};

// Gazelle's ajax.php?action=index. Orpheus wants "token <key>", Redacted the bare key; a refused key comes back as
// HTTP 200 with status "failure", and so does "Rate limit exceeded", which says nothing about the key.
// The answer also carries the account's passkey and authkey, so only numbers are kept.
// razor: seeding is null; the upgrade path is action=user&id=<id> (community.seeding), limited to 4 calls a minute.
type GazelleForm = 'token' | 'bare';
type Checked = TrackerConnection | 'rate_limited';
const gazelleOnce = async (fetchImpl: Fetch, base: string, key: string, form: GazelleForm): Promise<Checked> => {
  const reply = await send(fetchImpl, `${base}/ajax.php?action=index`, form === 'token' ? `token ${key}` : key);
  const body = asRecord(reply?.body);
  if (reply?.status === 429 || (body?.status === 'failure' && typeof body.error === 'string' && /rate limit/i.test(body.error))) return 'rate_limited';
  const failed = failure(reply);
  if (failed !== undefined || body === undefined) return failed ?? { kind: 'unreachable' };
  if (body.status === 'failure') return { kind: 'rejected' };
  const stats = asRecord(asRecord(body.response)?.userstats);
  if (body.status !== 'success' || stats === undefined) return { kind: 'unreachable' };
  const ratio = asNumber(stats.ratio);
  return {
    kind: 'ok',
    stats: {
      ...empty,
      // Gazelle sends -1 for an infinite ratio.
      ratio: ratio === null || ratio < 0 ? null : ratio,
      uploadedBytes: asNumber(stats.uploaded),
      downloadedBytes: asNumber(stats.downloaded),
      bonus: asNumber(stats.bonusPoints),
      requiredRatio: asNumber(stats.requiredratio),
    },
  };
};

// NexusPHP's GET /api/profile (Laravel Sanctum): the user sits in data.data. Its share_ratio is HTML, so the ratio
// comes from the byte counts.
const nexusphp = async (fetchImpl: Fetch, base: string, token: string): Promise<TrackerConnection> => {
  const reply = await send(fetchImpl, `${base}/api/profile`, `Bearer ${token}`);
  const failed = failure(reply);
  const body = asRecord(reply?.body);
  const user = asRecord(asRecord(body?.data)?.data);
  if (failed !== undefined || body?.ret !== 0 || user === undefined) return failed ?? { kind: 'unreachable' };
  const uploadedBytes = asNumber(user.uploaded);
  const downloadedBytes = asNumber(user.downloaded);
  return {
    kind: 'ok',
    stats: {
      ...empty,
      ratio: uploadedBytes !== null && downloadedBytes !== null && downloadedBytes > 0 ? Math.floor((uploadedBytes / downloadedBytes) * 1000) / 1000 : null,
      uploadedBytes,
      downloadedBytes,
      bonus: asNumber(user.bonus),
    },
  };
};

export const createTrackerAccounts = (database: DatabaseSync, options: ServiceOptions & { env?: NodeJS.ProcessEnv; now?: () => number } = {}) => {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const env = options.env ?? process.env;
  const now = options.now ?? Date.now;
  const gazelleForms = new Map<string, GazelleForm>();
  const recent = new Map<string, { at: number; software: Software; credential: string | undefined; connection: Promise<TrackerConnection> }>();

  // Checks with the given values and caches nothing, except that a Gazelle check remembers which header form worked
  // until restart. The credential never appears in a URL.
  const check = async (host: string, software: Software, credential: string | undefined): Promise<Checked> => {
    if (software === 'other') return { kind: 'unsupported' };
    if (credential === undefined || credential.trim() === '') return { kind: 'not_configured' };
    const base = `https://${host}`;
    if (software === 'unit3d') return unit3d(fetchImpl, base, credential);
    if (software === 'nexusphp') return nexusphp(fetchImpl, base, credential);
    const first = gazelleForms.get(host) ?? 'token';
    const result = await gazelleOnce(fetchImpl, base, credential, first);
    if (result === 'rate_limited' || result.kind !== 'rejected') {
      if (result !== 'rate_limited' && result.kind === 'ok') gazelleForms.set(host, first);
      return result;
    }
    const second: GazelleForm = first === 'token' ? 'bare' : 'token';
    const retried = await gazelleOnce(fetchImpl, base, credential, second);
    if (retried !== 'rate_limited' && retried.kind === 'ok') gazelleForms.set(host, second);
    return retried;
  };
  const unreachable: TrackerConnection = { kind: 'unreachable' };
  const test = async (host: string, software: Software, credential: string | undefined): Promise<TrackerConnection> => {
    const result = await check(host, software, credential);
    return result === 'rate_limited' ? unreachable : result;
  };

  // The saved values' result, reused for CHECK_INTERVAL_MS unless the software or credential changed since. A check
  // still running is shared, so the settings screen and the health check never send two at once.
  const connection = (host: string): Promise<TrackerConnection> => {
    const software = trackerSoftware(database, host);
    const credential = trackerCredential(database, host);
    const last = recent.get(host);
    if (last !== undefined && last.software === software && last.credential === credential && now() - last.at < CHECK_INTERVAL_MS) return last.connection;
    const checked = check(host, software, credential);
    const entry = { at: now(), software, credential, connection: checked.then((result) => (result === 'rate_limited' ? unreachable : result)) };
    recent.set(host, entry);
    // A rate-limited answer says nothing about the credential, so it is not reused.
    void checked.then((result) => {
      if (result === 'rate_limited' && recent.get(host) === entry) recent.delete(host);
    });
    return entry.connection;
  };

  return {
    test,
    connection,
    stats: () => Promise.all(listTrackerHosts(database, env).map(async (host) => ({ host, software: trackerSoftware(database, host), connection: await connection(host) }))),
  };
};

export type TrackerAccounts = ReturnType<typeof createTrackerAccounts>;
