import { RotateCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { HeaderBackdrop } from '@/components/ui/header-title';
import { Arrival } from '../Arrival';
import { Skeleton, SkeletonRow } from '@/components/ui/skeleton';
import { buildRows } from '../downloads/model';
import type { DownloadsState } from '../downloads/useDownloads';
import { getJson, type MovieDetail, type OwnedMovieDetail, type SeriesDetail } from '../library/api';
import { subjectProgress, type SubjectProgress } from '../library/progress';
import { passedPosterUrl, preloadImages, replace, useLocation, useScreenReady } from '../navigation';
import { AddControls } from './AddControls';
import { MovieOverview } from './MovieOverview';
import { SeriesOverview } from './SeriesOverview';
import { TitleHeader } from './TitleHeader';

type Route =
  | { owned: true; type: 'tv' | 'movie'; id: number }
  | { owned: false; type: 'tv' | 'movie'; id: number }
  | { owned: false; type: 'tv'; id: number; byTmdb: true };

type ProtectedItem = { service: 'radarr'; kind: 'movie'; movieId: number } | { service: 'sonarr'; kind: 'episode'; episodeId: number };

type Load =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string }
  | { kind: 'series'; detail: SeriesDetail; protectedIds: Set<number> }
  | { kind: 'movie'; detail: OwnedMovieDetail; protectedIds: Set<number> }
  | { kind: 'preview-tv'; detail: SeriesDetail }
  | { kind: 'preview-movie'; detail: MovieDetail };

const noProgress = new Map<string, SubjectProgress>();

const parseRoute = (pathname: string): Route | undefined => {
  const [, first, second, third] = pathname.split('/');
  if (first === 'series' || first === 'movie') {
    const id = Number(second);
    return Number.isInteger(id) && id > 0 ? { owned: true, type: first === 'series' ? 'tv' : 'movie', id } : undefined;
  }
  if (first === 'title' && second === 'tmdb-tv') {
    const id = Number(third);
    return Number.isInteger(id) && id > 0 ? { owned: false, type: 'tv', id, byTmdb: true } : undefined;
  }
  if (first === 'title' && (second === 'tvdb' || second === 'tmdb')) {
    const id = Number(third);
    return Number.isInteger(id) && id > 0 ? { owned: false, type: second === 'tvdb' ? 'tv' : 'movie', id } : undefined;
  }
  return undefined;
};

