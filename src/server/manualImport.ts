import type { DatabaseSync } from 'node:sqlite';
import { type Assignment, type AssignmentTarget, checkAssignments } from './assignments.js';
import { findGrab, listQueue, type Service } from './grabs.js';
import { listOpenProblems, type createProblems } from './problems.js';

type Problems = ReturnType<typeof createProblems>;
type ArrRequest = (path: string, init?: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown }) => Promise<{ status: number; body: unknown }>;

export type ImportFile = {
  path: string;
  relativePath: string;
  size: number;
  qualityId: number | null;
  languageIds: number[];
  episodeIds: number[];
  movieId: number | null;
  rejections: string[];
};

export type ImportView = {
  service: Service;
  downloadId: string;
  title: string;
  reasons: string[];
  target:
    | { kind: 'series'; seriesId: number; episodes: { id: number; code: string; title: string }[] }
    | { kind: 'movie'; movieId: number; title: string };
  files: ImportFile[];
  qualities: { id: number; name: string }[];
  languages: { id: number; name: string }[];
};

export type SubmitResult =
  | { kind: 'imported' }
  | { kind: 'invalid'; reasons: string[] }
  | { kind: 'not_found' }
  | { kind: 'failed'; reason: string };

const labels: Record<Service, string> = { sonarr: 'Sonarr', radarr: 'Radarr' };

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const integer = (value: unknown) => (typeof value === 'number' && Number.isSafeInteger(value) ? value : null);
const text = (value: unknown) => (typeof value === 'string' ? value : '');
const idsOf = (value: unknown) => (Array.isArray(value)
  ? value.flatMap((entry) => (isRecord(entry) && integer(entry.id) !== null ? [entry.id as number] : []))
  : []);

class ServiceError extends Error {}

