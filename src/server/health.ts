import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { backupsAreOff } from './backup.js';
import { readDependency } from './dependencies.js';
import type { EventHub } from './events.js';
import type { createJobRunner } from './jobs.js';
import type { ConnectionStatus } from './services/connection.js';
import type { MediaServer } from './services/mediaServer.js';
import type { TrackerConnection } from './services/trackerAccounts.js';
import { trackerRule } from './trackerRules.js';
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
type ServiceName = 'sonarr' | 'radarr' | 'rtorrent' | 'plex' | 'jellyfin' | 'tmdb' | 'mdblist';
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
  backup: { kind: 'not_set_up' } | { kind: 'off' } | { kind: 'failing'; detail: string } | { kind: 'ok' | 'stale'; lastAt: number };
};

type ArrClient = {
  check(): Promise<ConnectionStatus>;
  configured(): boolean;
  request(path: string): Promise<{ status: number; body: unknown }>;
};

const ranks: Record<HealthLevel, number> = { ok: 0, notice: 1, warning: 2, error: 3 };
const labels: Record<ServiceName, string> = { sonarr: 'Sonarr', radarr: 'Radarr', rtorrent: 'rTorrent', plex: 'Plex', jellyfin: 'Jellyfin', tmdb: 'TMDB', mdblist: 'MDBList' };
const arrServices: Service[] = ['sonarr', 'radarr'];
// The account's minimum ratio: a Gazelle site's own required ratio, else the minGlobalRatio of the tracker's rule.
// A saved rule that fails validation leaves it unknown here; removal advice reports that rule's problem.
const ratioMinimum = (database: DatabaseSync, host: string, connection: TrackerConnection) => {
  if (connection.kind === 'ok' && connection.stats.requiredRatio !== null) return connection.stats.requiredRatio;
  try {
    return trackerRule(database, host)?.rule.minGlobalRatio ?? null;
  } catch {
    return null;
  }
};

// A site older than its software's account API is shown like one with no account connection at all.
const accountOf = (connection: TrackerConnection, minimum: number | null): TrackerAccount => {
  if (connection.kind === 'not_configured') return { kind: 'not_set_up' };
  if (connection.kind === 'too_old') return { kind: 'unavailable', reason: 'unsupported' };
  if (connection.kind !== 'ok') return { kind: 'unavailable', reason: connection.kind };
  const { stats } = connection;
  return { kind: 'ok', ratio: stats.ratio, ratioMinimum: minimum, hitAndRuns: stats.hitAndRuns?.count ?? null, hitAndRunsIsLifetime: stats.hitAndRuns?.kind === 'lifetime' };
};
// An announce host such as tracker.blutopia.cc belongs to the added tracker blutopia.cc.
const belongsTo = (host: string, tracker: string) => host === tracker || host.endsWith(`.${tracker}`);
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

const lastBackupFailure = (database: DatabaseSync): string | null => {
  const row = database.prepare('SELECT outcome, detail FROM backup_runs ORDER BY id DESC LIMIT 1').get();
  return row?.outcome === 'failed' ? String(row.detail) : null;
};