const failureText = (service: string, error: unknown) => {
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
    <ul aria-label="Seasons" className="flex flex-wrap gap-2">
      {seasons.map((season) => (
        <li key={season.seasonNumber}>
          <Badge variant="outline">
            {[
              season.seasonNumber === 0 ? 'Specials' : `Season ${season.seasonNumber}`,
              previewSeasonState(detail, season.seasonNumber, last),
              season.statistics.totalEpisodeCount > 0 ? `${season.statistics.totalEpisodeCount} episodes` : '',
            ].filter((part) => part !== '').join(' · ')}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export function Overview({ downloads, onUnauthenticated }: { downloads: DownloadsState; onUnauthenticated: () => void }) {
  const { pathname, state: historyState } = useLocation();
  const passedPoster = passedPosterUrl(historyState);
  const route = useMemo(() => parseRoute(pathname), [pathname]);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

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
        const path = 'byTmdb' in route
          ? `/api/library/preview/sonarr/tmdb/${route.id}`
          : `/api/library/preview/${route.type === 'tv' ? 'sonarr' : 'radarr'}/${route.id}`;
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
      const [detail, items] = await Promise.all([getJson<OwnedMovieDetail>(`/api/library/movie/${route.id}`, onUnauthenticated, controller.signal), protectedRead]);
      return { kind: 'movie', detail, protectedIds: new Set(items.flatMap((item) => (item.kind === 'movie' ? [item.movieId] : []))) };
    };
    read()
      // razor: waits at most 300 ms for the header's poster, so the page usually arrives with it drawn. The backdrop is not
      // waited for: the band behind the header shows a blurred poster until it settles in.
      .then(async (loaded) => {
        if ('detail' in loaded) await preloadImages([loaded.detail.posterUrl], 300);
        return loaded;
      })
      .then((loaded) => {
        if (!controller.signal.aborted) setLoad(loaded);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const reason = error instanceof Error ? error.message : '';
        // A preview by TMDB id fails the same ways whether TMDB or Sonarr failed, so the message names both.
        const message = 'byTmdb' in route && reason === 'not_found' ? "TMDB has no TVDB id for this show, so Sonarr can't look it up."
          : failureText('byTmdb' in route ? 'TMDB or Sonarr' : service, error);
        setLoad({ kind: 'failed', message });
      });
    return () => controller.abort();
  }, [route, onUnauthenticated, attempt]);

  const snapshot = downloads.kind === 'ready' ? downloads.snapshot : undefined;
  const rows = useMemo(() => (snapshot === undefined ? [] : buildRows(snapshot)), [snapshot]);
  const progress = useMemo(() => (snapshot === undefined ? noProgress : subjectProgress(snapshot, rows)), [snapshot, rows]);

  const onAdded = (libraryId: number) => replace(`/${route?.type === 'tv' ? 'series' : 'movie'}/${libraryId}`);

  const service = route?.type === 'movie' ? 'Radarr' : 'Sonarr';
  // The screen change holds the previous screen until the page and its poster are in, so it usually arrives drawn.
  useScreenReady(load.kind !== 'loading');

  return (
    <Arrival
      ready={load.kind !== 'loading'}
      skeleton={(
        // The poster sits where the loaded header puts it, under the app bar, so nothing jumps when the page arrives.
        <div role="status" aria-label="Loading" className="relative -mt-(--topbar) flex flex-col gap-8 pt-[calc(var(--topbar)+100px)] pb-10">
          {/* The header is the app bar plus 447 px: 100 above the poster, the 315 px poster, 32 below; the band runs 15 % past it. */}
          <HeaderBackdrop posterUrl={passedPoster} tall className="-inset-x-(--page-margin) h-[calc((var(--topbar)+447px)*1.15)]" />
          <div className="relative flex gap-8">
            {passedPoster === undefined
              ? <Skeleton className="title-poster h-78.75 w-52.5 rounded-md" />
              : (
                <div className="title-poster relative h-78.75 w-52.5 shrink-0 overflow-hidden rounded-md bg-muted">
                  <img src={passedPoster} alt="" className="size-full object-cover" />
                </div>
              )}
            <div className="flex flex-col gap-3.5 pt-40">
              <Skeleton className="h-9 w-90" />
              <Skeleton className="w-130" />
              <Skeleton className="w-75" />
            </div>
          </div>
          <div className="relative flex flex-col">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </div>
      )}
    >
      {load.kind === 'failed' && (
        <div className="pt-8 pb-10">
          <Callout
            className="max-w-130"
            title={load.message}
            action={route === undefined ? undefined : <Button variant="outline" icon={<RotateCw />} onClick={() => setAttempt((count) => count + 1)}>Try again</Button>}
          >
            {route === undefined ? undefined : `This page reads the ${route.type === 'tv' ? 'show' : 'movie'} from ${service}. If it keeps failing, Health shows what is wrong.`}
          </Callout>
        </div>
      )}
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
        <MovieOverview detail={load.detail} downloads={downloads} progress={progress} onUnauthenticated={onUnauthenticated} />
      )}
      {(load.kind === 'preview-tv' || load.kind === 'preview-movie') && (
        <TitleHeader
          subject={load.kind === 'preview-tv' ? { type: 'tv', detail: load.detail } : { type: 'movie', detail: load.detail }}
          owned={false}
          badges={<Badge>Not in library</Badge>}
          facts={[
            { label: 'Monitoring', value: 'Not monitored' },
            { label: load.kind === 'preview-tv' ? 'New seasons' : 'Available when', value: 'Chosen when adding' },
            { label: 'Quality profile', value: 'Chosen when adding' },
          ]}
          add={load.kind === 'preview-tv' ? <PreviewSeasons detail={load.detail} /> : undefined}
          addAction={(
            <AddControls
              subject={load.kind === 'preview-tv' ? { type: 'tv', detail: load.detail } : { type: 'movie', detail: load.detail }}
              onAdded={onAdded}
              onUnauthenticated={onUnauthenticated}
            />
          )}
          onUnauthenticated={onUnauthenticated}
        />
      )}
    </Arrival>
  );
}
