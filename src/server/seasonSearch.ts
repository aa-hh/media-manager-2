import type { ArrServices, Result } from './services/arr.js';

const airedBy = (airDateUtc: string | null, at: number) => {
  const airedAt = airDateUtc === null ? Number.NaN : Date.parse(airDateUtc);
  return !Number.isNaN(airedAt) && airedAt <= at;
};

// A pack is replaced by a pack because private trackers credit seeding only for a torrent that completes.
// Only a grab that covered the whole aired season counts, so a partial multi-episode release is still replaced episode by episode.
export const searchSeasonFirst = async (
  arr: ArrServices,
  seriesId: number | null,
  episodeIds: number[],
  now: () => number,
): Promise<Result<unknown>> => {
  if (seriesId === null || episodeIds.length < 2) return arr.sonarr.searchAutomatically({ episodeIds });
  const listed = await arr.sonarr.episodes(seriesId);
  if (listed.kind !== 'ok') return listed;
  const given = new Set(episodeIds);
  const at = now();
  const seasons = [...new Set(listed.value.filter((episode) => given.has(episode.id)).map((episode) => episode.seasonNumber))]
    .filter((seasonNumber) => seasonNumber > 0)
    .sort((a, b) => a - b)
    .filter((seasonNumber) => listed.value
      .filter((episode) => episode.seasonNumber === seasonNumber && airedBy(episode.airDateUtc, at))
      .every((episode) => given.has(episode.id)));
  const covered = new Set(listed.value.filter((episode) => seasons.includes(episode.seasonNumber)).map((episode) => episode.id));
  for (const seasonNumber of seasons) {
    const searched = await arr.sonarr.searchAutomatically({ seriesId, seasonNumber });
    if (searched.kind !== 'ok') return searched;
  }
  const rest = episodeIds.filter((id) => !covered.has(id));
  return rest.length === 0 ? { kind: 'ok', value: undefined } : arr.sonarr.searchAutomatically({ episodeIds: rest });
};
