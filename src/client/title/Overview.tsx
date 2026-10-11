import { useEffect, useState } from 'react';
import type { DownloadsState } from '../downloads/useDownloads';
import { getJson, type MovieDetail, type SeriesDetail } from '../library/api';
import { replace, useLocation } from '../navigation';
import type { SearchResult } from '../Search';
import { TitleView } from '../Title';

type Resolved = { kind: 'loading' } | { kind: 'failed'; service: 'Sonarr' | 'Radarr' } | { kind: 'ready'; result: SearchResult };

const isResult = (value: unknown): value is SearchResult =>
  typeof value === 'object' && value !== null && 'key' in value && 'libraryId' in value && 'inLibrary' in value;

const fromSeries = (detail: SeriesDetail): SearchResult => ({
  type: 'tv', service: 'sonarr', key: `tvdb:${detail.links.tvdbId}`, title: detail.title, year: detail.year, network: detail.network,
  status: detail.status, rating: detail.rating, overview: detail.overview, posterUrl: detail.posterUrl, inLibrary: true, libraryId: detail.id,
  tvdbId: detail.links.tvdbId, tmdbId: detail.links.tmdbId, imdbId: detail.links.imdbId,
});

const fromMovie = (detail: MovieDetail): SearchResult => ({
  type: 'movie', service: 'radarr', key: `tmdb:${detail.links.tmdbId}`, title: detail.title, year: detail.year, network: detail.studio,
  status: detail.status, rating: detail.rating, overview: detail.overview, posterUrl: detail.posterUrl, inLibrary: true, libraryId: detail.id,
  tvdbId: null, tmdbId: detail.links.tmdbId, imdbId: detail.links.imdbId,
});

export function Overview({ onUnauthenticated }: { downloads: DownloadsState; onUnauthenticated: () => void }) {
  const { pathname, state } = useLocation();
  const [resolved, setResolved] = useState<Resolved>({ kind: 'loading' });

  useEffect(() => {
    const [, kind, second, third] = pathname.split('/');
    const owned = kind === 'series' || kind === 'movie';
    const id = Number(owned ? second : third);
    const service = kind === 'series' || second === 'tvdb' ? 'Sonarr' : 'Radarr';
    const matches = (result: SearchResult) => (owned ? result.inLibrary && result.libraryId === id : result.key === `${second}:${id}`);
    if (isResult(state) && matches(state)) {
      setResolved({ kind: 'ready', result: state });
      return;
    }
    setResolved({ kind: 'loading' });
    const controller = new AbortController();
    const load = async (): Promise<SearchResult | undefined> => {
      if (kind === 'series') return fromSeries(await getJson<SeriesDetail>(`/api/library/series/${id}`, onUnauthenticated, controller.signal));
      if (kind === 'movie') return fromMovie(await getJson<MovieDetail>(`/api/library/movie/${id}`, onUnauthenticated, controller.signal));
      const found = await getJson<{ results: SearchResult[] }>(`/api/search?q=${second}:${id}`, onUnauthenticated, controller.signal);
      return found.results.find(matches);
    };
    load()
      .then((result) => {
        if (!controller.signal.aborted) setResolved(result === undefined ? { kind: 'failed', service } : { kind: 'ready', result });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResolved({ kind: 'failed', service });
      });
    return () => controller.abort();
  }, [pathname, state, onUnauthenticated]);

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      {resolved.kind === 'loading' && <p className="px-4 pt-6 sm:px-6">Loading…</p>}
      {resolved.kind === 'failed' && (
        <div className="min-h-[calc(100vh-3.5rem)] bg-[var(--mm-ground)] px-4 pt-6 sm:px-6">
          <p role="alert" className="font-ui text-[14px] text-[var(--mm-risk)]">{resolved.service} didn't answer.</p>
        </div>
      )}
      {resolved.kind === 'ready' && (
        <TitleView
          result={resolved.result}
          onBack={() => history.back()}
          onAdded={(libraryId) => replace(`/${resolved.result.type === 'tv' ? 'series' : 'movie'}/${libraryId}`)}
          onUnauthenticated={onUnauthenticated}
        />
      )}
    </div>
  );
}
