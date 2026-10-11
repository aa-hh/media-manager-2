import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { readDependency } from './dependencies.js';
import type { EventHub } from './events.js';
import type { createJobRunner } from './jobs.js';
import type { ConnectionStatus } from './services/connection.js';
import { type Tracker, type TrackerAccountStats, trackers as trackerNames } from './services/trackerAccounts.js';
import { indexerMatchesHost } from './stalls.js';
import type { Service } from './torrentGrabs.js';
import { type Cooldown, listCooldowns, listIssues } from './trackers.js';
import { listTorrents } from './torrents.js';

export type HealthLevel = 'ok' | 'notice' | 'warning' | 'error';
export type HealthProblem = {
  id: string;
  level: Exclude<HealthLevel, 'ok'>;
  source: 'Sonarr' | 'Radarr' | 'media-manager-2';
  check: string;
  message: string;
  docsUrl: string | null;
};
type JobStatus = ReturnType<ReturnType<typeof createJobRunner>['status']>;
type ServiceName = 'sonarr' | 'radarr' | 'rtorrent' | 'plex';
export type TrackerAccount =
  | { kind: 'not_set_up' }
  | { kind: 'unavailable'; reason: 'rejected' | 'unreachable' | 'unsupported' }
  | { kind: 'ok'; ratio: number | null; ratioMinimum: number | null; hitAndRuns: number | null; hitAndRunsIsLifetime: boolean };
export type HealthSnapshot = {
  checkedAt: number;
  level: HealthLevel;
  problems: HealthProblem[];
  services: { name: ServiceName; label: string; status: ConnectionStatus; update: string | null }[];
  trackers: { host: string; reachable: boolean; cooldown: Cooldown | null; account: TrackerAccount }[];
  disks: { path: string; label: string; freeBytes: number; totalBytes: number; sources: Service[] }[];
  jobs: JobStatus;
  backup: { kind: 'not_set_up' } | { kind: 'ok' | 'stale'; lastAt: number };
};

type ArrClient = {
  check(): Promise<ConnectionStatus>;
  configured(): boolean;
  request(path: string): Promise<{ status: number; body: unknown }>;
};

const ranks: Record<HealthLevel, number> = { ok: 0, notice: 1, warning: 2, error: 3 };
const labels: Record<ServiceName, string> = { sonarr: 'Sonarr', radarr: 'Radarr', rtorrent: 'rTorrent', plex: 'Plex' };
const arrServices: Service[] = ['sonarr', 'radarr'];
const trackerLabels: Record<Tracker, string> = { blutopia: 'Blutopia', privatehd: 'PrivateHD', beyondhd: 'BeyondHD' };
// Each tracker's own minimum global ratio, copied from its rules; PrivateHD publishes none.
const RATIO_MINIMUMS: Partial<Record<Tracker, number>> = { blutopia: 0.4, beyondhd: 0.25 };

const accountOf = (stats: TrackerAccountStats | undefined): TrackerAccount => {
  if (stats === undefined || stats.kind === 'not_configured') return { kind: 'not_set_up' };
  if (stats.kind !== 'ok') return { kind: 'unavailable', reason: stats.kind };
  if (stats.stats === 'unsupported') return { kind: 'unavailable', reason: 'unsupported' };
  // Blutopia's API reports hit-and-runs as a lifetime count, not the currently open ones.
  return { kind: 'ok', ratio: stats.stats.ratio, ratioMinimum: RATIO_MINIMUMS[stats.tracker] ?? null, hitAndRuns: stats.stats.hitAndRuns, hitAndRunsIsLifetime: true };
};
const GB = 1_000_000_000;
const DISK_FREE_MINIMUM = 25 * GB;
const BACKUP_STALE_MS = 26 * 60 * 60_000;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const records = (body: unknown) => (Array.isArray(body) ? body.filter(isRecord) : []);

const units = ['B', 'KB', 'MB', 'GB', 'TB'];
const formatBytes = (bytes: number) => {
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
};
const formatDuration = (milliseconds: number) => {
  const minutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
};

// Sonarr types wikiUrl as an object with fullUri, Radarr as a plain string.
const docsUrl = (value: unknown) => {
  if (typeof value === 'string' && value !== '') return value;
  if (isRecord(value) && typeof value.fullUri === 'string' && value.fullUri !== '') return value.fullUri;
  return null;
};

const lastBackupAt = (database: DatabaseSync): number | null => {
  const row = database.prepare("SELECT MAX(finished_at) AS at FROM backup_runs WHERE outcome = 'ok'").get();
  return row === undefined || row.at === null ? null : Number(row.at);
};

