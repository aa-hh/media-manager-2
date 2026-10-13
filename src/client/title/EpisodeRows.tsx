import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';
import { Bookmark, BookmarkX, ChevronUp, Ellipsis, List, ListVideo, RotateCw, Search, X } from 'lucide-react';
import { Fragment, memo, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode, type SetStateAction } from 'react';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { BarSelection, BarSelectionAction } from '@/components/ui/bar-selection';
import { Button } from '@/components/ui/button';
import { Collapsible } from '@/components/ui/collapsible-trigger';
import { EmptyState } from '@/components/ui/empty-state';
import { RowEpisode } from '@/components/ui/row-episode';
import { RowSeason } from '@/components/ui/row-season';
import { StatusInline } from '@/components/ui/status-inline';
import { Table } from '@/components/ui/table';
import { ToggleBookmark } from '@/components/ui/toggle-bookmark';
import { Tooltip } from '@/components/ui/tooltip';
import { formatBytes, type Snapshot } from '../downloads/model';
import type { EpisodeDetail, SecondVersion, SeriesDetail } from '../library/api';
import { progressText } from '../library/grid';
import { downloadingEpisodes, seedingFacts, type SubjectProgress } from '../library/progress';
import type { ReleaseTarget } from '../PickRelease';
import { lazyScreen } from '../lazyScreen';
import { EpisodeDetails } from './EpisodeDetails';
import { episodeMarks, episodeWord, relativeAirDate, seasonAiredState, seasonMonitoredState } from './rows';
import { moveFocus, rangeBetween, selectionSummary, type RowRef } from './selection';
import { sendAction } from './TitleHeader';

const PickRelease = lazyScreen(() => import('../PickRelease').then((module) => module.PickRelease));

// One inline panel at a time, keyed by row so live progress updates never close it.
export type Panel = { key: string; panel: 'pick'; target: ReleaseTarget } | { key: string; panel: 'details' };

export type MonitorChange =
  | { kind: 'series'; monitored: boolean }
  | { kind: 'season'; seasonNumber: number; monitored: boolean }
  | { kind: 'episodes'; episodeIds: number[]; monitored: boolean };

const airedLabels = { aired: 'Aired', airing: 'Airing', upcoming: 'Upcoming' } as const;
const seasonKey = (seasonNumber: number) => `season:${seasonNumber}`;
const episodeKey = (id: number) => `episode:${id}`;
const code = (episode: EpisodeDetail) => `S${String(episode.seasonNumber).padStart(2, '0')}E${String(episode.episodeNumber).padStart(2, '0')}`;

// Height 0 to full as a season or an episode's details open (duration-size); the reverse at duration-fast.
const openPanel = 'h-(--collapsible-panel-height) overflow-hidden transition-all duration-(--duration-size) ease-out data-ending-style:h-0 data-ending-style:duration-(--duration-fast) data-ending-style:ease-in data-starting-style:h-0 motion-reduce:transition-none';

// The button that opened a release list turns black with an X while the list is open, so it reads as the way to close it.
const closeLook = 'before:bg-foreground not-data-disabled:hover:before:bg-foreground/85 not-data-disabled:active:before:bg-foreground';

function IconAction({ label, icon, pressed = false, className, onClick }: { label: string; icon: ReactNode; pressed?: boolean; className?: string; onClick: () => void }) {
  return (
    <Tooltip text={label}>
      <Button
        variant="ghost"
        size="row"
        iconOnly
        icon={icon}
        aria-label={label}
        className={className ?? (pressed ? 'bg-surface-pressed' : undefined)}
        onClick={(event) => { event.stopPropagation(); onClick(); }}
      />
    </Tooltip>
  );
}


const stateLook = (word: string, live: SubjectProgress | undefined): BadgeVariant => {
  if (live !== undefined) return live.tone === 'risk' ? 'risk' : 'live';
  return word === 'Missing' || word === 'Below cutoff' ? 'warning' : 'neutral';
};

type Sent = 'sent' | 'failed';

const statusLine = (problem: string | undefined, sent: Sent | undefined) => {
  if (problem !== undefined) return <StatusInline status="failed" className="ml-2">{problem}</StatusInline>;
  if (sent === 'sent') return <StatusInline status="sent" className="ml-2">search sent</StatusInline>;
  if (sent === 'failed') return <StatusInline status="failed" className="ml-2">Sonarr didn't answer.</StatusInline>;
  return null;
};

