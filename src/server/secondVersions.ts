import { createHash } from 'node:crypto';
import { isAbsolute } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { parseTarget, type Release, type Releases, type ReleaseTarget } from './releases.js';
import type { SecondVersionDelete } from './secondVersionDelete.js';
import { readSetting } from './services/connection.js';
import { RtorrentFault, type XmlRpcParam } from './services/rtorrent.js';
import { listTorrents } from './torrents.js';

type XmlRpcCall = (method: string, params: readonly XmlRpcParam[]) => Promise<unknown>;

export type SecondVersionState = 'sending' | 'downloading' | 'importing' | 'imported' | 'failed' | 'deleted';
// One per place that writes a failure. send_unconfirmed sits on a row still sending, until the next poll settles it.
export type FailureCode = 'download_link_failed' | 'not_a_torrent' | 'already_in_rtorrent' | 'rtorrent_refused' | 'send_unconfirmed'
  | 'grabbed_by_arr' | 'never_received' | 'stalled_removed' | 'import_no_name' | 'import_no_match' | 'import_link_failed'
  | 'torrent_gone';

export type SecondVersion = {
  id: number;
  service: 'sonarr' | 'radarr';
  movieId: number | null;
  seriesId: number | null;
  episodeId: number | null;
  releaseTitle: string;
  guid: string;
  indexer: string;
  quality: string;
  sizeBytes: number | null;
  hash: string | null;
  state: SecondVersionState;
  failure: string | null;
  failureCode: FailureCode | null;
  filePath: string | null;
  createdAt: number;
  updatedAt: number;
  importedAt: number | null;
  deletedAt: number | null;
};

// Sonarr and Radarr pick up only torrents carrying their own category label, so this one leaves them alone.
export const SECOND_VERSION_LABEL = 'mm2-second-version';
// The .torrent comes from an indexer, so its size, wait and redirects are all capped.
const TORRENT_FILE_LIMIT = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 5;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

// The SHA-1 of the info dictionary's bytes exactly as they sit in the file; re-encoding could reorder or
// normalise them and give a different hash. Undefined when the bytes are not a bencoded dictionary holding one.
export const infoHash = (bytes: Uint8Array): string | undefined => {
  const fail = (): never => { throw new Error('Not bencode.'); };
  const digits = (from: number, to: number) => {
    if (to <= from) fail();
    for (let index = from; index < to; index += 1) if (bytes[index] < 0x30 || bytes[index] > 0x39) fail();
  };
  // Returns where the value starting at `at` ends (exclusive).
  const skip = (at: number, depth: number): number => {
    if (at >= bytes.length || depth > 64) fail();
    const first = bytes[at];
    if (first === 0x69) {
      const end = bytes.indexOf(0x65, at + 1);
      if (end === -1) fail();
      digits(bytes[at + 1] === 0x2d ? at + 2 : at + 1, end);
      return end + 1;
    }
    if (first === 0x6c || first === 0x64) {
      let position = at + 1;
      while (bytes[position] !== 0x65) {
        if (position >= bytes.length) fail();
        if (first === 0x64) position = skip(position, depth + 1);
        position = skip(position, depth + 1);
      }
      return position + 1;
    }
    const colon = bytes.indexOf(0x3a, at);
    if (colon === -1) fail();
    digits(at, colon);
    const end = colon + 1 + Number(Buffer.from(bytes.subarray(at, colon)).toString('latin1'));
    if (end > bytes.length) fail();
    return end;
  };
  try {
    if (bytes[0] !== 0x64) return undefined;
    let position = 1;
    while (bytes[position] !== 0x65) {
      if (position >= bytes.length) return undefined;
      const keyEnd = skip(position, 1);
      const key = Buffer.from(bytes.subarray(bytes.indexOf(0x3a, position) + 1, keyEnd)).toString('latin1');
      const valueEnd = skip(keyEnd, 1);
      if (key === 'info' && bytes[keyEnd] === 0x64) {
        return createHash('sha1').update(bytes.subarray(keyEnd, valueEnd)).digest('hex').toUpperCase();
      }
      position = valueEnd;
    }
    return undefined;
  } catch {
    return undefined;
  }
};

type Fetched = { kind: 'ok'; bytes: Uint8Array } | { kind: 'refused'; reason: string };

