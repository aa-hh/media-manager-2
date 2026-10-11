import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';
import { Bookmark, BookmarkX, ChevronUp, Ellipsis, List, ListVideo, RotateCw, Search } from 'lucide-react';
import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode, type SetStateAction } from 'react';
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
import { PickRelease, type ReleaseTarget } from '../PickRelease';
import { EpisodeDetails } from './EpisodeDetails';
import { episodeMarks, episodeWord, relativeAirDate, seasonAiredState, seasonMonitoredState } from './rows';
import { moveFocus, rangeBetween, selectionSummary, type RowRef } from './selection';
import { sendAction } from './TitleHeader';

// One inline panel at a time, keyed by row so live progress updates never close it.
export type Panel = { key: string; panel: 'pick'; target: ReleaseTarget; title: string } | { key: string; panel: 'details' };

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

function IconAction({ label, icon, pressed = false, onClick }: { label: string; icon: ReactNode; pressed?: boolean; onClick: () => void }) {
  return (
    <Tooltip text={label}>
      <Button
        variant="ghost"
        size="row"
        iconOnly
        icon={icon}
        aria-label={label}
        className={pressed ? 'bg-surface-pressed' : undefined}
        onClick={(event) => { event.stopPropagation(); onClick(); }}
      />
    </Tooltip>
  );
}

function PickBand({ panel, episodes, onClose, onUnauthenticated }: {
  panel: Extract<Panel, { panel: 'pick' }>;
  episodes: EpisodeDetail[];
  onClose: () => void;
  onUnauthenticated: () => void;
}) {
  return (
    <div className="border-b border-border bg-background p-2">
      <PickRelease target={panel.target} title={panel.title} episodes={episodes} movieHasFile={false} onClose={onClose} onUnauthenticated={onUnauthenticated} />
    </div>
  );
}

