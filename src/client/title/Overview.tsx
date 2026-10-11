import { useEffect, useMemo, useState } from 'react';
import { buildRows } from '../downloads/model';
import type { DownloadsState } from '../downloads/useDownloads';
import { getJson, type MovieDetail, type SeriesDetail } from '../library/api';
import { subjectProgress, type SubjectProgress } from '../library/progress';
import { replace, useLocation } from '../navigation';
import { AddControls } from './AddControls';
import { SeriesOverview } from './SeriesOverview';
import { TitleHeader } from './TitleHeader';

type Route =
  | { owned: true; type: 'tv' | 'movie'; id: number }
  | { owned: false; type: 'tv' | 'movie'; id: number };

type ProtectedItem = { service: 'radarr'; kind: 'movie'; movieId: number } | { service: 'sonarr'; kind: 'episode'; episodeId: number };

type Load =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string }
  | { kind: 'series'; detail: SeriesDetail; protectedIds: Set<number> }
  | { kind: 'movie'; detail: MovieDetail; protectedIds: Set<number> }
  | { kind: 'preview-tv'; detail: SeriesDetail }
  | { kind: 'preview-movie'; detail: MovieDetail };

const noProgress = new Map<string, SubjectProgress>();

const parseRoute = (pathname: string): Route | undefined => {
  const [, first, second, third] = pathname.split('/');
  if (first === 'series' || first === 'movie') {
    const id = Number(second);
    return Number.isInteger(id) && id > 0 ? { owned: true, type: first === 'series' ? 'tv' : 'movie', id } : undefined;
  }
  if (first === 'title' && (second === 'tvdb' || second === 'tmdb')) {
    const id = Number(third);
    return Number.isInteger(id) && id > 0 ? { owned: false, type: second === 'tvdb' ? 'tv' : 'movie', id } : undefined;
  }
  return undefined;
};

const failureText = (service: 'Sonarr' | 'Radarr', error: unknown) => {
  const reason = error instanceof Error ? error.message : '';
  if (reason === 'not_configured') return `${service} isn't connected yet.`;
  if (reason === 'rejected') return `${service} refused the API key.`;
  if (reason === 'not_found') return `${service} doesn't know this title.`;
  return `${service} didn't answer.`;
};

// Season chips before adding: Sonarr's lookup has season numbers but no episode dates, so the state comes from the show's status.
const previewSeasonState = (detail: SeriesDetail, seasonNumber: number, last: number) => {
  if (detail.status === 'upcoming') return 'Upcoming';
  if (detail.status === 'continuing' && seasonNumber === last) return 'Airing';
  return 'Aired';
};

