import { BookmarkX, Library as LibraryIcon } from 'lucide-react';
import { memo, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuTrigger,
  SelectContent,
  SelectItem,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { HeaderPage } from '@/components/ui/header-page';
import { LibraryPosterCard } from '@/components/ui/library-poster-card';
import { LineTotals } from '@/components/ui/line-totals';
import { Select, SelectTrigger } from '@/components/ui/select-trigger';
import { SkeletonPosterCard } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { buildRows, formatBytes } from '../downloads/model';
import type { DownloadsState } from '../downloads/useDownloads';
import { Arrival } from '../Arrival';
import { navigateFrom, useScreenReady } from '../navigation';
import { getJson, type LibraryTitle, type Outcome } from './api';
import { FIELDS, missingCount, movieWord, progressText, readFields, totals, writeFields, type Field } from './grid';
import { downloadingByShow, subjectProgress, type SubjectProgress } from './progress';

type Loaded = { titles: LibraryTitle[]; services: { sonarr: Outcome; radarr: Outcome } };
type LoadState = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; data: Loaded };
type Show = 'all' | 'tv' | 'movie';

const fieldLabels: Record<Field, string> = { year: 'Year', progress: 'Progress', size: 'Size', profile: 'Quality profile', added: 'Date added' };
const showLabels: Array<[Show, string]> = [['all', 'All'], ['movie', 'Movies'], ['tv', 'TV']];
const noProgress = new Map<string, SubjectProgress>();
const noTitles: LibraryTitle[] = [];
const SKELETON_CARDS = 8;

const serviceProblem = (name: 'Sonarr' | 'Radarr', outcome: Outcome) => {
  const missing = name === 'Sonarr' ? 'shows are' : 'movies are';
  if (outcome.kind === 'not_configured') return `${name} isn't connected yet, so ${missing} missing.`;
  if (outcome.kind === 'rejected') return `${name} refused the API key, so ${missing} missing.`;
  if (outcome.kind === 'unreachable') return `${name} didn't answer, so ${missing} missing.`;
  return undefined;
};

const addedOn = (added: string | null) => {
  const time = added === null ? Number.NaN : Date.parse(added);
  return Number.isNaN(time) ? '' : new Date(time).toLocaleDateString();
};

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const openLink = (path: string) => (event: MouseEvent<HTMLAnchorElement>) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
  event.preventDefault();
  navigateFrom(path, event.currentTarget);
};

// One badge per card: live progress, then deleted, then not monitored, then what is missing or not out yet.
function statusBadge(title: LibraryTitle, live: SubjectProgress | undefined, downloading: number): ReactNode {
  const word = title.tv === null ? movieWord(title, live) : null;
  if (downloading > 0) return <Badge variant="live">{downloading} downloading</Badge>;
  if (word === 'deleted') return <Badge variant="risk">Deleted</Badge>;
  if (live !== undefined && word !== null) return <Badge variant={live.tone === 'risk' ? 'risk' : 'live'}>{capitalise(word)}</Badge>;
  if (!title.monitored) return <Badge icon={<BookmarkX aria-hidden="true" />}>Not monitored</Badge>;
  const missing = title.tv === null ? 0 : title.tv.episodeCount - title.tv.episodeFileCount - downloading;
  if (missing > 0) return <Badge variant="warning">Missing {missing} {missing === 1 ? 'episode' : 'episodes'}</Badge>;
  if (word === 'missing') return <Badge variant="warning">Missing</Badge>;
  if (word === 'not available') return <Badge variant="outline" className="bg-card">Not out yet</Badge>;
  return undefined;
}

type PosterCardProps = { title: LibraryTitle; fields: Field[]; live: SubjectProgress | undefined; downloading: number };

// Every snapshot builds fresh progress objects, so a card compares the values it prints rather than the object.
const sameLive = (a: SubjectProgress | undefined, b: SubjectProgress | undefined) =>
  a === b || (a !== undefined && b !== undefined && a.word === b.word && a.tone === b.tone && a.percent === b.percent);

const PosterCard = memo(function PosterCard({ title, fields, live, downloading }: PosterCardProps) {
  const meta = [
    fields.includes('year') && title.year !== null ? String(title.year) : '',
    title.tv !== null && fields.includes('progress') ? progressText(title.tv.episodeFileCount, downloading, title.tv.episodeCount) : '',
    fields.includes('size') ? formatBytes(title.sizeOnDisk) : '',
    fields.includes('profile') ? title.qualityProfile ?? '' : '',
    fields.includes('added') ? addedOn(title.added) : '',
  ].filter((fact) => fact !== '');
  const path = `/${title.tv === null ? 'movie' : 'series'}/${title.id}`;
  return (
    <li className="[contain-intrinsic-size:auto_var(--poster-width)_auto_372px] [content-visibility:auto]">
      <LibraryPosterCard
        href={path}
        onClick={openLink(path)}
        poster={title.posterUrl ?? undefined}
        title={title.title}
        meta={meta.length > 0 ? meta.join(' · ') : undefined}
        status={statusBadge(title, live, downloading)}
        progress={live?.percent ?? undefined}
      />
    </li>
  );
}, (prev, next) => prev.title === next.title && prev.fields === next.fields && prev.downloading === next.downloading && sameLive(prev.live, next.live));