const stateLook = (word: string, live: SubjectProgress | undefined): BadgeVariant => {
  if (live !== undefined) return live.tone === 'risk' ? 'risk' : 'live';
  return word === 'Missing' || word === 'Below cutoff' ? 'warning' : 'neutral';
};

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
  const seasons = [...detail.seasons].sort((a, b) => b.seasonNumber - a.seasonNumber);
  const [open, setOpen] = useState<Set<number>>(() => new Set(seasons.length === 0 ? [] : [seasons[0].seasonNumber]));
  const [panel, setPanel] = useState<Panel | null>(null);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [anchorKey, setAnchorKey] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, 'sent' | 'failed'>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const now = Date.now();
  const seriesId = detail.id;

  const seasonLabel = (seasonNumber: number) => (seasonNumber === 0 ? 'Specials' : `Season ${seasonNumber}`);
  const seasonTarget = (seasonNumber: number): ReleaseTarget => ({ service: 'sonarr', kind: 'season', seriesId, seasonNumber });

  useEffect(() => {
    if (pickRequest === 0 || seasons.length === 0) return;
    const first = seasons[0].seasonNumber;
    setOpen((current) => new Set(current).add(first));
    setPanel({ key: seasonKey(first), panel: 'pick', target: seasonTarget(first), title: seasonLabel(first) });
    // Only a new press opens it; the seasons list itself changes on every live update.
  }, [pickRequest]);

  const episodesOf = (seasonNumber: number) => detail.episodes.filter((episode) => episode.seasonNumber === seasonNumber);
  const seasonState = (season: SeriesDetail['seasons'][number]) => {
    const episodes = episodesOf(season.seasonNumber);
    return episodes.length === 0 ? (season.monitored ? 'all' : 'none') : seasonMonitoredState(episodes);
  };

  // The visible rows in screen order; version rows join once second versions are drawn.
  const rows: RowRef[] = seasons.flatMap((season) => [
    { kind: 'season' as const, key: seasonKey(season.seasonNumber), episodeId: null },
    ...(open.has(season.seasonNumber)
      ? episodesOf(season.seasonNumber).map((episode) => ({ kind: 'episode' as const, key: episodeKey(episode.id), episodeId: episode.id }))
      : []),
  ]);
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
      if (selected.size > 0) {
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

  const openPick = (key: string, target: ReleaseTarget, title: string) => {
    setPanel(panel?.key === key && panel.panel === 'pick' ? null : { key, panel: 'pick', target, title });
  };
  const search = async (key: string, body: unknown) => {
    const ok = await sendAction('/api/library/search', body, onUnauthenticated);
    setSent((current) => ({ ...current, [key]: ok ? 'sent' : 'failed' }));
  };
  const pickTarget = (episode: EpisodeDetail): ReleaseTarget => ({ service: 'sonarr', kind: 'episode', seriesId, episodeId: episode.id });
  const pickTitle = (episode: EpisodeDetail) => `${code(episode)} · ${episode.title}`;
  const statusOf = (key: string) => {
    if (problems[key] !== undefined) return <StatusInline status="failed" className="ml-2">{problems[key]}</StatusInline>;
    if (sent[key] === 'sent') return <StatusInline status="sent" className="ml-2">search sent</StatusInline>;
    if (sent[key] === 'failed') return <StatusInline status="failed" className="ml-2">Sonarr didn't answer.</StatusInline>;
    return null;
  };
  const tabStop = (key: string) => (key === (indexOf(focusKey) >= 0 ? focusKey : rows[0]?.key) ? 0 : -1);
  const pickOpen = (key: string) => panel?.key === key && panel.panel === 'pick';
  const pickBand = (key: string) => (panel !== null && panel.key === key && panel.panel === 'pick'
    ? <PickBand panel={panel} episodes={detail.episodes} onClose={() => setPanel(null)} onUnauthenticated={onUnauthenticated} />
    : null);

  if (seasons.length === 0) {
    return (
      <div className="pt-6">
        <EmptyState
          icon={<ListVideo />}
          title="Sonarr has no episodes for this show yet"
          action={(
            <Button variant="outline" icon={<RotateCw />} onClick={() => void sendAction('/api/library/refresh', { service: 'sonarr', kind: 'series', seriesId }, onUnauthenticated)}>
              Refresh
            </Button>
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
                      label="Pick a season pack"
                      icon={<List className="text-muted-foreground" />}
                      pressed={pickOpen(key)}
                      onClick={() => openPick(key, seasonTarget(season.seasonNumber), label)}
                    />
                  </>
                )}
              />
              {pickBand(key)}
              <Collapsible open={isOpen}>
                <CollapsiblePrimitive.Panel aria-label={label} className={openPanel}>
                  {episodes.map((episode) => {
                    const rowKey = episodeKey(episode.id);
                    const live = progress.get(rowKey);
                    const word = episodeWord(episode, live, protectedIds, now);
                    const upcoming = episode.airDate !== null && Date.parse(episode.airDate) > now;
                    const detailsOpen = panel?.key === rowKey && panel.panel === 'details';
                    const secondVersions = (detail.secondVersions ?? []).filter((version) => version.episodeId === episode.id);
                    const versionCount = (episode.hasFile ? 1 : 0) + secondVersions.filter((version) => version.state === 'imported').length;
                    return (
                      <Fragment key={rowKey}>
                        <RowEpisode
                          data-row-key={rowKey}
                          tabIndex={tabStop(rowKey)}
                          aria-selected={selected.has(episode.id)}
                          onFocus={(event) => { if (event.target === event.currentTarget) setFocusKey(rowKey); }}
                          onClick={(event) => onRowClick(event, rowKey)}
                          className="pl-13 select-none"
                          selected={selected.has(episode.id) || detailsOpen}
                          marker={live?.tone === 'risk' ? 'risk' : word === 'Missing' ? 'warning' : undefined}
                          bookmark={<ToggleBookmark state={episode.monitored ? 'all' : 'none'} onToggle={() => toggleEpisode(episode)} />}
                          number={`E${String(episode.episodeNumber).padStart(2, '0')}`}
                          title={(
                            <>
                              {episode.title}
                              {episodeMarks(episode).map((mark) => <Badge key={mark} variant="outline" className="ml-2">{mark}</Badge>)}
                            </>
                          )}
                          aired={relativeAirDate(episode.airDate, now)}
                          file={episode.file?.quality == null ? undefined : <Badge>{episode.file.quality}</Badge>}
                          state={(
                            <>
                              {word !== null
                                ? <Badge variant={stateLook(word, live)}>{word}</Badge>
                                : upcoming && <Badge variant="outline">Not out yet</Badge>}
                              {versionCount > 1 && <Badge>{`${versionCount} versions`}</Badge>}
                              {statusOf(rowKey)}
                            </>
                          )}
                          monitored={episode.monitored}
                          upcoming={upcoming}
                          actions={(
                            <>
                              <IconAction
                                label="Search automatically"
                                icon={<Search className="text-muted-foreground" />}
                                onClick={() => void search(rowKey, { service: 'sonarr', kind: 'episodes', episodeIds: [episode.id] })}
                              />
                              <IconAction
                                label="Pick a release"
                                icon={<List className="text-muted-foreground" />}
                                pressed={pickOpen(rowKey)}
                                onClick={() => openPick(rowKey, pickTarget(episode), pickTitle(episode))}
                              />
                              <IconAction
                                label={detailsOpen ? 'Hide details' : 'Details'}
                                icon={detailsOpen ? <ChevronUp className="text-foreground" /> : <Ellipsis className="text-muted-foreground" />}
                                pressed={detailsOpen}
                                onClick={() => setPanel(detailsOpen ? null : { key: rowKey, panel: 'details' })}
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
                              onSecondVersions={onSecondVersions}
                              profile={detail.qualityProfile?.name ?? null}
                              seriesPath={detail.path}
                              onClose={() => {
                                setPanel(null);
                                focusRow(rowKey);
                              }}
                              onUnauthenticated={onUnauthenticated}
                            />
                          </CollapsiblePrimitive.Panel>
                        </Collapsible>
                        {pickBand(rowKey)}
                      </Fragment>
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
