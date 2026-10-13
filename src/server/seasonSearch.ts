import type { DatabaseSync } from 'node:sqlite';
import type { Subject } from './problems.js';
import { isHeldBack } from './searches.js';
import type { ArrServices, QueueItem, Result } from './services/arr.js';
import { listQueue } from './torrentGrabs.js';

const airedBy = (airDateUtc: string | null, at: number) => {
  const airedAt = airDateUtc === null ? Number.NaN : Date.parse(airDateUtc);
  return !Number.isNaN(airedAt) && airedAt <= at;
};

// Whether any of a season's missing episodes is one the scheduler leaves alone, so a SeasonSearch would search it too.
export const seasonHeldBack = (
  options: { database: DatabaseSync; isManualDownload: (subject: Subject) => boolean },
  missingEpisodeIds: number[],
  ignoreQueued: (item: QueueItem) => boolean = () => false,
): boolean => {
  const { database, isManualDownload } = options;
  const queued = new Set(listQueue(database)
    .filter((item) => item.service === 'sonarr' && !ignoreQueued(item))
    .map((item) => String(item.episodeId)));
  return missingEpisodeIds.some((id) => isHeldBack(database, isManualDownload, queued, { type: 'episode', service: 'sonarr', id: String(id) }));
};

// A pack is replaced by a pack because private trackers credit seeding only for a torrent that completes. Only a standard series
// gets one, and only for a grab that covered the whole aired season with no other missing episode queued, hand-picked or backlogged.
export const searchSeasonFirst = async (
  options: { arr: ArrServices; database: DatabaseSync; isManualDownload: (subject: Subject) => boolean; now: () => number },
  grab: { seriesId: number | null; episodeIds: number[]; ownDownload: { hash: string | null; title: string | null } },
): Promise<Result<unknown>> => {
  const { arr, now } = options;
  const { seriesId, episodeIds, ownDownload } = grab;
  if (seriesId === null || episodeIds.length < 2) return arr.sonarr.searchAutomatically({ episodeIds });
  const series = await arr.sonarr.series(seriesId);
  if (series.kind !== 'ok') return series;
  if (series.value.seriesType !== 'standard') return arr.sonarr.searchAutomatically({ episodeIds });
  const listed = await arr.sonarr.episodes(seriesId);
  if (listed.kind !== 'ok') return listed;
  const given = new Set(episodeIds);
  const at = now();
  // The replaced download may still be in the queue snapshot; it must not hold its own season back.
  const own = (item: QueueItem) => (ownDownload.hash !== null && item.downloadId === ownDownload.hash)
    || (ownDownload.title !== null && item.title === ownDownload.title);
  const seasons = [...new Set(listed.value.filter((episode) => given.has(episode.id)).map((episode) => episode.seasonNumber))]
    .filter((seasonNumber) => seasonNumber > 0)
    .sort((a, b) => a - b)
    .filter((seasonNumber) => {
      const aired = listed.value.filter((episode) => episode.seasonNumber === seasonNumber && airedBy(episode.airDateUtc, at));
      const missing = aired.filter((episode) => episode.monitored && !episode.hasFile).map((episode) => episode.id);
      return aired.every((episode) => given.has(episode.id)) && !seasonHeldBack(options, missing, own);
    });
  const covered = new Set(listed.value.filter((episode) => seasons.includes(episode.seasonNumber)).map((episode) => episode.id));
  for (const seasonNumber of seasons) {
    const searched = await arr.sonarr.searchAutomatically({ seriesId, seasonNumber });
    if (searched.kind !== 'ok') return searched;
  }
  const rest = episodeIds.filter((id) => !covered.has(id));
  return rest.length === 0 ? { kind: 'ok', value: undefined } : arr.sonarr.searchAutomatically({ episodeIds: rest });
};