// Never put the link or a fetch error in a reason: the link carries the indexer's API key.
const fetchTorrent = async (fetchImpl: typeof globalThis.fetch, link: string | null | undefined): Promise<Fetched> => {
  const refused = (reason: string) => ({ kind: 'refused', reason }) as const;
  if (typeof link !== 'string' || link === '') return refused('This release has no torrent file to download; search again.');
  let current = link;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (current.startsWith('magnet:')) return refused('This release is a magnet link only, so there is no torrent file to send.');
    let url: URL;
    try {
      url = new URL(current);
    } catch {
      return refused('The download link is not a web address.');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return refused('The download link is not a web address.');
    let response: Response;
    try {
      response = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    } catch {
      return refused("The indexer didn't answer the download link.");
    }
    if (response.status >= 300 && response.status <= 399) {
      await response.body?.cancel();
      const location = response.headers.get('location');
      if (location === null) return refused("The indexer's redirect named no address.");
      try {
        current = new URL(location, url).href;
      } catch {
        return refused('The download link is not a web address.');
      }
      continue;
    }
    if (response.status < 200 || response.status > 299) {
      await response.body?.cancel();
      return refused(`The indexer refused the download link (HTTP ${response.status}).`);
    }
    if (Number(response.headers.get('content-length') ?? 0) > TORRENT_FILE_LIMIT) {
      await response.body?.cancel();
      return refused('The torrent file is larger than 10 MB.');
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for await (const chunk of response.body ?? []) {
        size += chunk.byteLength;
        // Leaving the loop cancels the stream.
        if (size > TORRENT_FILE_LIMIT) return refused('The torrent file is larger than 10 MB.');
        chunks.push(chunk);
      }
    } catch {
      return refused('The torrent file stopped downloading part way.');
    }
    return { kind: 'ok', bytes: Buffer.concat(chunks) };
  }
  return refused('The download link redirected too many times.');
};

const rowToRecord = (row: Record<string, unknown>): SecondVersion => ({
  id: row.id as number,
  service: row.service as SecondVersion['service'],
  movieId: (row.movie_id as number | null) ?? null,
  seriesId: (row.series_id as number | null) ?? null,
  episodeId: (row.episode_id as number | null) ?? null,
  releaseTitle: row.release_title as string,
  guid: row.guid as string,
  indexer: row.indexer as string,
  quality: row.quality as string,
  sizeBytes: (row.size_bytes as number | null) ?? null,
  hash: (row.hash as string | null) ?? null,
  state: row.state as SecondVersionState,
  failure: (row.failure as string | null) ?? null,
  failureCode: (row.failure_code as FailureCode | null) ?? null,
  filePath: (row.file_path as string | null) ?? null,
  createdAt: row.created_at as number,
  updatedAt: row.updated_at as number,
  importedAt: (row.imported_at as number | null) ?? null,
  deletedAt: (row.deleted_at as number | null) ?? null,
});

// One subject per row: the movie, or each episode the release covers, so a season pack gets a row per episode.
const subjectsFor = (target: ReleaseTarget, release: Release) => {
  if (target.kind === 'movie') return [{ movieId: target.movieId, seriesId: null, episodeId: null }];
  const covered = release.episodeIds ?? [];
  const episodeIds = covered.length > 0 ? covered : target.kind === 'episode' ? [target.episodeId] : [];
  return episodeIds.map((episodeId) => ({ movieId: null, seriesId: target.seriesId, episodeId }));
};

