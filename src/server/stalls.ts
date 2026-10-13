import type { DatabaseSync } from 'node:sqlite';
import { type ArrServices, valueOrThrow } from './services/arr.js';
import type { createLabels } from './labels.js';
import { findGrab, type Grab, isOwnedTorrent, listQueue, type Service, WATCH_KINDS } from './torrentGrabs.js';
import type { createProblems, Subject } from './problems.js';
import { findOpenProblem, listOpenProblems, RELEASE_LIMIT } from './problems.js';
import type { XmlRpcParam } from './services/rtorrent.js';
import type { Removal } from './torrentFiles.js';
import { listTorrents, type Torrent } from './torrents.js';
import { listCooldowns, NOT_WATCHED, type createTrackerWatch } from './trackers.js';

type Problems = ReturnType<typeof createProblems>;
type TrackerWatch = ReturnType<typeof createTrackerWatch>;
type XmlRpcCall = (method: string, params: readonly XmlRpcParam[]) => Promise<unknown>;

export const NO_SEEDERS_LIMIT_MS = 60 * 60_000;
export const NEW_RELEASE_NO_SEEDERS_LIMIT_MS = 3 * 60 * 60_000;
export const NEW_RELEASE_AGE_MS = 24 * 60 * 60_000;
// AA-13 says to ask for fresh peers when speed is zero with seeders present, then wait 30 minutes.
// Ten minutes of zero speed first keeps a brief pause between peers from triggering an announce.
export const ZERO_SPEED_BEFORE_ANNOUNCE_MS = 10 * 60_000;
export const AFTER_ANNOUNCE_LIMIT_MS = 30 * 60_000;
export const UNFINISHED_FLAG_MS = 14 * 24 * 60 * 60_000;
export const STALLED_REMOVED = 'Stalled with nothing downloaded; torrent removed.';

type Watch = { hash: string; noSeedersSince: number | null; zeroSpeedSince: number | null; announcedAt: number | null; replacedAt: number | null };

type Release = { guid: string; indexerId: number; indexer: string; title: string; approved: boolean };

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const labels: Record<Service, string> = { sonarr: 'Sonarr', radarr: 'Radarr' };

// A tracker host and an indexer name match when the host's site label appears in the name: beyond-hd.me ~ "BeyondHD (API)".
export const indexerMatchesHost = (indexer: string, host: string) => {
  const parts = host.toLowerCase().split('.').filter((part) => part !== 'www' && part !== 'tracker' && part !== 'announce');
  const label = (parts.length >= 2 ? parts[parts.length - 2] : parts[0] ?? '').replace(/[^a-z0-9]/g, '');
  return label !== '' && indexer.toLowerCase().replace(/[^a-z0-9]/g, '').includes(label);
};

const subjectsOf = (grab: Grab): Subject[] => (grab.movieId !== null
  ? [{ type: 'movie', service: grab.service, id: String(grab.movieId) }]
  : grab.episodeIds.map((id) => ({ type: 'episode' as const, service: grab.service, id: String(id) })));

const readWatch = (database: DatabaseSync, hash: string): Watch | undefined => {
  const row = database.prepare('SELECT * FROM stall_watch WHERE hash = ?').get(hash);
  if (row === undefined) return undefined;
  const nullable = (value: unknown) => (value === null ? null : Number(value));
  return {
    hash,
    noSeedersSince: nullable(row.no_seeders_since),
    zeroSpeedSince: nullable(row.zero_speed_since),
    announcedAt: nullable(row.announced_at),
    replacedAt: nullable(row.replaced_at),
  };
};

const emptyWatch = (hash: string): Watch => ({ hash, noSeedersSince: null, zeroSpeedSince: null, announcedAt: null, replacedAt: null });

const saveWatch = (database: DatabaseSync, watch: Watch) => {
  database.prepare(`
    INSERT INTO stall_watch (hash, no_seeders_since, zero_speed_since, announced_at, replaced_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (hash) DO UPDATE SET no_seeders_since = excluded.no_seeders_since, zero_speed_since = excluded.zero_speed_since,
      announced_at = excluded.announced_at, replaced_at = excluded.replaced_at
  `).run(watch.hash, watch.noSeedersSince, watch.zeroSpeedSince, watch.announcedAt, watch.replacedAt);
};