export function Library({ downloads, onUnauthenticated }: { downloads: DownloadsState; onUnauthenticated: () => void }) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [show, setShow] = useState<Show>('all');
  const [fields, setFields] = useState<Field[]>(readFields);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: 'loading' });
    getJson<Loaded>('/api/library/titles', onUnauthenticated, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setState({ kind: 'ready', data }); })
      .catch(() => { if (!controller.signal.aborted) setState({ kind: 'failed' }); });
    return () => controller.abort();
  }, [attempt, onUnauthenticated]);
  useScreenReady(state.kind !== 'loading');

  const snapshot = downloads.kind === 'ready' ? downloads.snapshot : undefined;
  const progress = useMemo(
    () => (snapshot === undefined ? noProgress : subjectProgress(snapshot, buildRows(snapshot))),
    [snapshot],
  );
  const perShow = useMemo(
    () => (snapshot === undefined ? new Map<number, number>() : downloadingByShow(snapshot, progress)),
    [snapshot, progress],
  );

  const toggleField = (field: Field) => {
    const next = FIELDS.filter((candidate) => (candidate === field ? !fields.includes(candidate) : fields.includes(candidate)));
    setFields(next);
    writeFields(next);
  };

  const titles = state.kind === 'ready' ? state.data.titles : noTitles;
  const sum = useMemo(() => totals(titles), [titles]);
  const counts = useMemo((): Record<Show, number> => ({
    all: titles.length,
    movie: titles.filter((title) => title.type === 'movie').length,
    tv: titles.filter((title) => title.type === 'tv').length,
  }), [titles]);
  const shown = useMemo(() => titles.filter((title) => show === 'all' || title.type === show), [titles, show]);
  const missing = useMemo(() => missingCount(titles, progress, perShow), [titles, progress, perShow]);

  return (
    <div className="flex flex-col pb-6">
      <div className="flex flex-col gap-1">
        <HeaderPage title="Library" className="pb-0" />
        {state.kind === 'ready' && (
          <LineTotals
            totals={[
              { value: sum.shows.toLocaleString(), word: 'shows' },
              { value: sum.movies.toLocaleString(), word: 'movies' },
              { value: sum.episodes.toLocaleString(), word: 'episodes' },
              { value: sum.files.toLocaleString(), word: 'files' },
              { value: formatBytes(sum.sizeBytes) },
            ]}
            link={missing > 0 ? { label: `${missing.toLocaleString()} ${missing === 1 ? 'title' : 'titles'} missing files`, href: '/flagged', onClick: openLink('/flagged') } : undefined}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-4 pb-5">
        <ToggleGroup aria-label="Show" value={show} onValueChange={(value) => setShow(value as Show)}>
          {showLabels.map(([value, label]) => (
            <ToggleGroupItem key={value} value={value} count={state.kind === 'ready' ? counts[value] : undefined}>{label}</ToggleGroupItem>
          ))}
        </ToggleGroup>
        <span className="flex-1" />
        <Select value="added">
          <SelectTrigger lead="Sort">Date added, newest first</SelectTrigger>
          <SelectContent>
            <SelectItem value="added">Date added, newest first</SelectItem>
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="menu">Poster fields</Button>} />
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuGroupLabel>Poster fields</DropdownMenuGroupLabel>
              {FIELDS.map((field) => (
                <DropdownMenuCheckboxItem key={field} checked={fields.includes(field)} onCheckedChange={() => toggleField(field)}>
                  {fieldLabels[field]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Arrival
        ready={state.kind !== 'loading'}
        skeleton={(
          <div className="grid grid-cols-[repeat(auto-fill,var(--poster-width))] justify-between gap-x-(--poster-gutter) gap-y-8">
            {Array.from({ length: SKELETON_CARDS }, (_, index) => <SkeletonPosterCard key={index} />)}
          </div>
        )}
      >
        {state.kind === 'failed' && (
          <Callout
            className="max-w-130"
            title="The library could not be read."
            action={<Button variant="outline" onClick={() => setAttempt((count) => count + 1)}>Retry</Button>}
          />
        )}
        {state.kind === 'ready' && (() => {
          const { services } = state.data;
          const problems = [serviceProblem('Sonarr', services.sonarr), serviceProblem('Radarr', services.radarr)].filter((line) => line !== undefined);
          return (
            <>
              {problems.length > 0 && (
                <div className="flex flex-col gap-2 pb-6">
                  {problems.map((line) => <Callout key={line} look="warning" title={line} className="max-w-130" />)}
                </div>
              )}
              {shown.length === 0
                ? (
                  <div className="flex justify-center pt-24">
                    <EmptyState
                      icon={<LibraryIcon aria-hidden="true" />}
                      title="Nothing here yet"
                      action={(
                        <Button
                          variant="outline"
                          kbd="/"
                          onClick={() => document.querySelector<HTMLInputElement>('[role="search"] input')?.focus()}
                        >
                          Search
                        </Button>
                      )}
                    >
                      Add a show or movie from search.
                    </EmptyState>
                  </div>
                )
                : (
                  <ul className="grid grid-cols-[repeat(auto-fill,var(--poster-width))] justify-between gap-x-(--poster-gutter) gap-y-8">
                    {shown.map((title) => (
                      <PosterCard
                        key={`${title.service}:${title.id}`}
                        title={title}
                        fields={fields}
                        live={title.tv === null ? progress.get(`movie:${title.id}`) : undefined}
                        downloading={perShow.get(title.id) ?? 0}
                      />
                    ))}
                  </ul>
                )}
            </>
          );
        })()}
      </Arrival>
    </div>
  );
}
