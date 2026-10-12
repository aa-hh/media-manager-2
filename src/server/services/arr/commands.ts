import { isRecord, refusal, type Result, type Send, type Service } from './result.js';

export type SonarrSearchTarget = { episodeIds: number[] } | { seriesId: number; seasonNumber?: number };
export type RadarrSearchTarget = { movieIds: number[] };
export type SearchTarget<S extends Service> = S extends 'sonarr' ? SonarrSearchTarget : RadarrSearchTarget;

export type ForceImportGrab = { hash: string; movieId: number | null; seriesId: number | null; episodeIds: number[] };

export type ForceImport = {
  (grab: ForceImportGrab): Promise<Result<void>>;
  (downloadId: string, files: unknown[]): Promise<Result<void>>;
};

const done = (answer: Result<unknown>): Result<void> => (answer.kind === 'ok' ? { kind: 'ok', value: undefined } : answer);

export const createCommands = <S extends Service>({ service, label, send }: { service: S; label: string; send: Send }) => {
  const command = (operation: string, body: Record<string, unknown>) => send(operation, '/api/v3/command', { method: 'POST', body });

  const searchAutomatically = async (target: SonarrSearchTarget | RadarrSearchTarget): Promise<Result<void>> => {
    const operation = 'the automatic search';
    if ('movieIds' in target) return done(await command(operation, { name: 'MoviesSearch', movieIds: target.movieIds }));
    if ('episodeIds' in target) return done(await command(operation, { name: 'EpisodeSearch', episodeIds: target.episodeIds }));
    if (target.seasonNumber !== undefined) {
      return done(await command(operation, { name: 'SeasonSearch', seriesId: target.seriesId, seasonNumber: target.seasonNumber }));
    }
    return done(await command(operation, { name: 'SeriesSearch', seriesId: target.seriesId }));
  };

  const refreshTitle = async (id: number): Promise<Result<void>> => done(await command(
    'the title refresh',
    service === 'sonarr' ? { name: 'RefreshSeries', seriesId: id } : { name: 'RefreshMovie', movieIds: [id] },
  ));

  const refreshMonitoredDownloads = async (): Promise<Result<void>> => done(
    await command('the download refresh', { name: 'RefreshMonitoredDownloads' }),
  );

  const operation = 'the forced import';

  // Every forced import is a copy, which only keeps the torrent seeding when Sonarr or Radarr copies by hardlink.
  const checkHardlinks = async (): Promise<Result<void>> => {
    const answer = await send(operation, '/api/v3/config/mediamanagement');
    if (answer.kind !== 'ok') return answer;
    if (isRecord(answer.value.body) && answer.value.body.copyUsingHardlinks === true) return { kind: 'ok', value: undefined };
    return refusal(
      `${label} is not set to use hardlinks, so the forced import could stop seeding. Turn on "Use Hardlinks instead of Copy" in ${label} first.`,
    );
  };

  // A forced import drops every rejection, and a sample imported after the real file would replace it.
  const isSample = (candidate: Record<string, unknown>) => Array.isArray(candidate.rejections) && candidate.rejections.some((rejection) => {
    const reason = isRecord(rejection) ? rejection.reason : rejection;
    return typeof reason === 'string' && /sample/i.test(reason);
  });

  // Forces the import only onto what the grab record says was grabbed; any file outside it stops the whole import.
  const grabFiles = async (grab: ForceImportGrab): Promise<Result<unknown[]>> => {
    const answer = await send(operation, `/api/v3/manualimport?downloadId=${grab.hash}&filterExistingFiles=false`);
    if (answer.kind !== 'ok') return answer;
    const { body } = answer.value;
    if (!Array.isArray(body)) return refusal(`${label} sent no list of files for the forced import.`);
    const allowed = new Set(grab.episodeIds);
    const files: Record<string, unknown>[] = [];
    for (const candidate of body) {
      if (!isRecord(candidate) || typeof candidate.path !== 'string' || isSample(candidate)) continue;
      const base = {
        path: candidate.path,
        quality: candidate.quality,
        languages: candidate.languages,
        releaseGroup: candidate.releaseGroup,
        downloadId: grab.hash,
      };
      if (grab.movieId !== null) {
        files.push({ ...base, movieId: grab.movieId });
        continue;
      }
      const parsed = Array.isArray(candidate.episodes)
        ? candidate.episodes.flatMap((episode) => (isRecord(episode) && typeof episode.id === 'number' ? [episode.id] : []))
        : [];
      const episodeIds = parsed.length > 0 ? parsed : grab.episodeIds.length === 1 ? grab.episodeIds : [];
      if (episodeIds.length === 0 || episodeIds.some((id) => !allowed.has(id))) {
        return refusal(`${candidate.path} doesn't match the episodes that were grabbed.`);
      }
      files.push({ ...base, seriesId: grab.seriesId, episodeIds });
    }
    if (files.length === 0) return refusal(`${label} found no files to import.`);
    return { kind: 'ok', value: files };
  };

  const forceImport = async (source: ForceImportGrab | string, given: unknown[] = []): Promise<Result<void>> => {
    const hardlinks = await checkHardlinks();
    if (hardlinks.kind !== 'ok') return hardlinks;
    let files = given;
    if (typeof source !== 'string') {
      const listed = await grabFiles(source);
      if (listed.kind !== 'ok') return listed;
      files = listed.value;
    }
    return done(await command(operation, { name: 'ManualImport', files, importMode: 'copy' }));
  };

  // Sonarr and Radarr move deleted files here instead of deleting them, so the space is freed only once it is emptied.
  const recycleBin = async (): Promise<Result<string | null>> => {
    const operation = 'the media management settings read';
    const answer = await send(operation, '/api/v3/config/mediamanagement');
    if (answer.kind !== 'ok') return answer;
    const { body } = answer.value;
    if (!isRecord(body)) return refusal(`${label} sent no record for ${operation}.`);
    return { kind: 'ok', value: typeof body.recycleBin === 'string' && body.recycleBin.trim() !== '' ? body.recycleBin.trim() : null };
  };

  // Whether a list could add a removed title back by itself: Radarr's enabled lists with automatic add, Sonarr's with automatic add.
  const importLists = async (): Promise<Result<boolean>> => {
    const operation = 'the import list read';
    const answer = await send(operation, '/api/v3/importlist');
    if (answer.kind !== 'ok') return answer;
    const { body } = answer.value;
    if (!Array.isArray(body)) return refusal(`${label} sent no list of records for ${operation}.`);
    const adds = (list: unknown) => isRecord(list) && (service === 'radarr' ? list.enabled === true && list.enableAuto === true : list.enableAutomaticAdd === true);
    return { kind: 'ok', value: body.some(adds) };
  };

  return {
    recycleBin,
    importLists,
    searchAutomatically: searchAutomatically as (target: SearchTarget<S>) => Promise<Result<void>>,
    refreshTitle,
    refreshMonitoredDownloads,
    forceImport: forceImport as ForceImport,
  };
};