export const createHealth = (options: {
  database: DatabaseSync;
  arr: Record<Service, ArrClient>;
  rtorrent: { check(): Promise<ConnectionStatus> };
  plex: { check(): Promise<ConnectionStatus> };
  jobs: { status(): JobStatus };
  trackerAccounts: { stats(): Promise<TrackerAccountStats[]> };
  events: EventHub;
  now?: () => number;
}) => {
  const { database, arr, rtorrent, plex, jobs, trackerAccounts, events } = options;
  const now = options.now ?? Date.now;
  let snapshot: HealthSnapshot | undefined;
  // Kept in memory only: the first check after a restart records the count without warning.
  const lastHitAndRuns = new Map<Tracker, number>();

  const read = async (service: Service, path: string) => {
    const { status, body } = await arr[service].request(path);
    if (status < 200 || status > 299) throw new Error(`${labels[service]} refused ${path}.`);
    return records(body);
  };
  const settled = <T>(result: PromiseSettledResult<T>, fallback: T) => (result.status === 'fulfilled' ? result.value : fallback);

  const check = async (): Promise<HealthSnapshot> => {
    const checkedAt = now();
    const configured = arrServices.filter((service) => arr[service].configured());
    const [statuses, arrReads, accountStats] = await Promise.all([
      Promise.allSettled([arr.sonarr.check(), arr.radarr.check(), rtorrent.check(), plex.check()]),
      Promise.all(configured.map(async (service) => {
        const [health, disks, updates] = await Promise.allSettled([
          read(service, '/api/v3/health'),
          read(service, '/api/v3/diskspace'),
          read(service, '/api/v3/update'),
        ]);
        return { service, health: settled(health, []), disks: settled(disks, []), updates: settled(updates, []) };
      })),
      Promise.allSettled([trackerAccounts.stats()]).then(([result]) => settled(result, [])),
    ]);
    const problems: HealthProblem[] = [];
    const ours = (id: string, level: HealthProblem['level'], check: string, message: string) => {
      problems.push({ id, level, source: 'media-manager-2', check, message, docsUrl: null });
    };

    const names: ServiceName[] = ['sonarr', 'radarr', 'rtorrent', 'plex'];
    const services = names.map((name, index) => {
      const status = settled<ConnectionStatus>(statuses[index], { kind: 'unreachable' });
      const label = labels[name];
      if (status.kind === 'unreachable') ours(`service:${name}`, 'error', 'service', `${label} is unreachable.`);
      if (status.kind === 'rejected') ours(`service:${name}`, 'error', 'service', `${label} refused the credentials.`);
      if (status.kind === 'not_configured') ours(`service:${name}`, 'notice', 'service', `${label} is not connected yet.`);
      const reads = arrReads.find((entry) => entry.service === name);
      const available = reads?.updates.find((row) => row.latest === true && row.installed !== true && row.installable === true);
      const update = available !== undefined && typeof available.version === 'string' ? available.version : null;
      if (update !== null) ours(`update:${name}`, 'notice', 'update', `${label} ${update} is available`);
      return { name, label, status, update };
    });

    const disks = new Map<string, HealthSnapshot['disks'][number]>();
    for (const { service, health, disks: drives } of arrReads) {
      for (const row of health) {
        if (row.type !== 'notice' && row.type !== 'warning' && row.type !== 'error') continue;
        problems.push({
          id: `arr:${service}:${String(row.source)}`,
          level: row.type,
          source: service === 'sonarr' ? 'Sonarr' : 'Radarr',
          check: String(row.source),
          message: String(row.message),
          docsUrl: docsUrl(row.wikiUrl),
        });
      }
      for (const drive of drives) {
        if (typeof drive.path !== 'string' || typeof drive.freeSpace !== 'number' || typeof drive.totalSpace !== 'number') continue;
        const known = disks.get(drive.path);
        if (known !== undefined) {
          known.sources.push(service);
          continue;
        }
        disks.set(drive.path, {
          path: drive.path,
          label: typeof drive.label === 'string' ? drive.label : '',
          freeBytes: drive.freeSpace,
          totalBytes: drive.totalSpace,
          sources: [service],
        });
      }
    }
    for (const disk of disks.values()) {
      if (disk.freeBytes >= DISK_FREE_MINIMUM && disk.freeBytes >= disk.totalBytes * 0.1) continue;
      const used = disk.totalBytes > 0 ? Math.round(((disk.totalBytes - disk.freeBytes) / disk.totalBytes) * 100) : 100;
      ours(`disk:${disk.path}`, 'warning', 'disk', `Drive ${disk.path} is ${used}% full · ${formatBytes(disk.freeBytes)} free of ${formatBytes(disk.totalBytes)}`);
    }

    const imports = readDependency(database, 'imports');
    if (imports?.state === 'down') ours('dependency:imports', 'error', 'imports', `Imports are paused: ${imports.detail}`);

    const cooldowns = listCooldowns(database);
    const torrents = listTorrents(database).filter((torrent) => torrent.goneAt === null);
    const hostOf = new Map(torrents.map((torrent) => [torrent.hash, torrent.trackerHost]));
    const down = new Map<string, number>();
    for (const issue of listIssues(database)) {
      const host = hostOf.get(issue.hash);
      if (issue.kind === 'tracker_down' && host) down.set(host, (down.get(host) ?? 0) + 1);
    }
    const hosts = new Set<string>(cooldowns.map((cooldown) => cooldown.host));
    for (const torrent of torrents) if (torrent.trackerHost) hosts.add(torrent.trackerHost);
    const trackerOf = (host: string) => trackerNames.find((name) => indexerMatchesHost(name, host));
    for (const stats of accountStats) {
      const account = accountOf(stats);
      if (account.kind === 'ok') {
        const label = trackerLabels[stats.tracker];
        if (account.ratio !== null && account.ratioMinimum !== null && account.ratio < account.ratioMinimum) {
          ours(`ratio:${stats.tracker}`, 'warning', 'tracker', `${label} ratio ${account.ratio.toFixed(2)} is below its minimum ${account.ratioMinimum}`);
        }
        const previous = lastHitAndRuns.get(stats.tracker);
        if (account.hitAndRuns !== null) {
          if (previous !== undefined && account.hitAndRuns > previous) {
            ours(`hnr:${stats.tracker}`, 'warning', 'tracker', `${label} hit-and-run count rose from ${previous} to ${account.hitAndRuns} (lifetime count)`);
          }
          // The first count since start stays the baseline, so the warning lasts until restart.
          if (previous === undefined) lastHitAndRuns.set(stats.tracker, account.hitAndRuns);
        }
      }
      if (stats.kind === 'not_configured' || [...hosts].some((host) => trackerOf(host) === stats.tracker)) continue;
      hosts.add(stats.tracker);
    }
    const trackers = [...hosts].sort().map((host) => {
      const cooldown = cooldowns.find((entry) => entry.host === host) ?? null;
      if (cooldown?.known === true) {
        ours(`cooldown:${host}`, 'warning', 'tracker', `${host} refused downloads since ${new Date(cooldown.since).toISOString()}: "${cooldown.text}"`);
      } else if (cooldown !== null) {
        ours(`cooldown:${host}`, 'error', 'tracker', `${host} refused downloads with text media-manager-2 doesn't know: "${cooldown.text}"`);
      }
      const count = down.get(host) ?? 0;
      if (count > 0) ours(`tracker:${host}`, 'warning', 'tracker', `${host} isn't answering (${count} torrent${count === 1 ? '' : 's'})`);
      const tracker = trackerOf(host);
      const account = accountOf(accountStats.find((stats) => stats.tracker === tracker));
      return { host, reachable: count === 0, cooldown, account };
    });

    const jobStatus = jobs.status();
    for (const job of jobStatus) {
      if (!job.late) continue;
      const since = job.lastFinishedAt ?? job.lastStartedAt ?? checkedAt;
      ours(`job:${job.name}`, 'warning', 'jobs', `Background job ${job.name} hasn't finished for ${formatDuration(checkedAt - since)}; expected every ${formatDuration(job.intervalMs)}`);
    }

    const lastAt = lastBackupAt(database);
    let backup: HealthSnapshot['backup'];
    if (lastAt === null) {
      backup = { kind: 'not_set_up' };
      ours('backup', 'notice', 'backup', 'Backups are not set up');
    } else if (checkedAt - lastAt > BACKUP_STALE_MS) {
      backup = { kind: 'stale', lastAt };
      ours('backup', 'warning', 'backup', `The last backup finished ${formatDuration(checkedAt - lastAt)} ago`);
    } else {
      backup = { kind: 'ok', lastAt };
    }

    problems.sort((a, b) => ranks[b.level] - ranks[a.level] || a.source.localeCompare(b.source) || a.message.localeCompare(b.message));
    const level = problems[0]?.level ?? 'ok';
    snapshot = { checkedAt, level, problems, services, trackers, disks: [...disks.values()], jobs: jobStatus, backup };
    events.publish('health', {
      checkedAt,
      level,
      errors: problems.filter((problem) => problem.level === 'error').length,
      warnings: problems.filter((problem) => problem.level === 'warning').length,
    });
    return snapshot;
  };

  return { check, current: () => snapshot };
};

export type Health = ReturnType<typeof createHealth>;

export const createHealthRoutes = (health: Health) => {
  const routes = new Hono();
  routes.get('/', async (context) => context.json(health.current() ?? await health.check()));
  routes.post('/check', async (context) => context.json(await health.check()));
  return routes;
};