export const createHealth = (options: {
  database: DatabaseSync;
  arr: Record<Service, ArrClient>;
  rtorrent: { check(): Promise<ConnectionStatus> };
  mediaServer: () => Pick<MediaServer, 'name' | 'check'>;
  tmdb: { check(): Promise<ConnectionStatus> };
  mdblist: { check(): Promise<ConnectionStatus> };
  jobs: { status(): JobStatus };
  trackerAccounts: { stats(): Promise<{ host: string; connection: TrackerConnection }[]> };
  events: EventHub;
  now?: () => number;
}) => {
  const { database, arr, rtorrent, mediaServer, tmdb, mdblist, jobs, trackerAccounts, events } = options;
  const now = options.now ?? Date.now;
  let snapshot: HealthSnapshot | undefined;
  // Kept in memory only: the first check after a restart records the count without warning.
  const lastHitAndRuns = new Map<string, number>();

  const readBody = async (service: Service, path: string) => {
    const { status, body } = await arr[service].request(path);
    if (status < 200 || status > 299) throw new Error(`${labels[service]} refused ${path}.`);
    return body;
  };
  const read = async (service: Service, path: string) => records(await readBody(service, path));
  const settled = <T>(result: PromiseSettledResult<T>, fallback: T) => (result.status === 'fulfilled' ? result.value : fallback);

  const check = async (): Promise<HealthSnapshot> => {
    const checkedAt = now();
    const configured = arrServices.filter((service) => arr[service].configured());
    const server = mediaServer();
    const [statuses, arrReads, accountStats] = await Promise.all([
      Promise.allSettled([arr.sonarr.check(), arr.radarr.check(), rtorrent.check(), server.check(), tmdb.check(), mdblist.check()]),
      Promise.all(configured.map(async (service) => {
        const [health, disks, updates, clients, media] = await Promise.allSettled([
          read(service, '/api/v3/health'),
          read(service, '/api/v3/diskspace'),
          read(service, '/api/v3/update'),
          // Remove Completed is set on each download client, not in the shared download client settings.
          read(service, '/api/v3/downloadclient'),
          readBody(service, '/api/v3/config/mediamanagement'),
        ]);
        return {
          service,
          health: settled(health, []),
          disks: settled(disks, []),
          updates: settled(updates, []),
          clients: settled(clients, []),
          media: settled<unknown>(media, undefined),
        };
      })),
      Promise.allSettled([trackerAccounts.stats()]).then(([result]) => settled(result, [])),
    ]);
    const problems: HealthProblem[] = [];
    const ours = (id: string, level: HealthProblem['level'], check: string, message: string) => {
      problems.push({ id, level, source: 'media-manager-2', check, message, docsUrl: null });
    };

    const names: ServiceName[] = ['sonarr', 'radarr', 'rtorrent', server.name, 'tmdb', 'mdblist'];
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

    // The two Sonarr and Radarr settings that keep a torrent seeding, and its disk use single, after an import.
    for (const { service, clients, media } of arrReads) {
      const label = labels[service];
      const removing = clients.filter((client) => client.enable === true && client.protocol !== 'usenet' && client.removeCompletedDownloads === true)
        .map((client) => String(client.name));
      if (removing.length > 0) {
        ours(`setting:${service}:removeCompletedDownloads`, 'error', 'settings', `${label}'s download client ${removing.join(', ')} removes each torrent once it is imported, which ends its seeding. Turn off Remove Completed in ${label}'s Settings > Download Clients.`);
      }
      if (isRecord(media) && media.copyUsingHardlinks === false) {
        ours(`setting:${service}:copyUsingHardlinks`, 'warning', 'settings', `${label} copies imports instead of hardlinking them, so each import uses the disk space twice and hand imports are refused. Turn on Use Hardlinks instead of Copy in ${label}'s Settings > Media Management.`);
      }
    }

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
    const accounts = new Map(accountStats.map(({ host, connection }) => [host, accountOf(connection, ratioMinimum(database, host, connection))]));
    const trackerOf = (host: string) => [...accounts.keys()].filter((tracker) => belongsTo(host, tracker)).sort((a, b) => b.length - a.length)[0];
    for (const { host: tracker, connection } of accountStats) {
      const account = accounts.get(tracker);
      if (account?.kind === 'ok') {
        if (account.ratio !== null && account.ratioMinimum !== null && account.ratio < account.ratioMinimum) {
          ours(`ratio:${tracker}`, 'warning', 'tracker', `${tracker} ratio ${account.ratio.toFixed(2)} is below its minimum ${account.ratioMinimum}`);
        }
        const previous = lastHitAndRuns.get(tracker);
        // Only UNIT3D reports hit-and-runs, as a lifetime count, not the currently open ones.
        if (account.hitAndRuns !== null) {
          if (previous !== undefined && account.hitAndRuns > previous) {
            ours(`hnr:${tracker}`, 'warning', 'tracker', `${tracker} hit-and-run count rose from ${previous} to ${account.hitAndRuns} (lifetime count)`);
          }
          // The first count since start stays the baseline, so the warning lasts until restart.
          if (previous === undefined) lastHitAndRuns.set(tracker, account.hitAndRuns);
        }
      }
      // A tracker with no account connection is listed only once it has torrents or a cooldown.
      if (connection.kind === 'not_configured' || connection.kind === 'unsupported' || [...hosts].some((host) => trackerOf(host) === tracker)) continue;
      hosts.add(tracker);
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
      const account = (tracker === undefined ? undefined : accounts.get(tracker)) ?? { kind: 'not_set_up' };
      return { host, reachable: count === 0, cooldown, account };
    });

    const jobStatus = jobs.status();
    for (const job of jobStatus) {
      if (!job.late) continue;
      const since = job.lastFinishedAt ?? job.lastStartedAt ?? checkedAt;
      ours(`job:${job.name}`, 'warning', 'jobs', `Background job ${job.name} hasn't finished for ${formatDuration(checkedAt - since)}; expected every ${formatDuration(job.intervalMs)}`);
    }

    const lastAt = lastBackupAt(database);
    const failure = lastBackupFailure(database);
    let backup: HealthSnapshot['backup'];
    if (backupsAreOff(database)) {
      backup = { kind: 'off' };
    } else if (lastAt === null && failure !== null) {
      backup = { kind: 'failing', detail: failure };
      ours('backup', 'warning', 'backup', `Backups are failing: ${failure}`);
    } else if (lastAt === null) {
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