function PreviewSeasons({ detail }: { detail: SeriesDetail }) {
  const seasons = [...detail.seasons].sort((a, b) => b.seasonNumber - a.seasonNumber);
  const last = Math.max(0, ...seasons.map((season) => season.seasonNumber));
  if (seasons.length === 0) return null;
  return (
    <ul aria-label="Seasons" className="mt-6 flex flex-wrap gap-2 font-data text-[13px]">
      {seasons.map((season) => (
        <li key={season.seasonNumber} className="flex items-center gap-2 border border-[var(--mm-seam)] bg-[var(--mm-row)] px-2.5 py-1">
          <span className="text-[var(--mm-ink)]">{season.seasonNumber === 0 ? 'Specials' : `Season ${season.seasonNumber}`}</span>
          <span className="text-[var(--mm-ink-2)]">{previewSeasonState(detail, season.seasonNumber, last)}</span>
          {season.statistics.totalEpisodeCount > 0 && (
            <span className="text-[var(--mm-ink-2)]">{season.statistics.totalEpisodeCount} episodes</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Overview({ downloads, onUnauthenticated }: { downloads: DownloadsState; onUnauthenticated: () => void }) {
  const { pathname } = useLocation();
  const route = useMemo(() => parseRoute(pathname), [pathname]);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });

  useEffect(() => {
    if (route === undefined) {
      setLoad({ kind: 'failed', message: 'This address names no show or movie.' });
      return;
    }
    const service = route.type === 'tv' ? 'Sonarr' : 'Radarr';
    setLoad({ kind: 'loading' });
    const controller = new AbortController();
    const read = async (): Promise<Load> => {
      if (!route.owned) {
        const path = `/api/library/preview/${route.type === 'tv' ? 'sonarr' : 'radarr'}/${route.id}`;
        return route.type === 'tv'
          ? { kind: 'preview-tv', detail: await getJson<SeriesDetail>(path, onUnauthenticated, controller.signal) }
          : { kind: 'preview-movie', detail: await getJson<MovieDetail>(path, onUnauthenticated, controller.signal) };
      }
      // Protection marks manual downloads; a failed read only drops that word from the rows.
      const protectedRead = getJson<{ items: ProtectedItem[] }>('/api/protected', onUnauthenticated, controller.signal)
        .then((body) => body.items)
        .catch((): ProtectedItem[] => []);
      if (route.type === 'tv') {
        const [detail, items] = await Promise.all([getJson<SeriesDetail>(`/api/library/series/${route.id}`, onUnauthenticated, controller.signal), protectedRead]);
        return { kind: 'series', detail, protectedIds: new Set(items.flatMap((item) => (item.kind === 'episode' ? [item.episodeId] : []))) };
      }
      const [detail, items] = await Promise.all([getJson<MovieDetail>(`/api/library/movie/${route.id}`, onUnauthenticated, controller.signal), protectedRead]);
      return { kind: 'movie', detail, protectedIds: new Set(items.flatMap((item) => (item.kind === 'movie' ? [item.movieId] : []))) };
    };
    read()
      .then((loaded) => {
        if (!controller.signal.aborted) setLoad(loaded);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoad({ kind: 'failed', message: failureText(service, error) });
      });
    return () => controller.abort();
  }, [route, onUnauthenticated]);

  const snapshot = downloads.kind === 'ready' ? downloads.snapshot : undefined;
  const rows = useMemo(() => (snapshot === undefined ? [] : buildRows(snapshot)), [snapshot]);
  const progress = useMemo(() => (snapshot === undefined ? noProgress : subjectProgress(snapshot, rows)), [snapshot, rows]);

  const onAdded = (libraryId: number) => replace(`/${route?.type === 'tv' ? 'series' : 'movie'}/${libraryId}`);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[var(--mm-ground)] px-4 pb-16 pt-6 text-[var(--mm-ink)] sm:px-6">
      {load.kind === 'loading' && <p className="font-ui text-[14px] text-[var(--mm-ink-2)]">Loading…</p>}
      {load.kind === 'failed' && <p role="alert" className="font-ui text-[14px] text-[var(--mm-risk)]">{load.message}</p>}
      {load.kind === 'series' && (
        <SeriesOverview
          detail={load.detail}
          protectedIds={load.protectedIds}
          downloads={downloads}
          progress={progress}
          onUnauthenticated={onUnauthenticated}
        />
      )}
      {load.kind === 'movie' && (
        <TitleHeader subject={{ type: 'movie', detail: load.detail }} owned onUnauthenticated={onUnauthenticated} />
      )}
      {(load.kind === 'preview-tv' || load.kind === 'preview-movie') && (
        <>
          <TitleHeader
            subject={load.kind === 'preview-tv' ? { type: 'tv', detail: load.detail } : { type: 'movie', detail: load.detail }}
            owned={false}
            onUnauthenticated={onUnauthenticated}
          />
          {load.kind === 'preview-tv' && <PreviewSeasons detail={load.detail} />}
          {/* Add controls keep their light styling, so they sit on a light surface. */}
          <div className="mt-6 max-w-3xl rounded bg-[var(--control)] p-5 text-[var(--ink)]">
            <AddControls
              result={load.kind === 'preview-tv'
                ? { type: 'tv', tvdbId: load.detail.links.tvdbId, tmdbId: load.detail.links.tmdbId }
                : { type: 'movie', tvdbId: null, tmdbId: load.detail.links.tmdbId }}
              onAdded={onAdded}
              onUnauthenticated={onUnauthenticated}
            />
          </div>
        </>
      )}
    </div>
  );
}