export const createStallFix = (options: {
  database: DatabaseSync;
  rtorrent: { call: XmlRpcCall };
  arr: ArrServices;
  problems: Problems;
  trackers: TrackerWatch;
  now?: () => number;
  isManualDownload: (subject: Subject) => boolean;
  labels: Pick<ReturnType<typeof createLabels>, 'movie' | 'episode'>;
  removeTorrent: (hash: string) => Promise<Removal>;
}) => {
  const { database, rtorrent, arr, problems, trackers, isManualDownload, labels: titles, removeTorrent } = options;
  const now = options.now ?? Date.now;

  // rTorrent's connected seeders miss seeders the tracker knows about, so the tracker's scrape count wins when it has one.
  const trackerSeeders = async (torrent: Torrent) => {
    try {
      const rows = await rtorrent.call('t.multicall', [torrent.hash, '', 't.scrape_complete=']);
      const counts = Array.isArray(rows)
        ? rows.flatMap((row) => (Array.isArray(row) && typeof row[0] === 'number' ? [row[0]] : []))
        : [];
      return Math.max(torrent.seedersConnected, ...counts);
    } catch {
      return torrent.seedersConnected;
    }
  };

  const isStalled = async (torrent: Torrent, at: number): Promise<string | null> => {
    const previous = readWatch(database, torrent.hash) ?? emptyWatch(torrent.hash);
    const seeders = await trackerSeeders(torrent);
    const watch: Watch = { ...previous };
    let verdict: string | null = null;
    if (seeders === 0) {
      watch.zeroSpeedSince = null;
      watch.announcedAt = null;
      watch.noSeedersSince ??= at;
      const published = findGrab(database, torrent.hash)?.publishedAt ?? null;
      // An unknown release age gets the longer wait, so a new release is never written off early.
      const isNew = published === null || at - published < NEW_RELEASE_AGE_MS;
      const limit = isNew ? NEW_RELEASE_NO_SEEDERS_LIMIT_MS : NO_SEEDERS_LIMIT_MS;
      if (at - watch.noSeedersSince >= limit) verdict = `No seeders for ${isNew ? 'three hours' : 'an hour'}.`;
    } else if (torrent.downRate === 0) {
      watch.noSeedersSince = null;
      watch.zeroSpeedSince ??= at;
      if (watch.announcedAt === null && at - watch.zeroSpeedSince >= ZERO_SPEED_BEFORE_ANNOUNCE_MS) {
        try {
          await rtorrent.call('d.tracker_announce', [torrent.hash]);
        } catch {
          // A failed announce still starts the 30-minute wait; the tracker watch reports an unreachable tracker.
        }
        watch.announcedAt = at;
      } else if (watch.announcedAt !== null && at - watch.announcedAt >= AFTER_ANNOUNCE_LIMIT_MS) {
        verdict = 'Seeders but no download speed, even after asking the tracker for fresh peers.';
      }
    } else {
      watch.noSeedersSince = null;
      watch.zeroSpeedSince = null;
      watch.announcedAt = null;
    }
    saveWatch(database, watch);
    return verdict;
  };

  // Partly downloaded torrents stay active so they can't become a hit and run; only files still at 0% stop downloading.
  const settleOldTorrent = async (torrent: Torrent | undefined) => {
    if (torrent === undefined || torrent.goneAt !== null) return 'The old torrent is already gone from rTorrent.';
    if (torrent.completedBytes === 0) {
      await rtorrent.call('d.erase', [torrent.hash]);
      return 'Removed the old torrent from rTorrent: nothing had downloaded.';
    }
    const files = await rtorrent.call('f.multicall', [torrent.hash, '', 'f.completed_chunks=']);
    const untouched = Array.isArray(files)
      ? files.flatMap((row, index) => (Array.isArray(row) && row[0] === 0 ? [index] : []))
      : [];
    if (!Array.isArray(files) || files.length <= 1 || untouched.length === 0) {
      return 'Kept the partly downloaded torrent active in rTorrent.';
    }
    for (const index of untouched) await rtorrent.call('f.priority.set', [`${torrent.hash}:f${index}`, 0]);
    await rtorrent.call('d.update_priorities', [torrent.hash]);
    return `Kept the partly downloaded torrent active and stopped ${untouched.length} file${untouched.length === 1 ? '' : 's'} at 0%.`;
  };

  // Blocklist through the queue with rTorrent left alone; skipRedownload stops Sonarr and Radarr picking the next release themselves.
  const blocklist = async (grab: Grab) => {
    const items = listQueue(database).filter((item) => item.service === grab.service && item.downloadId === grab.hash);
    if (items.length === 0) return false;
    const { removed } = valueOrThrow(await arr[grab.service].removeFromQueue({ downloadId: grab.hash }, 'block'));
    if (removed === 0) throw new Error(`${labels[grab.service]} no longer lists this download in its queue, so the release was not blocked.`);
    return true;
  };

  const parseReleases = (body: unknown): Release[] => (Array.isArray(body) ? body : []).flatMap((value) => {
    if (!isRecord(value) || typeof value.guid !== 'string' || typeof value.indexerId !== 'number') return [];
    return [{
      guid: value.guid,
      indexerId: value.indexerId,
      indexer: typeof value.indexer === 'string' ? value.indexer : '',
      title: typeof value.title === 'string' ? value.title : '',
      approved: value.approved === true && value.rejected !== true,
    }];
  });

  // Sonarr and Radarr list releases best first; take the best approved one, preferring another tracker and never one on a cooldown.
  const pickRelease = (releases: Release[], previous: Grab) => {
    const cooldownHosts = listCooldowns(database).map((cooldown) => cooldown.host);
    const usable = releases.filter((release) => release.approved && release.title !== previous.releaseTitle
      && !cooldownHosts.some((host) => indexerMatchesHost(release.indexer, host)));
    return usable.find((release) => release.indexer !== previous.indexer) ?? usable[0];
  };

  const searchAgain = async (grab: Grab): Promise<string> => {
    const client = arr[grab.service];
    if (grab.service === 'sonarr' && grab.movieId === null && grab.episodeIds.length !== 1) {
      // razor: a multi-episode or pack grab is searched automatically, without the tracker preference; per-episode releases need their own picks.
      valueOrThrow(await arr.sonarr.searchAutomatically({ episodeIds: grab.episodeIds }));
      return 'Asked Sonarr to search automatically for these episodes.';
    }
    const query = grab.movieId !== null ? `movieId=${grab.movieId}` : `episodeId=${grab.episodeIds[0]}`;
    // An interactive search asks every tracker and takes about 20 seconds; the 10 second default cuts it off.
    const { status, body } = await client.request(`/api/v3/release?${query}`, { timeoutMs: 120_000 });
    if (status < 200 || status > 299) throw new Error(`${labels[grab.service]} search failed.`);
    const release = pickRelease(parseReleases(body), grab);
    if (release === undefined) return 'Searched again and found no other usable release; the regular search keeps looking.';
    const grabbed = await client.request('/api/v3/release', { method: 'POST', body: { guid: release.guid, indexerId: release.indexerId }, timeoutMs: 60_000 });
    if (grabbed.status < 200 || grabbed.status > 299) throw new Error(`${labels[grab.service]} refused the grab of ${release.title}.`);
    return `Grabbed ${release.title} from ${release.indexer || 'another tracker'}.`;
  };

  // Only rows still downloading: failed rows include a hash Sonarr or Radarr grabbed themselves.
  const downloadingVersions = (hash: string) => database
    .prepare("SELECT movie_id, episode_id, release_title FROM second_versions WHERE hash = ? AND state = 'downloading' ORDER BY id")
    .all(hash);

  // A second version has no grab to blocklist or search again, so it is never regrabbed: per AA-13 it is removed only when
  // nothing downloaded, and the owner is told either way.
  const flagSecondVersion = async (torrent: Torrent | undefined, hash: string, reason: string, rows: ReturnType<typeof downloadingVersions>) => {
    const names = await Promise.all(rows.map((row) => (row.movie_id !== null ? titles.movie(Number(row.movie_id)) : titles.episode(Number(row.episode_id)))));
    const problem = problems.open({
      kind: 'stalled',
      subject: { type: 'torrent', service: null, id: hash },
      hash,
      state: 'needs_you',
      summary: `${reason} Second version of ${names.join(', ')} (${String(rows[0].release_title)}).`,
    });
    let outcome: string;
    if (torrent === undefined || torrent.goneAt !== null) {
      outcome = 'The torrent is already gone from rTorrent.';
    } else if (torrent.completedBytes > 0) {
      outcome = 'Kept the partly downloaded torrent active in rTorrent; it was not regrabbed.';
    } else {
      const removal = await removeTorrent(hash);
      if (removal.removed) {
        database.prepare("UPDATE second_versions SET state = 'failed', failure = ?, failure_code = 'stalled_removed', updated_at = ? WHERE hash = ? AND state = 'downloading'")
          .run(STALLED_REMOVED, now(), hash);
        const left = removal.left.map((file) => ` Could not delete ${file.path}: ${file.reason}`).join('');
        outcome = `Removed the torrent and its files from rTorrent: nothing had downloaded. It was not regrabbed.${left}`;
      } else {
        outcome = `Kept the torrent in rTorrent because it could not be removed: ${removal.reason}`;
      }
    }
    problems.step(problem.id, 'fix', outcome);
    saveWatch(database, { ...emptyWatch(hash), replacedAt: now() });
    trackers.replacementHandled(hash, 'Flagged as a stalled second version.');
  };

  // A flagged second version that downloads again needs nothing from the owner, and is watched afresh from here.
  const clearRecovered = (torrent: Torrent) => {
    if (!torrent.complete && torrent.downRate === 0) return;
    if ((readWatch(database, torrent.hash)?.replacedAt ?? null) === null || downloadingVersions(torrent.hash).length === 0) return;
    const problem = findOpenProblem(database, 'stalled', { type: 'torrent', service: null, id: torrent.hash });
    if (problem !== undefined) problems.setState(problem.id, 'resolved', torrent.complete ? 'Finished downloading.' : 'Downloading again.');
    saveWatch(database, emptyWatch(torrent.hash));
  };

  const replace = async (torrent: Torrent | undefined, hash: string, reason: string) => {
    const versions = downloadingVersions(hash);
    if (versions.length > 0) {
      await flagSecondVersion(torrent, hash, reason, versions);
      return;
    }
    const grab = findGrab(database, hash);
    const subject: Subject = { type: 'torrent', service: null, id: hash };
    if (grab === undefined) {
      problems.open({ kind: 'stalled', subject, hash, summary: `${reason} No Sonarr or Radarr grab matches this torrent, so it can't be replaced automatically.`, state: 'needs_you' });
      saveWatch(database, { ...emptyWatch(hash), replacedAt: now() });
      trackers.replacementHandled(hash, 'Needs the owner: no grab record.');
      return;
    }
    if (problems.pausedBy(['rtorrent', grab.service]).length > 0) return;
    const items = subjectsOf(grab);
    const problem = problems.open({ kind: 'stalled', subject, hash, summary: `${reason} (${grab.releaseTitle})` });
    try {
      const counts = items.map((item) => problems.recordReleaseAttempt(item, hash));
      const blocked = await blocklist(grab);
      problems.step(problem.id, 'fix', blocked ? 'Blocked the release in ' + labels[grab.service] + '.' : 'The release had already left the queue.');
      problems.step(problem.id, 'fix', await settleOldTorrent(torrent));
      if (items.some(isManualDownload)) {
        problems.setState(problem.id, 'needs_you', 'This is a manual download, so nothing else is grabbed automatically.');
      } else if (Math.max(...counts) >= RELEASE_LIMIT) {
        problems.setState(problem.id, 'needs_you', `Gave up after ${RELEASE_LIMIT} different releases.`);
      } else {
        const result = await searchAgain(grab);
        problems.step(problem.id, 'fix', result);
        problems.setState(problem.id, 'resolved', result);
      }
    } catch (error) {
      problems.setState(problem.id, 'needs_you', error instanceof Error ? error.message : 'The fix failed.');
    }
    // A kept partial torrent stays in rTorrent; marking it replaced stops it being replaced again on every later check.
    saveWatch(database, { ...emptyWatch(hash), replacedAt: now() });
    trackers.replacementHandled(hash, 'Handed to the stall fix.');
  };

  const flagLongUnfinished = (torrent: Torrent, at: number) => {
    if (at - torrent.firstSeenAt < UNFINISHED_FLAG_MS) return;
    const gib = (bytes: number) => (bytes / 1024 ** 3).toFixed(2);
    // razor: uploaded is ratio × downloaded from the poll; add d.up.total to the poll if this needs to be exact.
    const uploaded = Math.round((torrent.ratioThousandths / 1000) * torrent.completedBytes);
    problems.open({
      kind: 'unfinished',
      subject: { type: 'torrent', service: null, id: torrent.hash },
      hash: torrent.hash,
      state: 'needs_you',
      summary: `${torrent.name} has been unfinished for 14 days: ${gib(torrent.completedBytes)} GiB downloaded, ${gib(uploaded)} GiB uploaded.`,
    });
  };

  const check = async () => {
    if (problems.pausedBy(['rtorrent']).length > 0) return;
    const at = now();
    const torrents = listTorrents(database);
    const byHash = new Map(torrents.map((torrent) => [torrent.hash, torrent]));
    // Flags opened before torrents nobody here grabbed were ignored close here.
    for (const problem of listOpenProblems(database, WATCH_KINDS)) {
      if (problem.subject.type === 'torrent' && !isOwnedTorrent(database, problem.subject.id)) problems.setState(problem.id, 'resolved', NOT_WATCHED);
    }
    const requested = new Set(trackers.replacementRequests().map((issue) => issue.hash));
    for (const hash of requested) {
      if ((readWatch(database, hash)?.replacedAt ?? null) !== null) {
        trackers.replacementHandled(hash, 'Already replaced.');
        continue;
      }
      await replace(byHash.get(hash), hash, 'The tracker can\'t serve this torrent.');
    }
    for (const torrent of torrents) {
      if (torrent.goneAt !== null || requested.has(torrent.hash) || !isOwnedTorrent(database, torrent.hash)) continue;
      clearRecovered(torrent);
      if (torrent.complete) continue;
      flagLongUnfinished(torrent, at);
      if (!torrent.started || torrent.message !== '' || (readWatch(database, torrent.hash)?.replacedAt ?? null) !== null) continue;
      const verdict = await isStalled(torrent, at);
      if (verdict !== null) await replace(torrent, torrent.hash, verdict);
    }
  };

  return { check };
};
