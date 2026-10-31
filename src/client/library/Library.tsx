import { BookmarkX, Library as LibraryIcon } from 'lucide-react';
import { memo, use, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs-trigger';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { buildRows, formatBytes } from '../downloads/model';
import type { DownloadsState } from '../downloads/useDownloads';
import { Arrival } from '../Arrival';
import { inDesktopApp } from '../desktopBridge';
import { MediaServerContext } from '../mediaServer';
import { navigateFrom, useScreenReady } from '../navigation';
import { getJson, type ContinueWatchingItem, type LibraryTitle, type LibraryWatch, type Outcome } from './api';
import {
  FIELDS, KINDS, filterCounts, filterTitles, missingCount, movieWord, progressText, readFields, segmentsFor, titleKey, totals, writeFields,
  type Field, type Kind, type Segment,
} from './grid';
import { playInDesktop } from './play';
import { PlayAction } from './PlayAction';
import { downloadingByShow, subjectProgress, type SubjectProgress } from './progress';
import { continueMeta, playLabel, playMode, plexWebUrl, watchMarks, type PlayMode } from './watch';

type Loaded = { titles: LibraryTitle[]; services: { sonarr: Outcome; radarr: Outcome }; watch: LibraryWatch };
type LoadState = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; data: Loaded };

// The last server response outlives the screen, so going back to the Library draws the old list at once while a fresh one loads.
let lastLoaded: Loaded | undefined;
export const forgetLoadedLibrary = () => { lastLoaded = undefined; };

const fieldLabels: Record<Field, string> = { year: 'Year', progress: 'Progress', size: 'Size', profile: 'Quality profile', added: 'Date added' };
const kindLabels: Record<Kind, string> = { all: 'All', movie: 'Movies', tv: 'TV' };
const segmentLabels: Record<Segment, string> = { all: 'All', continue: 'Continue Watching', unwatched: 'Unwatched', missing: 'Missing', downloading: 'Downloading' };
const noProgress = new Map<string, SubjectProgress>();
const noTitles: LibraryTitle[] = [];
const noItems: ContinueWatchingItem[] = [];
const watchOff: LibraryWatch = { kind: 'off' };
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

const watchNotice = (watch: LibraryWatch, mediaServer: 'plex' | 'jellyfin') => {
  if (mediaServer !== 'plex') return undefined;
  const hidden = 'so Continue Watching, Unwatched and played marks are hidden. Showing all titles.';
  if (watch.kind === 'unavailable') return `Plex didn't answer, ${hidden}`;
  if (watch.kind === 'off') return `Plex isn't connected yet, ${hidden}`;
  return undefined;
};

const liveDot = <span aria-hidden="true" className="size-1.5 rounded-full bg-foreground" />;

// One badge per card: live progress (on the top row, with no strip on the poster), then deleted, then not monitored,
// then what is missing or not out yet.
function statusBadge(title: LibraryTitle, live: SubjectProgress | undefined, downloading: number): { badge: ReactNode; onTop: boolean } {
  const word = title.tv === null ? movieWord(title, live) : null;
  if (downloading > 0) return { badge: <Badge variant="best" icon={liveDot}>{downloading} downloading</Badge>, onTop: true };
  if (live !== undefined && word !== null && word !== 'deleted') {
    return { badge: live.tone === 'risk' ? <Badge variant="risk">{capitalise(word)}</Badge> : <Badge variant="best" icon={liveDot}>{capitalise(word)}</Badge>, onTop: true };
  }
  return { badge: restingBadge(title, word, downloading), onTop: false };
}

function restingBadge(title: LibraryTitle, word: string | null, downloading: number): ReactNode {
  if (word === 'deleted') return <Badge variant="risk">Deleted</Badge>;
  if (!title.monitored) return <Badge icon={<BookmarkX aria-hidden="true" />}>Not monitored</Badge>;
  const missing = title.tv === null ? 0 : title.tv.episodeCount - title.tv.episodeFileCount - downloading;
  if (missing > 0) return <Badge variant="warning">Missing {missing} {missing === 1 ? 'episode' : 'episodes'}</Badge>;
  if (word === 'missing') return <Badge variant="warning">Missing</Badge>;
  if (word === 'not available') return <Badge variant="outline" className="bg-card">Not out yet</Badge>;
  return undefined;
}

type PosterCardProps = {
  title: LibraryTitle;
  fields: Field[];
  live: SubjectProgress | undefined;
  downloading: number;
  /** This title's entry in Plex's Continue Watching. */
  item: ContinueWatchingItem | undefined;
  /** In the Continue Watching segment: the meta line says where you are and the button always shows. */
  continuing: boolean;
  play: PlayMode;
  machineIdentifier: string;
  onUnauthenticated: () => void;
};

// Every snapshot builds fresh progress objects, so a card compares the values it prints rather than the object.
const sameLive = (a: SubjectProgress | undefined, b: SubjectProgress | undefined) =>
  a === b || (a !== undefined && b !== undefined && a.word === b.word && a.tone === b.tone && a.percent === b.percent);

