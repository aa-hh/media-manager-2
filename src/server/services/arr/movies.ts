import { count, type FileDetail, finiteNumber, idList, type Image, otherTitles, parseFile, parseImages, positiveInteger, records, stringList, text } from './files.js';
import { isRecord, refusal, type Result, type Send } from './result.js';

const RATING_SITES = ['imdb', 'tmdb', 'metacritic', 'rottenTomatoes', 'trakt'] as const;
export type Ratings = Record<(typeof RATING_SITES)[number], { value: number; votes: number } | null>;

export type Movie = {
  id: number | null;
  title: string;
  originalTitle: string | null;
  originalLanguage: string | null;
  alternateTitles: string[];
  year: number | null;
  status: string | null;
  overview: string | null;
  images: Image[];
  rating: number | null;
  ratings: Ratings;
  keywords: string[];
  youTubeTrailerId: string | null;
  website: string | null;
  certification: string | null;
  genres: string[];
  runtime: number | null;
  studio: string | null;
  collection: string | null;
  collectionTmdbId: number | null;
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
  releaseDate: string | null;
  releaseGroups: string[];
  file: FileDetail | null;
};

export type Credit = {
  type: 'cast' | 'crew';
  name: string;
  character: string | null;
  job: string | null;
  department: string | null;
  order: number | null;
  tmdbId: number | null;
  images: Image[];
};

// Radarr sends a zero score for a site with no rating, so only a positive score counts.
const siteRatings = (value: unknown): Ratings => {
  const ratings = isRecord(value) ? value : {};
  const entries = RATING_SITES.map((site) => {
    const entry = isRecord(ratings[site]) ? ratings[site] : {};
    const score = finiteNumber(entry.value);
    return [site, score !== null && score > 0 ? { value: score, votes: count(entry.votes) } : null];
  });
  return Object.fromEntries(entries) as Ratings;
};

export const parseMovie = (value: unknown): Movie | null => {
  if (!isRecord(value)) return null;
  const title = text(value.title) ?? '';
  const ratings = siteRatings(value.ratings);
  return {
    id: positiveInteger(value.id),
    title,
    originalTitle: text(value.originalTitle),
    originalLanguage: isRecord(value.originalLanguage) ? text(value.originalLanguage.name) : null,
    alternateTitles: otherTitles(value.alternateTitles, title),
    year: finiteNumber(value.year),
    status: text(value.status),
    overview: text(value.overview),
    images: parseImages(value.images),
    // The single rating the client still reads: the first of these sites with a score.
    rating: ratings.tmdb?.value ?? ratings.imdb?.value ?? ratings.trakt?.value ?? null,
    ratings,
    keywords: stringList(value.keywords),
    youTubeTrailerId: text(value.youTubeTrailerId),
    website: text(value.website),
    certification: text(value.certification),
    genres: stringList(value.genres),
    runtime: finiteNumber(value.runtime),
    studio: text(value.studio),
    collection: isRecord(value.collection) ? text(value.collection.title) : null,
    collectionTmdbId: isRecord(value.collection) ? positiveInteger(value.collection.tmdbId) : null,
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
    releaseDate: text(value.releaseDate),
    releaseGroups: isRecord(value.statistics) ? stringList(value.statistics.releaseGroups) : [],
    file: parseFile(value.movieFile),
  };
};

const parseCredit = (value: Record<string, unknown>): Credit[] => {
  const name = text(value.personName);
  const type = text(value.type)?.toLowerCase();
  if (name === null || (type !== 'cast' && type !== 'crew')) return [];
  return [{
    type,
    name,
    character: text(value.character),
    job: text(value.job),
    department: text(value.department),
    order: finiteNumber(value.order),
    tmdbId: positiveInteger(value.personTmdbId),
    images: parseImages(value.images),
  }];
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

  // Whole records, not parsed ones: an add posts the lookup's own record back, so unparsed fields must survive.
  const lookupMovies = async (term: string): Promise<Result<Record<string, unknown>[]>> => {
    const operation = 'the movie lookup';
    const answer = await send(operation, `/api/v3/movie/lookup?term=${encodeURIComponent(term)}`);
    if (answer.kind !== 'ok') return answer;
    const { body } = answer.value;
    return Array.isArray(body) ? { kind: 'ok', value: body.filter(isRecord) } : refusal(`${label} sent no list of records for ${operation}.`);
  };

  // The add body must be the lookup's own record: Radarr takes the title and images from it.
  const addMovie = async (record: Record<string, unknown>, fields: Record<string, unknown>): Promise<Result<{ id: number }>> => {
    const operation = 'the movie add';
    const added = await send(operation, '/api/v3/movie', { method: 'POST', body: { ...record, ...fields } });
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

  const credits = async (movieId: number): Promise<Result<Credit[]>> => {
    const operation = 'the credit list';
    const answer = await send(operation, `/api/v3/credit?movieId=${movieId}`);
    if (answer.kind !== 'ok') return answer;
    const { body } = answer.value;
    if (!Array.isArray(body)) return refusal(`${label} sent no list of records for ${operation}.`);
    return { kind: 'ok', value: records(body).flatMap(parseCredit) };
  };

  // Radarr deletes the files in the background after it answers. An exclusion is added only when the owner asks for one.
  const deleteMovie = async (movieId: number, excludeFromImportLists = false): Promise<Result<void>> => done(
    await send('the movie delete', `/api/v3/movie/${movieId}?deleteFiles=true&addImportExclusion=${excludeFromImportLists}`, { method: 'DELETE' }),
  );

  const deleteMovieFile = async (fileId: number): Promise<Result<void>> => done(
    await send('the movie file delete', `/api/v3/moviefile/${fileId}`, { method: 'DELETE' }),
  );

  return { listMovies, movie, lookupMovies, addMovie, monitorMovie, setTag, credits, deleteMovie, deleteMovieFile };
};