type RowHandlers = {
  click: (event: MouseEvent, key: string) => void;
  focus: (key: string) => void;
  toggle: (episode: EpisodeDetail) => void;
  search: (key: string, body: unknown) => void;
  pick: (episode: EpisodeDetail) => void;
  details: (key: string) => void;
  closeDetails: (key: string) => void;
  secondVersions: (next: SetStateAction<SecondVersion[]>) => void;
};

type EpisodeRowProps = {
  episode: EpisodeDetail;
  live: SubjectProgress | undefined;
  protectedIds: Set<number>;
  /** Rounded to the minute, so a row redraws only when its air date text can change. */
  now: number;
  selected: boolean;
  detailsOpen: boolean;
  pickOpen: boolean;
  tabIndex: number;
  problem: string | undefined;
  sent: Sent | undefined;
  secondVersions: SecondVersion[];
  /** Only while the details are open: the seeding facts there follow the live snapshot. */
  snapshot: Snapshot | undefined;
  profile: string | null;
  seriesPath: string | null;
  pickBand: ReactNode;
  handlers: RowHandlers;
  onUnauthenticated: () => void;
};

// The progress map is rebuilt on every stream event, so its entries are compared by what the row prints.
const sameLive = (a: SubjectProgress | undefined, b: SubjectProgress | undefined) => (
  a === b || (a !== undefined && b !== undefined && a.word === b.word && a.tone === b.tone && a.percent === b.percent)
);
const sameRow = (prev: EpisodeRowProps, next: EpisodeRowProps) => (Object.keys(next) as Array<keyof EpisodeRowProps>)
  .every((key) => (key === 'live' ? sameLive(prev.live, next.live) : prev[key] === next[key]));

const noVersions: SecondVersion[] = [];
const noEpisodes: EpisodeDetail[] = [];

const EpisodeRow = memo(function EpisodeRow({
  episode, live, protectedIds, now, selected, detailsOpen, pickOpen, tabIndex, problem, sent, secondVersions, snapshot, profile, seriesPath, pickBand, handlers, onUnauthenticated,
}: EpisodeRowProps) {
  const rowKey = episodeKey(episode.id);
  const word = episodeWord(episode, live, protectedIds, now);
  const upcoming = episode.airDate !== null && Date.parse(episode.airDate) > now;
  const versionCount = (episode.hasFile ? 1 : 0) + secondVersions.filter((version) => version.state === 'imported').length;
  return (
    <>
      <RowEpisode
        data-row-key={rowKey}
        tabIndex={tabIndex}
        aria-selected={selected}
        onFocus={(event) => { if (event.target === event.currentTarget) handlers.focus(rowKey); }}
        onClick={(event) => handlers.click(event, rowKey)}
        className="pl-13 select-none"
        selected={selected || detailsOpen}
        open={pickOpen}
        marker={live?.tone === 'risk' ? 'risk' : word === 'Missing' ? 'warning' : undefined}
        bookmark={<ToggleBookmark state={episode.monitored ? 'all' : 'none'} onToggle={() => handlers.toggle(episode)} />}
        number={`E${String(episode.episodeNumber).padStart(2, '0')}`}
        title={(
          <>
            {episode.title}
            {episodeMarks(episode).map((mark) => <Badge key={mark} variant="outline" className="ml-2">{mark}</Badge>)}
          </>
        )}
        aired={relativeAirDate(episode.airDate, now) || '–'}
        file={episode.file?.quality == null ? undefined : <Badge>{episode.file.quality}</Badge>}
        state={(
          <>
            {word !== null
              ? <Badge variant={stateLook(word, live)}>{word}</Badge>
              : upcoming && <Badge variant="outline">Not out yet</Badge>}
            {versionCount > 1 && <Badge>{`${versionCount} versions`}</Badge>}
            {statusLine(problem, sent)}
          </>
        )}
        monitored={episode.monitored}
        upcoming={upcoming}
        actions={(
          <>
            <IconAction
              label="Search automatically"
              icon={<Search className="text-muted-foreground" />}
              onClick={() => handlers.search(rowKey, { service: 'sonarr', kind: 'episodes', episodeIds: [episode.id] })}
            />
            <IconAction
              label={pickOpen ? 'Close releases' : 'Pick a release'}
              icon={pickOpen ? <X className="text-background" /> : <List className="text-muted-foreground" />}
              className={pickOpen ? closeLook : undefined}
              onClick={() => handlers.pick(episode)}
            />
            <IconAction
              label={detailsOpen ? 'Hide details' : 'Details'}
              icon={detailsOpen ? <ChevronUp className="text-foreground" /> : <Ellipsis className="text-muted-foreground" />}
              pressed={detailsOpen}
              onClick={() => handlers.details(rowKey)}
            />
          </>
        )}
      />
      <Collapsible open={detailsOpen}>
        <CollapsiblePrimitive.Panel className={openPanel}>
          <EpisodeDetails
            episode={episode}
            seeding={snapshot === undefined ? [] : seedingFacts(snapshot, { episodeId: episode.id })}
            secondVersions={secondVersions}
            onSecondVersions={handlers.secondVersions}
            profile={profile}
            seriesPath={seriesPath}
            onClose={() => handlers.closeDetails(rowKey)}
            onUnauthenticated={onUnauthenticated}
          />
        </CollapsiblePrimitive.Panel>
      </Collapsible>
      {/* Mounted closed on every row and bound to pickOpen, so the inset animates open and closed. */}
      <Collapsible open={pickOpen}>
        <CollapsiblePrimitive.Panel className={openPanel}>{pickBand}</CollapsiblePrimitive.Panel>
      </Collapsible>
    </>
  );
}, sameRow);