// Finishing an import by hand (AA-62): the owner picks the movie or episodes, quality and language for each file;
// the server re-checks the assignment against Sonarr's or Radarr's own file list and imports with hardlinks only.
export const createManualImport = (options: { database: DatabaseSync; arr: Record<Service, { request: ArrRequest }>; problems: Problems }) => {
  const { database, arr, problems } = options;

  const get = async (service: Service, path: string) => {
    let result: { status: number; body: unknown };
    try {
      result = await arr[service].request(path);
    } catch {
      throw new ServiceError(`${labels[service]} is unreachable.`);
    }
    if (result.status < 200 || result.status > 299) throw new ServiceError(`${labels[service]} could not be read.`);
    return result.body;
  };

  // The title the download belongs to comes from the grab record, or the queue when the grab was never seen.
  const titleOf = (service: Service, downloadId: string) => {
    const grab = findGrab(database, downloadId);
    const items = listQueue(database).filter((item) => item.service === service && item.downloadId === downloadId);
    if (grab === undefined && items.length === 0) return undefined;
    return {
      seriesId: grab?.seriesId ?? items.find((item) => item.seriesId !== null)?.seriesId ?? null,
      movieId: grab?.movieId ?? items.find((item) => item.movieId !== null)?.movieId ?? null,
      label: items.find((item) => item.label !== '')?.label ?? grab?.releaseTitle ?? items[0]?.title ?? downloadId,
      reasons: [
        ...listOpenProblems(database).filter((problem) => problem.hash === downloadId).map((problem) => problem.summary),
        ...items.flatMap((item) => item.statusMessages.flatMap((message) => message.messages)),
      ],
    };
  };

  const read = async (service: Service, downloadId: string): Promise<ImportView | undefined> => {
    const title = titleOf(service, downloadId);
    if (title === undefined) return undefined;
    const [files, qualities, languages] = await Promise.all([
      get(service, `/api/v3/manualimport?downloadId=${downloadId}&filterExistingFiles=false`),
      get(service, '/api/v3/qualitydefinition'),
      get(service, '/api/v3/language'),
    ]);
    let target: ImportView['target'];
    if (service === 'sonarr') {
      if (title.seriesId === null) return undefined;
      const episodes = await get(service, `/api/v3/episode?seriesId=${title.seriesId}`);
      target = {
        kind: 'series',
        seriesId: title.seriesId,
        episodes: (Array.isArray(episodes) ? episodes : []).flatMap((episode) => {
          if (!isRecord(episode) || integer(episode.id) === null) return [];
          const code = `S${String(episode.seasonNumber).padStart(2, '0')}E${String(episode.episodeNumber).padStart(2, '0')}`;
          return [{ id: episode.id as number, code, title: text(episode.title) }];
        }),
      };
    } else {
      if (title.movieId === null) return undefined;
      const movie = await get(service, `/api/v3/movie/${title.movieId}`);
      target = { kind: 'movie', movieId: title.movieId, title: isRecord(movie) ? text(movie.title) : title.label };
    }
    return {
      service,
      downloadId,
      title: title.label,
      reasons: [...new Set(title.reasons)],
      target,
      files: (Array.isArray(files) ? files : []).flatMap((file): ImportFile[] => {
        if (!isRecord(file) || typeof file.path !== 'string') return [];
        const quality = isRecord(file.quality) && isRecord(file.quality.quality) ? integer(file.quality.quality.id) : null;
        return [{
          path: file.path,
          relativePath: text(file.relativePath) || file.path,
          size: integer(file.size) ?? 0,
          qualityId: quality,
          languageIds: idsOf(file.languages),
          episodeIds: idsOf(file.episodes),
          movieId: isRecord(file.movie) ? integer(file.movie.id) : null,
          rejections: Array.isArray(file.rejections)
            ? file.rejections.flatMap((rejection) => (isRecord(rejection) && typeof rejection.reason === 'string' ? [rejection.reason] : []))
            : [],
        }];
      }),
      qualities: (Array.isArray(qualities) ? qualities : []).flatMap((definition) => {
        const quality = isRecord(definition) && isRecord(definition.quality) ? definition.quality : undefined;
        return quality !== undefined && integer(quality.id) !== null ? [{ id: quality.id as number, name: text(definition.title) || text(quality.name) }] : [];
      }),
      languages: (Array.isArray(languages) ? languages : []).flatMap((language) => (
        isRecord(language) && integer(language.id) !== null ? [{ id: language.id as number, name: text(language.name) }] : []
      )),
    };
  };

  const submit = async (service: Service, downloadId: string, assignments: Assignment[]): Promise<SubmitResult> => {
    try {
      const view = await read(service, downloadId);
      if (view === undefined) return { kind: 'not_found' };
      const target: AssignmentTarget = view.target.kind === 'series'
        ? { kind: 'series', episodeIds: view.target.episodes.map((episode) => episode.id) }
        : { kind: 'movie', movieId: view.target.movieId };
      const reasons = checkAssignments(assignments, target, {
        paths: view.files.map((file) => file.path),
        qualityIds: view.qualities.map((quality) => quality.id),
        languageIds: view.languages.map((language) => language.id),
      });
      if (reasons.length > 0) return { kind: 'invalid', reasons };

      // Copy mode hardlinks only when the service is set to; without it the import would copy, or a move would end seeding.
      const settings = await get(service, '/api/v3/config/mediamanagement');
      if (!isRecord(settings) || settings.copyUsingHardlinks !== true) {
        return { kind: 'failed', reason: `${labels[service]} is not set to use hardlinks, so importing could stop seeding. Turn on "Use Hardlinks instead of Copy" first.` };
      }
      const definitions = await get(service, '/api/v3/qualitydefinition') as Record<string, unknown>[];
      const languages = new Map(view.languages.map((language) => [language.id, language]));
      const originals = await get(service, `/api/v3/manualimport?downloadId=${downloadId}&filterExistingFiles=false`) as Record<string, unknown>[];
      const files = assignments.map((assignment) => {
        const original = originals.find((file) => isRecord(file) && file.path === assignment.path) ?? {};
        const definition = definitions.find((entry) => isRecord(entry.quality) && entry.quality.id === assignment.qualityId)!;
        const revision = isRecord(original.quality) && isRecord(original.quality.revision) ? original.quality.revision : { version: 1, real: 0, isRepack: false };
        const base = {
          path: assignment.path,
          quality: { quality: definition.quality, revision },
          languages: assignment.languageIds.map((id) => languages.get(id)),
          releaseGroup: original.releaseGroup,
          downloadId,
        };
        return view.target.kind === 'series'
          ? { ...base, seriesId: view.target.seriesId, episodeIds: assignment.episodeIds }
          : { ...base, movieId: view.target.movieId };
      });
      const command = await arr[service].request('/api/v3/command', { method: 'POST', body: { name: 'ManualImport', files, importMode: 'copy' } });
      if (command.status < 200 || command.status > 299) return { kind: 'failed', reason: `${labels[service]} refused the import.` };
      for (const problem of listOpenProblems(database).filter((open) => open.hash === downloadId)) {
        problems.setState(problem.id, 'resolved', `Imported by hand: ${files.length} ${files.length === 1 ? 'file' : 'files'}.`);
      }
      return { kind: 'imported' };
    } catch (error) {
      if (error instanceof ServiceError) return { kind: 'failed', reason: error.message };
      return { kind: 'failed', reason: `${labels[service]} is unreachable.` };
    }
  };

  return { read, submit };
};
