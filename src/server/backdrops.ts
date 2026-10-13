import type { DatabaseSync } from 'node:sqlite';
import { getPreference } from './preferences.js';
import type { Result } from './services/arr/result.js';
import type { Fanart } from './services/fanart.js';
import type { Trakt } from './services/trakt.js';
import type { Title, TitleStore } from './titleStore.js';
import type { TmdbTitles } from './tmdbTitles.js';

const MAX_AGE_MS = 7 * 24 * 60 * 60_000;
export const BACKDROP_SOURCES = ['tmdb', 'trakt', 'fanart'] as const;
export const BACKDROP_SOURCE_KEY = 'backdrop.source';

// Which source the title page backdrop comes from is the owner's choice while comparing them; TMDB unless set.
// razor: Trakt and fanart.tv pictures are linked straight from their servers for the comparison. Copy them through
// /api/images like TMDB's if one becomes the source for good; Trakt's terms ask for copies.
export const createBackdrops = (options: {
  database: DatabaseSync;
  store: TitleStore;
  tmdbTitles: Pick<TmdbTitles, 'backdropPath'>;
  trakt: Pick<Trakt, 'fanart'>;
  fanart: Pick<Fanart, 'background'>;
}) => {
  const { database, store, tmdbTitles, trakt, fanart } = options;

  // Answers from the saved copy; a missing or old one loads in the background, so the page never waits on the source.
  const saved = (title: Title, part: string, load: () => Promise<Result<string | null>>) => {
    void store.fetch(title, part, MAX_AGE_MS, async () => {
      const result = await load();
      return result.kind === 'ok' ? { kind: 'ok' as const, value: { url: result.value } } : result;
    }).catch(() => undefined);
    return store.get<{ url: string | null }>(title, part)?.value.url ?? null;
  };

  // Null means the chosen source has no picture, so the page keeps the Sonarr or Radarr fanart.
  return async (type: 'tv' | 'movie', ids: { tmdbId: number | null; tvdbId: number | null }): Promise<string | null> => {
    const { tmdbId, tvdbId } = ids;
    const source = getPreference(database, BACKDROP_SOURCE_KEY);
    const title: Title | undefined = type === 'movie'
      ? (tmdbId === null ? undefined : { type, tmdbId })
      : (tvdbId === null ? undefined : { type, tvdbId, tmdbId });
    if (source === 'trakt') return title === undefined || tmdbId === null ? null : saved(title, 'traktBackdrop', () => trakt.fanart(type, tmdbId));
    if (source === 'fanart') {
      const id = type === 'movie' ? tmdbId : tvdbId;
      return title === undefined || id === null ? null : saved(title, 'fanartBackdrop', () => fanart.background(type, id));
    }
    const path = tmdbId === null ? null : await tmdbTitles.backdropPath(type, tmdbId);
    return path === null ? null : `/api/images/tmdb/w1920_and_h800_multi_faces/${path.replace(/^\//, '')}`;
  };
};