const PosterCard = memo(function PosterCard({ title, fields, live, downloading, item, continuing, play, machineIdentifier, onUnauthenticated }: PosterCardProps) {
  const meta = [
    fields.includes('year') && title.year !== null ? String(title.year) : '',
    title.tv !== null && fields.includes('progress') ? progressText(title.tv.episodeFileCount, downloading, title.tv.episodeCount) : '',
    fields.includes('size') ? formatBytes(title.sizeOnDisk) : '',
    fields.includes('profile') ? title.qualityProfile ?? '' : '',
    fields.includes('added') ? addedOn(title.added) : '',
  ].filter((fact) => fact !== '');
  const path = `/${title.tv === null ? 'movie' : 'series'}/${title.id}`;
  const status = statusBadge(title, live, downloading);
  const marks = watchMarks(title.watch, item);
  const savedAtMs = item?.viewOffsetMs ?? (title.watch?.kind === 'movie' ? title.watch.viewOffsetMs : null);
  const continueLine = continuing && item !== undefined ? continueMeta(item) : undefined;
  return (
    <li className="[contain-intrinsic-size:auto_var(--poster-width)_auto_372px] [content-visibility:auto]">
      <LibraryPosterCard
        href={path}
        onClick={openLink(path)}
        poster={title.smallPosterUrl ?? undefined}
        title={title.title}
        meta={continueLine ?? (meta.length > 0 ? meta.join(' · ') : undefined)}
        status={status.badge}
        statusOnTop={status.onTop}
        {...marks}
        actionAlwaysVisible={continuing}
        action={play === 'none' || title.watch === null ? undefined : (
          <PlayAction
            mode={play}
            label={playLabel(title.watch, item)}
            name={title.title}
            resumeAtMs={marks.watched === undefined ? null : savedAtMs}
            plexUrl={plexWebUrl(machineIdentifier, title.watch.ratingKey)}
            onPlay={(from, signal) => playInDesktop(title, item, from, onUnauthenticated, signal)}
          />
        )}
      />
    </li>
  );
}, (prev, next) => prev.title === next.title && prev.fields === next.fields && prev.downloading === next.downloading && sameLive(prev.live, next.live)
  && prev.item === next.item && prev.continuing === next.continuing && prev.play === next.play && prev.machineIdentifier === next.machineIdentifier
  && prev.onUnauthenticated === next.onUnauthenticated);

export function Library({ downloads, onUnauthenticated }: { downloads: DownloadsState; onUnauthenticated: () => void }) {
  const [state, setState] = useState<LoadState>(() => (lastLoaded === undefined ? { kind: 'loading' } : { kind: 'ready', data: lastLoaded }));
  const [kind, setKind] = useState<Kind>('all');
  const [segment, setSegment] = useState<Segment>('all');
  const mediaServer = use(MediaServerContext).name;
  const [fields, setFields] = useState<Field[]>(readFields);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    if (lastLoaded === undefined) setState({ kind: 'loading' });
    getJson<Loaded>('/api/library/titles', onUnauthenticated, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) { lastLoaded = data; setState({ kind: 'ready', data }); }
      })
      .catch(() => { if (!controller.signal.aborted && lastLoaded === undefined) setState({ kind: 'failed' }); });
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
  const watch = state.kind === 'ready' ? state.data.watch : watchOff;
  const segments = segmentsFor(watch.kind);
  const shownSegment = segments.includes(segment) ? segment : 'all';
  const continueWatching = watch.kind === 'ok' ? watch.continueWatching : noItems;
  const facts = useMemo(() => ({ progress, downloadingByShow: perShow, continueWatching }), [progress, perShow, continueWatching]);
  const counts = useMemo(() => filterCounts(titles, kind, shownSegment, facts), [titles, kind, shownSegment, facts]);
  const shown = useMemo(() => filterTitles(titles, kind, shownSegment, facts), [titles, kind, shownSegment, facts]);
  // Plex lists a show once; the first entry wins if it ever lists one twice.
  const itemByTitle = useMemo(() => {
    const byKey = new Map<string, ContinueWatchingItem>();
    for (const item of continueWatching) if (!byKey.has(titleKey(item))) byKey.set(titleKey(item), item);
    return byKey;
  }, [continueWatching]);
  const desktop = inDesktopApp();
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
      <Tabs value={kind} onValueChange={(value) => setKind(value as Kind)} className="pt-4">
        <TabsList aria-label="Type" className="gap-5 border-b border-border">
          {KINDS.map((value) => (
            <TabsTrigger key={value} value={value} count={state.kind === 'ready' ? counts.kinds[value] : undefined}>{kindLabels[value]}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap items-center gap-2 pt-4 pb-5">
        <ToggleGroup aria-label="Show" value={shownSegment} onValueChange={(value) => setSegment(value as Segment)}>
          {segments.map((value) => (
            <ToggleGroupItem key={value} value={value} count={state.kind === 'ready' ? counts.segments[value] : undefined}>{segmentLabels[value]}</ToggleGroupItem>
          ))}
        </ToggleGroup>
        <span className="flex-1" />
        <Select value="added">
          <SelectTrigger size="sm" lead="Sort">Date added, newest first</SelectTrigger>
          <SelectContent>
            <SelectItem value="added">Date added, newest first</SelectItem>
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="menu" size="sm">Poster fields</Button>} />
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
          const problems = [serviceProblem('Sonarr', services.sonarr), serviceProblem('Radarr', services.radarr), watchNotice(watch, mediaServer)]
            .filter((line) => line !== undefined);
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
                    {titles.length > 0
                      ? <EmptyState icon={<LibraryIcon aria-hidden="true" />} title="Nothing matches this filter" />
                      : (
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
                      )}
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
                        item={itemByTitle.get(titleKey(title))}
                        continuing={shownSegment === 'continue'}
                        play={playMode({ mediaServer, desktop, libraryWatch: watch.kind, watch: title.watch })}
                        machineIdentifier={watch.kind === 'ok' ? watch.machineIdentifier : ''}
                        onUnauthenticated={onUnauthenticated}
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
