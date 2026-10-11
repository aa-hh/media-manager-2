import { count, type FileDetail, finiteNumber, idList, type Image, parseFile, parseImages, positiveInteger, stringList, text } from './files.js';
import { isRecord, refusal, type Result, type Send } from './result.js';

export type Movie = {
  id: number | null;
  title: string;
  year: number | null;
  status: string | null;
  overview: string | null;
  images: Image[];
  rating: number | null;
  certification: string | null;
  genres: string[];
  runtime: number | null;
  studio: string | null;
  collection: string | null;
  path: string | null;
  tags: number[];
  imdbId: string | null;
  tmdbId: number | null;
  monitored: boolean;
  hasFile: boolean;
  isAvailable: boolean;
  minimumAvailability: string | null;
  qualityProfileId: number | null;
  added: string | null;
  lastSearchTime: string | null;
  sizeOnDisk: number;
  inCinemas: string | null;
  digitalRelease: string | null;
  physicalRelease: string | null;
  file: FileDetail | null;
};

// Radarr rates a movie on several sites; the first one with a score wins.
const rating = (ratings: unknown): number | null => {
  if (!isRecord(ratings)) return null;
  for (const key of ['tmdb', 'imdb', 'trakt']) {
    const entry = ratings[key];
    const value = isRecord(entry) ? finiteNumber(entry.value) : null;
    if (value !== null && value > 0) return value;
  }
  return null;
};

export const parseMovie = (value: unknown): Movie | null => {
  if (!isRecord(value)) return null;
  return {
    id: positiveInteger(value.id),
    title: text(value.title) ?? '',
    year: finiteNumber(value.year),
    status: text(value.status),
    overview: text(value.overview),
    images: parseImages(value.images),
    rating: rating(value.ratings),
    certification: text(value.certification),
    genres: stringList(value.genres),
    runtime: finiteNumber(value.runtime),
    studio: text(value.studio),
    collection: isRecord(value.collection) ? text(value.collection.title) : null,
    path: text(value.path),
    tags: idList(value.tags),
    imdbId: text(value.imdbId),
    tmdbId: positiveInteger(value.tmdbId),
    monitored: value.monitored === true,
    hasFile: value.hasFile === true,
    isAvailable: value.isAvailable === true,
    minimumAvailability: text(value.minimumAvailability),
    qualityProfileId: positiveInteger(value.qualityProfileId),
    added: text(value.added),
    lastSearchTime: text(value.lastSearchTime),
    sizeOnDisk: count(value.sizeOnDisk),
    inCinemas: text(value.inCinemas),
    digitalRelease: text(value.digitalRelease),
    physicalRelease: text(value.physicalRelease),
    file: parseFile(value.movieFile),
  };
};

const done = (answer: Result<unknown>): Result<void> => (answer.kind === 'ok' ? { kind: 'ok', value: undefined } : answer);

export const createMovies = ({ label, send }: { label: string; send: Send }) => {
  const list = async (operation: string, path: string): Promise<Result<Movie[]>> => {
    const answer = await send(operation, path);
    if (answer.kind !== 'ok') return answer;
    const { body } = answer.value;
    if (!Array.isArray(body)) return refusal(`${label} sent no list of records for ${operation}.`);
    return { kind: 'ok', value: body.flatMap((item) => parseMovie(item) ?? []) };
  };

  const listMovies = () => list('the movie list', '/api/v3/movie');

  const movie = async (movieId: number): Promise<Result<Movie>> => {
    const operation = 'the movie read';
    const answer = await send(operation, `/api/v3/movie/${movieId}`);
    if (answer.kind !== 'ok') return answer;
    const parsed = parseMovie(answer.value.body);
    return parsed === null ? refusal(`${label} sent no record for ${operation}.`) : { kind: 'ok', value: parsed };
  };

  const lookupMovies = (term: string) => list('the movie lookup', `/api/v3/movie/lookup?term=${encodeURIComponent(term)}`);

  // The add body must be the lookup's own record: Radarr takes the title and images from it.
  const addMovie = async (tmdbId: number, fields: Record<string, unknown>): Promise<Result<{ id: number }>> => {
    const operation = 'the movie add';
    const found = await send(operation, `/api/v3/movie/lookup?term=${encodeURIComponent(`tmdb:${tmdbId}`)}`);
    if (found.kind !== 'ok') return found;
    if (!Array.isArray(found.value.body)) return refusal(`${label} sent no list of records for ${operation}.`);
    const match = found.value.body.find((item) => isRecord(item) && item.tmdbId === tmdbId);
    if (match === undefined) return { kind: 'not_found', message: `${label} has no such item for ${operation}.` };
    const added = await send(operation, '/api/v3/movie', { method: 'POST', body: { ...match, ...fields } });
    if (added.kind !== 'ok') return added;
    const id = isRecord(added.value.body) ? positiveInteger(added.value.body.id) : null;
    return id === null ? refusal(`${label} sent no id for ${operation}.`) : { kind: 'ok', value: { id } };
  };

  const monitorMovie = async (movieId: number, monitored: boolean): Promise<Result<void>> => done(
    await send('the movie monitor change', '/api/v3/movie/editor', { method: 'PUT', body: { movieIds: [movieId], monitored } }),
  );

  // The raw record goes back to Radarr whole, so fields this app does not parse survive the PUT.
  const setTag = async (movieId: number, tagId: number, tagged: boolean): Promise<Result<void>> => {
    const operation = 'the tag change';
    const answer = await send(operation, `/api/v3/movie/${movieId}`);
    if (answer.kind !== 'ok') return answer;
    const record = answer.value.body;
    if (!isRecord(record)) return refusal(`${label} sent no record for ${operation}.`);
    const tags = idList(record.tags);
    if (tags.includes(tagId) === tagged) return { kind: 'ok', value: undefined };
    const body = { ...record, tags: tagged ? [...tags, tagId] : tags.filter((id) => id !== tagId) };
    return done(await send(operation, `/api/v3/movie/${movieId}`, { method: 'PUT', body }));
  };

  return { listMovies, movie, lookupMovies, addMovie, monitorMovie, setTag };
};