export function EpisodeRows({ detail, pickRequest, snapshot, protectedIds, progress, problems, onMonitor, onSecondVersions, onUnauthenticated }: {
  detail: SeriesDetail;
  /** Goes up each time the header's Pick a release is pressed: opens the first season's panel. */
  pickRequest: number;
  snapshot: Snapshot | undefined;
  protectedIds: Set<number>;
  progress: Map<string, SubjectProgress>;
  problems: Record<string, string>;
  onMonitor: (change: MonitorChange, problemKey: string) => void;
  onSecondVersions: (next: SetStateAction<SecondVersion[]>) => void;
  onUnauthenticated: () => void;
}) {
  const seasons = useMemo(() => [...detail.seasons].sort((a, b) => b.seasonNumber - a.seasonNumber), [detail.seasons]);
  const bySeason = useMemo(() => {
    const map = new Map<number, EpisodeDetail[]>();
    for (const episode of detail.episodes) map.set(episode.seasonNumber, [...(map.get(episode.seasonNumber) ?? []), episode]);
    return map;
  }, [detail.episodes]);
  const versionsByEpisode = useMemo(() => {
    const map = new Map<number, SecondVersion[]>();
    for (const version of detail.secondVersions ?? []) {
      if (version.episodeId !== null) map.set(version.episodeId, [...(map.get(version.episodeId) ?? []), version]);
    }
    return map;
  }, [detail.secondVersions]);
  const [open, setOpen] = useState<Set<number>>(() => new Set(seasons.length === 0 ? [] : [seasons[0].seasonNumber]));
  const [panel, setPanel] = useState<Panel | null>(null);
  // The pick panel opened last. Its row keeps the inset's content while it animates closed; every other row gets none,
  // so a closed row's props stay equal and its memo holds.
  const [lastPick, setLastPick] = useState<Extract<Panel, { panel: 'pick' }> | null>(null);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [anchorKey, setAnchorKey] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, Sent>>({});
  const [refresh, setRefresh] = useState<'sending' | Sent | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const now = Math.floor(Date.now() / 60_000) * 60_000;
  const seriesId = detail.id;

  const seasonLabel = (seasonNumber: number) => (seasonNumber === 0 ? 'Specials' : `Season ${seasonNumber}`);
  const seasonTarget = (seasonNumber: number): ReleaseTarget => ({ service: 'sonarr', kind: 'season', seriesId, seasonNumber });

  useEffect(() => {
    if (pickRequest === 0 || seasons.length === 0) return;
    const first = seasons[0].seasonNumber;
    setOpen((current) => new Set(current).add(first));
    const next = { key: seasonKey(first), panel: 'pick' as const, target: seasonTarget(first) };
    setPanel(next);
    setLastPick(next);
    // Only a new press opens it; the seasons list itself changes on every live update.
  }, [pickRequest]);

  const episodesOf = (seasonNumber: number) => bySeason.get(seasonNumber) ?? noEpisodes;
  const seasonState = (season: SeriesDetail['seasons'][number]) => {
    const episodes = episodesOf(season.seasonNumber);
    return episodes.length === 0 ? (season.monitored ? 'all' : 'none') : seasonMonitoredState(episodes);
  };

  // The visible rows in screen order. Second-version rows sit inside the episode details band and stay out of this list.
  const rows: RowRef[] = useMemo(() => seasons.flatMap((season) => [
    { kind: 'season' as const, key: seasonKey(season.seasonNumber), episodeId: null },
    ...(open.has(season.seasonNumber)
      ? (bySeason.get(season.seasonNumber) ?? noEpisodes).map((episode) => ({ kind: 'episode' as const, key: episodeKey(episode.id), episodeId: episode.id }))
      : []),
  ]), [seasons, open, bySeason]);
  const indexOf = (key: string | null) => (key === null ? -1 : rows.findIndex((row) => row.key === key));

  const toggleSeason = (seasonNumber: number) => {
    const season = seasons.find((candidate) => candidate.seasonNumber === seasonNumber);
    if (season === undefined) return;
    onMonitor({ kind: 'season', seasonNumber, monitored: seasonState(season) !== 'all' }, seasonKey(seasonNumber));
  };
  const toggleEpisode = (episode: EpisodeDetail) => onMonitor({ kind: 'episodes', episodeIds: [episode.id], monitored: !episode.monitored }, episodeKey(episode.id));
  const setSelection = (ids: number[], monitored: boolean) => {
    if (ids.length > 0) onMonitor({ kind: 'episodes', episodeIds: ids, monitored }, episodeKey(ids[0]));
  };
  const clearSelection = () => {
    setSelected(new Set());
    setAnchorKey(null);
  };

  const focusRow = (key: string) => {
    setFocusKey(key);
    containerRef.current?.querySelector<HTMLElement>(`[data-row-key="${key}"]`)?.focus();
  };
  const selectRow = (index: number, extend: boolean) => {
    const row = rows[index];
    if (row === undefined) return;
    focusRow(row.key);
    const anchor = indexOf(anchorKey);
    if (extend && anchor >= 0) {
      setSelected(new Set(rangeBetween(rows, anchor, index)));
      return;
    }
    setAnchorKey(row.key);
    setSelected(new Set(row.episodeId === null ? [] : [row.episodeId]));
  };
  const onRowClick = (event: MouseEvent, key: string) => {
    if (event.shiftKey) event.preventDefault();
    selectRow(indexOf(key), event.shiftKey);
  };

  const toggleOpen = (seasonNumber: number) => {
    const next = new Set(open);
    if (next.has(seasonNumber)) next.delete(seasonNumber);
    else next.add(seasonNumber);
    setOpen(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = (event.target as HTMLElement).dataset.rowKey;
    if (key === undefined) return;
    const index = indexOf(key);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = moveFocus(rows, index, event.key === 'ArrowDown' ? 1 : -1);
      if (!event.shiftKey) {
        focusRow(rows[next].key);
        return;
      }
      if (indexOf(anchorKey) < 0) setAnchorKey(key);
      const anchor = indexOf(anchorKey) < 0 ? index : indexOf(anchorKey);
      focusRow(rows[next].key);
      setSelected(new Set(rangeBetween(rows, anchor, next)));
      return;
    }
    if (event.key === ' ' || event.key === 'm') {
      event.preventDefault();
      // Acts on the selection only while the selection bar shows it; one selected row elsewhere must not steal the key from the focused row.
      if (selected.size >= 2) {
        const anchorEpisode = detail.episodes.find((episode) => episodeKey(episode.id) === anchorKey)
          ?? detail.episodes.find((episode) => selected.has(episode.id));
        setSelection([...selected], !(anchorEpisode?.monitored ?? false));
        return;
      }
      const row = rows[index];
      if (row.kind === 'season') toggleSeason(Number(row.key.slice('season:'.length)));
      const episode = detail.episodes.find((candidate) => candidate.id === row.episodeId);
      if (episode !== undefined) toggleEpisode(episode);
      return;
    }
    if (event.key === 'Enter' && rows[index].kind === 'episode') {
      event.preventDefault();
      setPanel(panel?.key === key && panel.panel === 'details' ? null : { key, panel: 'details' });
      return;
    }
    if (event.key === 'Enter' && rows[index].kind === 'season') {
      event.preventDefault();
      toggleOpen(Number(key.slice('season:'.length)));
      return;
    }
    if (event.key === 'Escape') {
      if (panel !== null) setPanel(null);
      else clearSelection();
    }
  };

  const openPick = (key: string, target: ReleaseTarget) => {
    if (panel?.key === key && panel.panel === 'pick') {
      setPanel(null);
      return;
    }
    const next = { key, panel: 'pick' as const, target };
    setPanel(next);
    setLastPick(next);
  };
  const search = async (key: string, body: unknown) => {
    const ok = await sendAction('/api/library/search', body, onUnauthenticated);
    setSent((current) => ({ ...current, [key]: ok ? 'sent' : 'failed' }));
  };
  const pickTarget = (episode: EpisodeDetail): ReleaseTarget => ({ service: 'sonarr', kind: 'episode', seriesId, episodeId: episode.id });

  const statusOf = (key: string) => statusLine(problems[key], sent[key]);
  const tabKey = indexOf(focusKey) >= 0 ? focusKey : rows[0]?.key;
  const tabStop = (key: string) => (key === tabKey ? 0 : -1);
  const pickOpen = (key: string) => panel?.key === key && panel.panel === 'pick';
  // The show was read once when the page opened; an import since then shows only as a grab marked imported in the
  // live snapshot. Pick a release needs the current hasFile to offer replace or second version.
  const imported = useMemo(() => new Set((snapshot?.grabs ?? []).filter((grab) => grab.importedAt !== null).flatMap((grab) => grab.episodeIds)), [snapshot]);
  // The panel mounts PickRelease only while open; the content is given only to the open or last-closed row.
  const pickBand = (key: string) => (lastPick !== null && lastPick.key === key
    ? (
      <Suspense fallback={null}>
        <PickRelease
          target={lastPick.target}
          name={detail.title}
          episodes={detail.episodes.map((episode) => (!episode.hasFile && imported.has(episode.id) ? { ...episode, hasFile: true } : episode))}
          movieHasFile={false}
          variant={lastPick.target.kind === 'episode' ? 'episode' : 'movie'}
          live={progress.get(key)}
          onClose={() => setPanel(null)}
          onUnauthenticated={onUnauthenticated}
        />
      </Suspense>
    )
    : null);

  const latest = useRef<RowHandlers | null>(null);
  useLayoutEffect(() => {
    latest.current = {
      click: onRowClick,
      focus: setFocusKey,
      toggle: toggleEpisode,
      search: (key, body) => void search(key, body),
      pick: (episode) => openPick(episodeKey(episode.id), pickTarget(episode)),
      details: (key) => setPanel((current) => (current?.key === key && current.panel === 'details' ? null : { key, panel: 'details' })),
      closeDetails: (key) => {
        setPanel(null);
        focusRow(key);
      },
      secondVersions: onSecondVersions,
    };
  });
  // Stable for the life of the list, so a memoized row redraws only when its own data changes.
  const [handlers] = useState((): RowHandlers => ({
    click: (event, key) => latest.current?.click(event, key),
    focus: (key) => latest.current?.focus(key),
    toggle: (episode) => latest.current?.toggle(episode),
    search: (key, body) => latest.current?.search(key, body),
    pick: (episode) => latest.current?.pick(episode),
    details: (key) => latest.current?.details(key),
    closeDetails: (key) => latest.current?.closeDetails(key),
    secondVersions: (next) => latest.current?.secondVersions(next),
  }));

  if (seasons.length === 0) {
    return (
      <div className="pt-6">
        <EmptyState
          icon={<ListVideo />}
          title="Sonarr has no episodes for this show yet"
          action={(
            <span className="flex items-center gap-2">
              <Button
                variant="outline"
                icon={<RotateCw />}
                loading={refresh === 'sending'}
                onClick={() => {
                  setRefresh('sending');
                  void sendAction('/api/library/refresh', { service: 'sonarr', kind: 'series', seriesId }, onUnauthenticated)
                    .then((ok) => setRefresh(ok ? 'sent' : 'failed'));
                }}
              >
                Refresh
              </Button>
              {refresh === 'sent' && <StatusInline status="sent">refresh sent</StatusInline>}
              {refresh === 'failed' && <StatusInline status="failed">Sonarr didn't answer.</StatusInline>}
            </span>
          )}
        >
          Refresh the show once Sonarr has its episode list.
        </EmptyState>
      </div>
    );
  }

  return (
    <div ref={containerRef} onKeyDown={onKeyDown}>
      <Table aria-label="Seasons">
        {seasons.map((season) => {
          const key = seasonKey(season.seasonNumber);
          const episodes = episodesOf(season.seasonNumber);
          const isOpen = open.has(season.seasonNumber);
          const label = seasonLabel(season.seasonNumber);
          const downloading = downloadingEpisodes(progress, episodes.map((episode) => episode.id));
          const monitored = seasonState(season);
          const { episodeFileCount, episodeCount, sizeOnDisk } = season.statistics;
          const off = episodes.filter((episode) => !episode.monitored);
          const summary = monitored !== 'mixed' ? undefined
            : `${episodes.length - off.length} of ${episodes.length} monitored${off.length <= 2 ? ` · ${off.map(code).join(', ')} off` : ''}`;
          return (
            <Fragment key={key}>
              <RowSeason
                data-row-key={key}
                tabIndex={tabStop(key)}
                onFocus={(event) => { if (event.target === event.currentTarget) setFocusKey(key); }}
                onClick={(event) => {
                  onRowClick(event, key);
                  if (!event.shiftKey) toggleOpen(season.seasonNumber);
                }}
                open={isOpen}
                bookmark={<ToggleBookmark state={monitored} onToggle={() => toggleSeason(season.seasonNumber)} />}
                title={label}
                progress={episodeCount === 0 ? 0 : Math.min(100, (episodeFileCount / episodeCount) * 100)}
                progressTone={episodeCount > 0 && episodeFileCount >= episodeCount ? 'done' : undefined}
                count={(
                  <>
                    {episodes.length === 0 && season.statistics.totalEpisodeCount === 0
                      ? 'No episodes listed yet'
                      : progressText(episodeFileCount, downloading, episodeCount)}
                    {statusOf(key)}
                  </>
                )}
                status={airedLabels[seasonAiredState(episodes, now)]}
                size={sizeOnDisk > 0 ? formatBytes(sizeOnDisk) : '–'}
                summary={summary}
                monitored={monitored !== 'none'}
                actions={(
                  <>
                    <IconAction
                      label="Search automatically"
                      icon={<Search className="text-muted-foreground" />}
                      onClick={() => void search(key, { service: 'sonarr', kind: 'season', seriesId, seasonNumber: season.seasonNumber })}
                    />
                    <IconAction
                      label={pickOpen(key) ? 'Close season packs' : 'Pick a season pack'}
                      icon={pickOpen(key) ? <X className="text-background" /> : <List className="text-muted-foreground" />}
                      className={pickOpen(key) ? closeLook : undefined}
                      onClick={() => openPick(key, seasonTarget(season.seasonNumber))}
                    />
                  </>
                )}
              />
              <Collapsible open={pickOpen(key)}>
                <CollapsiblePrimitive.Panel className={openPanel}>{pickBand(key)}</CollapsiblePrimitive.Panel>
              </Collapsible>
              <Collapsible open={isOpen}>
                <CollapsiblePrimitive.Panel aria-label={label} className={openPanel}>
                  {episodes.map((episode) => {
                    const rowKey = episodeKey(episode.id);
                    const detailsOpen = panel?.key === rowKey && panel.panel === 'details';
                    return (
                      <EpisodeRow
                        key={rowKey}
                        episode={episode}
                        live={progress.get(rowKey)}
                        protectedIds={protectedIds}
                        now={now}
                        selected={selected.has(episode.id)}
                        detailsOpen={detailsOpen}
                        pickOpen={pickOpen(rowKey)}
                        tabIndex={tabStop(rowKey)}
                        problem={problems[rowKey]}
                        sent={sent[rowKey]}
                        secondVersions={versionsByEpisode.get(episode.id) ?? noVersions}
                        snapshot={detailsOpen ? snapshot : undefined}
                        profile={detail.qualityProfile?.name ?? null}
                        seriesPath={detail.path}
                        pickBand={pickBand(rowKey)}
                        handlers={handlers}
                        onUnauthenticated={onUnauthenticated}
                      />
                    );
                  })}
                </CollapsiblePrimitive.Panel>
              </Collapsible>
            </Fragment>
          );
        })}
      </Table>
      <BarSelection open={selected.size >= 2} count={selectionSummary(selected, detail.episodes)} hint="Unmonitoring keeps files" onClear={clearSelection} clearKbd="Esc">
        <BarSelectionAction icon={<Bookmark />} onClick={() => setSelection([...selected], true)}>Monitor</BarSelectionAction>
        <BarSelectionAction icon={<BookmarkX />} onClick={() => setSelection([...selected], false)}>Unmonitor</BarSelectionAction>
        <BarSelectionAction icon={<Search />} onClick={() => void search(episodeKey([...selected][0]), { service: 'sonarr', kind: 'episodes', episodeIds: [...selected] })}>
          Search automatically
        </BarSelectionAction>
      </BarSelection>
    </div>
  );
}
