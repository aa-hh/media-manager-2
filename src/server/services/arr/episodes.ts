import { type FileDetail, finiteNumber, type Image, parseFile, parseImages, positiveInteger, text } from './files.js';
import { isRecord, refusal, type Result, type Send } from './result.js';

export type Episode = {
  id: number;
  seriesId: number | null;
  // Sonarr embeds the series only on the single-episode read.
  seriesTitle: string | null;
  seasonNumber: number;
  episodeNumber: number;
  title: string | null;
  airDateUtc: string | null;
  monitored: boolean;
  hasFile: boolean;
  overview: string | null;
  runtime: number | null;
  finaleType: string | null;
  absoluteEpisodeNumber: number | null;
  sceneSeasonNumber: number | null;
  sceneEpisodeNumber: number | null;
  unverifiedSceneNumbering: boolean;
  lastSearchTime: string | null;
  images: Image[];
  file: FileDetail | null;
};

const integer = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) ? value : null);

export const parseEpisode = (value: unknown): Episode | null => {
  if (!isRecord(value)) return null;
  const id = positiveInteger(value.id);
  const seasonNumber = integer(value.seasonNumber);
  const episodeNumber = integer(value.episodeNumber);
  if (id === null || seasonNumber === null || episodeNumber === null) return null;
  return {
    id,
    seriesId: positiveInteger(value.seriesId),
    seriesTitle: isRecord(value.series) ? text(value.series.title) : null,
    seasonNumber,
    episodeNumber,
    title: text(value.title),
    airDateUtc: text(value.airDateUtc),
    monitored: value.monitored === true,
    hasFile: value.hasFile === true,
    overview: text(value.overview),
    runtime: finiteNumber(value.runtime),
    finaleType: text(value.finaleType),
    absoluteEpisodeNumber: finiteNumber(value.absoluteEpisodeNumber),
    sceneSeasonNumber: finiteNumber(value.sceneSeasonNumber),
    sceneEpisodeNumber: finiteNumber(value.sceneEpisodeNumber),
    unverifiedSceneNumbering: value.unverifiedSceneNumbering === true,
    lastSearchTime: text(value.lastSearchTime),
    images: parseImages(value.images),
    file: parseFile(value.episodeFile),
  };
};

export const createEpisodes = ({ label, send }: { label: string; send: Send }) => {
  const episodes = async (seriesId: number, options: { seasonNumber?: number; withFiles?: boolean } = {}): Promise<Result<Episode[]>> => {
    const operation = 'the episode list';
    const season = options.seasonNumber === undefined ? '' : `&seasonNumber=${options.seasonNumber}`;
    const files = options.withFiles === true ? '&includeEpisodeFile=true&includeImages=true' : '';
    const answer = await send(operation, `/api/v3/episode?seriesId=${seriesId}${season}${files}`);
    if (answer.kind !== 'ok') return answer;
    const { body } = answer.value;
    if (!Array.isArray(body)) return refusal(`${label} sent no list of records for ${operation}.`);
    return { kind: 'ok', value: body.flatMap((item) => parseEpisode(item) ?? []) };
  };

  const episode = async (episodeId: number): Promise<Result<Episode>> => {
    const operation = 'the episode read';
    const answer = await send(operation, `/api/v3/episode/${episodeId}`);
    if (answer.kind !== 'ok') return answer;
    const parsed = parseEpisode(answer.value.body);
    return parsed === null ? refusal(`${label} sent no record for ${operation}.`) : { kind: 'ok', value: parsed };
  };

  const episodeFiles = async (seriesId: number): Promise<Result<FileDetail[]>> => {
    const operation = 'the episode file list';
    const answer = await send(operation, `/api/v3/episodefile?seriesId=${seriesId}`);
    if (answer.kind !== 'ok') return answer;
    const { body } = answer.value;
    if (!Array.isArray(body)) return refusal(`${label} sent no list of records for ${operation}.`);
    return { kind: 'ok', value: body.flatMap((item) => parseFile(item) ?? []) };
  };

  const monitorEpisodes = async (episodeIds: number[], monitored: boolean): Promise<Result<void>> => {
    const answer = await send('the episode monitor change', '/api/v3/episode/monitor', { method: 'PUT', body: { episodeIds, monitored } });
    return answer.kind === 'ok' ? { kind: 'ok', value: undefined } : answer;
  };

  // One file per call: the adapter sends no body with DELETE, so Sonarr's bulk delete is out of reach.
  const deleteEpisodeFile = async (fileId: number): Promise<Result<void>> => {
    const answer = await send('the episode file delete', `/api/v3/episodefile/${fileId}`, { method: 'DELETE' });
    return answer.kind === 'ok' ? { kind: 'ok', value: undefined } : answer;
  };

  return { episodes, episode, episodeFiles, monitorEpisodes, deleteEpisodeFile };
};