export const createSecondVersions = (options: {
  database: DatabaseSync;
  releases: Releases;
  rtorrent: { call: XmlRpcCall };
  fetch?: typeof globalThis.fetch;
  now?: () => number;
}) => {
  const { database, releases, rtorrent } = options;
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  // Hashes whose load.raw_start has not returned yet; the poll check must not judge them.
  const sending = new Set<string>();

  const byHash = (hash: string) => database.prepare('SELECT * FROM second_versions WHERE hash = ? ORDER BY id')
    .all(hash)
    .map((row) => rowToRecord(row as Record<string, unknown>));

  return {
    async grab(target: ReleaseTarget, guid: string) {
      const release = releases.find(target, guid);
      if (release === undefined) return { kind: 'unknown_release' } as const;
      // A second version downloads into the same folder as its service's own grabs.
      const key = `downloads.${target.service}`;
      const folder = readSetting(database, 'hostPaths', key);
      if (folder === undefined || !isAbsolute(folder)) {
        return { kind: 'refused', reason: `Set hostPaths ${key} to the folder ${target.service === 'sonarr' ? 'Sonarr' : 'Radarr'} downloads into.` } as const;
      }
      // razor: rTorrent reads the folder inside a quoted command; a quote, backslash or line break would need escaping it may not honour.
      if (/["\\\r\n]/.test(folder)) {
        return { kind: 'refused', reason: `hostPaths ${key} cannot contain a quote, backslash or line break.` } as const;
      }
      if (readSetting(database, 'serviceAddresses', 'rtorrent.url') === undefined) {
        return { kind: 'refused', reason: 'Set up rTorrent first.' } as const;
      }
      if (release.protocol !== null && release.protocol !== 'torrent') {
        return { kind: 'refused', reason: 'This release is not a torrent.' } as const;
      }
      const subjects = subjectsFor(target, release);
      if (subjects.length === 0) return { kind: 'refused', reason: "Sonarr didn't say which episodes this release covers." } as const;

      const insert = (hash: string | null, state: 'sending' | 'failed', failure: string | null, failureCode: FailureCode | null) => {
        const at = now();
        const statement = database.prepare(`
          INSERT INTO second_versions (service, movie_id, series_id, episode_id, release_title, guid, indexer, quality, size_bytes, hash, state, failure, failure_code, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const ids = subjects.map((subject) => Number(statement.run(
          target.service, subject.movieId, subject.seriesId, subject.episodeId, release.title, guid, release.indexer ?? '',
          release.quality ?? '', release.size, hash, state, failure, failureCode, at, at,
        ).lastInsertRowid));
        return ids.map((id) => rowToRecord(database.prepare('SELECT * FROM second_versions WHERE id = ?').get(id) as Record<string, unknown>));
      };
      const failed = (reason: string, code: FailureCode) => ({ kind: 'failed', reason, records: insert(null, 'failed', reason, code) }) as const;

      const fetched = await fetchTorrent(fetchImpl, release.downloadUrl);
      if (fetched.kind === 'refused') return failed(fetched.reason, 'download_link_failed');
      const hash = infoHash(fetched.bytes);
      if (hash === undefined) {
        const text = Buffer.from(fetched.bytes.subarray(0, 512)).toString('utf8').trimStart().toLowerCase();
        return failed(text.startsWith('<') ? 'The download link returned a web page, not a torrent file.' : 'The download link did not return a torrent file.', 'not_a_torrent');
      }

      // Checked and recorded with no await in between, so a second click on the same release finds the first one's rows.
      const live = listTorrents(database).some((torrent) => torrent.hash === hash && torrent.goneAt === null);
      const taken = database.prepare("SELECT 1 AS found FROM second_versions WHERE hash = ? AND state NOT IN ('failed', 'deleted')").get(hash);
      if (live || taken !== undefined) return failed('That torrent is already in rTorrent.', 'already_in_rtorrent');
      // Recorded before sending, so a crash between the two leaves rows to explain the torrent.
      database.exec('BEGIN IMMEDIATE;');
      try {
        insert(hash, 'sending', null, null);
        // A stall record left from an earlier use of this torrent would make the stall check skip it for good.
        database.prepare('DELETE FROM stall_watch WHERE hash = ?').run(hash);
        database.exec('COMMIT;');
      } catch (error) {
        database.exec('ROLLBACK;');
        throw error;
      }

      sending.add(hash);
      try {
        await rtorrent.call('load.raw_start', ['', fetched.bytes, `d.directory.set="${folder}"`, `d.custom1.set=${SECOND_VERSION_LABEL}`]);
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'rTorrent did not answer.';
        if (error instanceof RtorrentFault) {
          database.prepare("UPDATE second_versions SET state = 'failed', failure = ?, failure_code = 'rtorrent_refused', updated_at = ? WHERE hash = ? AND state = 'sending'").run(reason, now(), hash);
          return { kind: 'failed', reason, records: byHash(hash) } as const;
        }
        // A transport failure may have reached rTorrent anyway, so the next poll decides; it is never sent again.
        database.prepare("UPDATE second_versions SET failure = ?, failure_code = 'send_unconfirmed', updated_at = ? WHERE hash = ? AND state = 'sending'").run(reason, now(), hash);
        return { kind: 'unconfirmed', reason, records: byHash(hash) } as const;
      } finally {
        sending.delete(hash);
      }
      // A 0 reply only means rTorrent queued the load: it drops a hash it already has and just logs it. So the rows stay
      // sending, restamped so only a poll that began after this reply settles them by the hash's label.
      database.prepare("UPDATE second_versions SET updated_at = ? WHERE hash = ? AND state = 'sending'").run(now(), hash);
      return { kind: 'sent', records: byHash(hash) } as const;
    },

    // After a poll that began at `polledSince`: rows still sending from before it are settled by whether rTorrent has
    // their hash under this app's label; the same hash without it is a torrent Sonarr or Radarr grabbed.
    async reconcile(polledSince: number) {
      const live = new Set(listTorrents(database).filter((torrent) => torrent.goneAt === null).map((torrent) => torrent.hash));
      const hashes = database.prepare("SELECT DISTINCT hash FROM second_versions WHERE state = 'sending' AND updated_at < ?")
        .all(polledSince)
        .map((row) => row.hash as string);
      const at = now();
      for (const hash of hashes) {
        if (sending.has(hash)) continue;
        if (live.has(hash)) {
          let label: unknown;
          try {
            label = await rtorrent.call('d.custom1', [hash]);
          } catch {
            continue;
          }
          if (label === SECOND_VERSION_LABEL) {
            database.prepare("UPDATE second_versions SET state = 'downloading', failure = NULL, failure_code = NULL, updated_at = ? WHERE hash = ? AND state = 'sending'").run(at, hash);
          } else {
            database.prepare("UPDATE second_versions SET state = 'failed', failure = 'Sonarr or Radarr grabbed the same torrent.', failure_code = 'grabbed_by_arr', updated_at = ? WHERE hash = ? AND state = 'sending'").run(at, hash);
          }
        } else {
          database.prepare(`
            UPDATE second_versions SET state = 'failed', failure_code = 'never_received', updated_at = ?,
              failure = 'rTorrent never received it.' || CASE WHEN failure IS NULL THEN '' ELSE ' ' || failure END
            WHERE hash = ? AND state = 'sending'
          `).run(at, hash);
        }
      }
    },

    byHash,
  };
};

export type SecondVersions = ReturnType<typeof createSecondVersions>;

export const createSecondVersionRoutes = (secondVersions: SecondVersions, deleteVersion?: SecondVersionDelete) => {
  const routes = new Hono();
  routes.delete('/:id', async (context) => {
    const idText = context.req.param('id');
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: 'invalid_request' }, 400);
    }
    if (!/^\d{1,15}$/.test(idText) || !isRecord(body) || Object.keys(body).join(',') !== 'removeTorrent' || typeof body.removeTorrent !== 'boolean') {
      return context.json({ error: 'invalid_request' }, 400);
    }
    if (deleteVersion === undefined) return context.json({ error: 'not_found' }, 404);
    const result = await deleteVersion(Number(idText), body.removeTorrent);
    if (result.kind === 'not_found') return context.json({ error: 'not_found' }, 404);
    if (result.kind === 'refused') return context.json({ error: 'refused', reason: result.reason }, 409);
    const { kind: _kind, ...reply } = result;
    return context.json(reply);
  });
  routes.post('/', async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: 'invalid_request' }, 400);
    }
    if (!isRecord(body) || Object.keys(body).some((key) => key !== 'target' && key !== 'guid')) {
      return context.json({ error: 'invalid_request' }, 400);
    }
    const target = parseTarget(body.target);
    if (target === undefined || typeof body.guid !== 'string' || body.guid === '') return context.json({ error: 'invalid_request' }, 400);
    const result = await secondVersions.grab(target, body.guid);
    if (result.kind === 'unknown_release') return context.json({ error: 'unknown_release' }, 404);
    if (result.kind === 'refused') return context.json({ error: 'refused', reason: result.reason }, 409);
    if (result.kind === 'failed') return context.json({ error: 'failed', reason: result.reason, secondVersions: result.records }, 409);
    if (result.kind === 'unconfirmed') return context.json({ reason: result.reason, secondVersions: result.records }, 202);
    // 201 with rows still sending: rTorrent took the file, and 202 stays the reply that carries a reason to show.
    return context.json({ secondVersions: result.records }, 201);
  });
  return routes;
};
