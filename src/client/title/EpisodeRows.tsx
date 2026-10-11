import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { cn } from '@/lib/utils';
import { formatBytes, type Snapshot } from '../downloads/model';
import type { EpisodeDetail, SeriesDetail } from '../library/api';
import { progressText } from '../library/grid';
import { downloadingEpisodes, seedingFacts, type SubjectProgress } from '../library/progress';
import { PickRelease, type ReleaseTarget } from '../PickRelease';
import { EpisodeDetails } from './EpisodeDetails';
import { episodeMarks, episodeWord, relativeAirDate, seasonAiredState, seasonMonitoredState } from './rows';
import { moveFocus, rangeBetween, selectionSummary, type RowRef } from './selection';
import { ActionButton, Bookmark, sendAction } from './TitleHeader';

// One inline panel at a time, keyed by row so live progress updates never close it.
export type Panel = { key: string; panel: 'pick'; target: ReleaseTarget; title: string } | { key: string; panel: 'details' };

export type MonitorChange =
  | { kind: 'series'; monitored: boolean }
  | { kind: 'season'; seasonNumber: number; monitored: boolean }
  | { kind: 'episodes'; episodeIds: number[]; monitored: boolean };

const airedLabels = { aired: 'Aired', airing: 'Airing', upcoming: 'Upcoming' } as const;
const seasonKey = (seasonNumber: number) => `season:${seasonNumber}`;
const episodeKey = (id: number) => `episode:${id}`;

function Chip({ children }: { children: string }) {
  return <span className="inline-flex h-5 items-center whitespace-nowrap border border-[var(--mm-ink-3)] px-1.5 font-data text-[12px] text-[var(--mm-ink-2)]">{children}</span>;
}

function PickPanel({ panel, episodes, onClose, onUnauthenticated }: {
  panel: Extract<Panel, { panel: 'pick' }>;
  episodes: EpisodeDetail[];
  onClose: () => void;
  onUnauthenticated: () => void;
}) {
  // Pick a release keeps its light styling, so it sits on a light surface.
  return (
    <div className="bg-[var(--control)] pb-2 text-[var(--ink)]">
      <PickRelease target={panel.target} title={panel.title} episodes={episodes} movieHasFile={false} onClose={onClose} onUnauthenticated={onUnauthenticated} />
    </div>
  );
}

function Problem({ text }: { text: string | undefined }) {
  return text === undefined ? null : <span role="alert" className="font-ui text-[13px] text-[var(--mm-risk)]">{text}</span>;
}

export function EpisodeRows({ detail, snapshot, protectedIds, progress, problems, onMonitor, onUnauthenticated }: {
  detail: SeriesDetail;
  snapshot: Snapshot | undefined;
  protectedIds: Set<number>;
  progress: Map<string, SubjectProgress>;
  problems: Record<string, string>;
  onMonitor: (change: MonitorChange, problemKey: string) => void;
  onUnauthenticated: () => void;
}) {
  const seasons = [...detail.seasons].sort((a, b) => b.seasonNumber - a.seasonNumber);
  const [open, setOpen] = useState<Set<number>>(() => new Set(seasons.length === 0 ? [] : [seasons[0].seasonNumber]));
  const [panel, setPanel] = useState<Panel | null>(null);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [anchorKey, setAnchorKey] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, 'sent' | 'failed'>>({});
  const containerRef = useRef<HTMLUListElement>(null);
  const now = Date.now();
  const seriesId = detail.id;

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

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
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
    if (event.key === 'Escape') {
      if (panel !== null) setPanel(null);
      else {
        setSelected(new Set());
        setAnchorKey(null);
      }
    }
  };

  const toggleOpen = (seasonNumber: number) => {
    const next = new Set(open);
    if (next.has(seasonNumber)) next.delete(seasonNumber);
    else next.add(seasonNumber);
    setOpen(next);
  };
  const openPick = (key: string, target: ReleaseTarget, title: string) => {
    setPanel(panel?.key === key && panel.panel === 'pick' ? null : { key, panel: 'pick', target, title });
  };
  const search = async (key: string, body: unknown) => {
    const ok = await sendAction('/api/library/search', body, onUnauthenticated);
    setSent((current) => ({ ...current, [key]: ok ? 'sent' : 'failed' }));
  };
  const pickTarget = (episode: EpisodeDetail): ReleaseTarget => ({ service: 'sonarr', kind: 'episode', seriesId, episodeId: episode.id });
  const pickTitle = (episode: EpisodeDetail) => `${detail.title} S${String(episode.seasonNumber).padStart(2, '0')}E${String(episode.episodeNumber).padStart(2, '0')}`;
  const dimmed = (key: string) => panel !== null && panel.key !== key;
  const sentText = (key: string) => {
    if (sent[key] === 'sent') return <span role="status" className="text-[var(--mm-ink-2)]">search sent</span>;
    if (sent[key] === 'failed') return <span role="alert" className="text-[var(--mm-risk)]">Sonarr didn't answer.</span>;
    return null;
  };
  const tabStop = (key: string) => (key === (indexOf(focusKey) >= 0 ? focusKey : rows[0]?.key) ? 0 : -1);

  if (seasons.length === 0) return <p className="mt-8 font-ui text-[14px] text-[var(--mm-ink-2)]">Sonarr has no episodes for this show yet.</p>;

  return (
    <>
      <ul ref={containerRef} aria-label="Seasons" onKeyDown={onKeyDown} className="mt-8 border-t border-[var(--mm-seam)] font-ui text-[14px]">
        {seasons.map((season) => {
          const key = seasonKey(season.seasonNumber);
          const episodes = episodesOf(season.seasonNumber);
          const isOpen = open.has(season.seasonNumber);
          const label = season.seasonNumber === 0 ? 'Specials' : `Season ${season.seasonNumber}`;
          const downloading = downloadingEpisodes(progress, episodes.map((episode) => episode.id));
          const monitored = seasonState(season);
          const active = focusKey === key || panel?.key === key;
          return (
            <li key={key}>
              <div
                data-row-key={key}
                tabIndex={tabStop(key)}
                onFocus={(event) => { if (event.target === event.currentTarget) setFocusKey(key); }}
                onClick={(event) => onRowClick(event, key)}
                className={cn(
                  'group flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--mm-seam)] bg-[var(--mm-row-alt)] px-3 py-1',
                  'focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-[var(--mm-ink)]',
                  active && 'bg-[var(--mm-row-hover)]',
                  dimmed(key) && 'opacity-35',
                )}
              >
                <Bookmark state={monitored} onToggle={() => toggleSeason(season.seasonNumber)} />
                <button type="button" tabIndex={-1} aria-expanded={isOpen} onClick={(event) => { event.stopPropagation(); toggleOpen(season.seasonNumber); }} className={cn('font-semibold', monitored === 'none' && 'text-[var(--mm-ink-2)]')}>
                  {label}
                </button>
                <Chip>{airedLabels[seasonAiredState(episodes, now)]}</Chip>
                <span className="font-data text-[13px] text-[var(--mm-ink-2)]">
                  {progressText(season.statistics.episodeFileCount, downloading, season.statistics.episodeCount)}
                </span>
                <span className="font-data text-[13px] text-[var(--mm-ink-2)]">{formatBytes(season.statistics.sizeOnDisk)}</span>
                {sentText(key)}
                <Problem text={problems[key]} />
                <div className={cn('ml-auto flex gap-2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100', active && 'opacity-100')}>
                  <ActionButton onClick={() => void search(key, { service: 'sonarr', kind: 'season', seriesId, seasonNumber: season.seasonNumber })}>Search automatically</ActionButton>
                  <ActionButton onClick={() => openPick(key, { service: 'sonarr', kind: 'season', seriesId, seasonNumber: season.seasonNumber }, `${detail.title} ${label.toLowerCase()}`)}>
                    Pick a release
                  </ActionButton>
                  <ActionButton onClick={() => toggleOpen(season.seasonNumber)}>{isOpen ? 'Collapse' : 'Expand'}</ActionButton>
                </div>
              </div>
              {panel?.key === key && panel.panel === 'pick' && (
                <PickPanel panel={panel} episodes={detail.episodes} onClose={() => setPanel(null)} onUnauthenticated={onUnauthenticated} />
              )}
              {isOpen && (
                <ul aria-label={label}>
                  {episodes.map((episode, index) => {
                    const rowKey = episodeKey(episode.id);
                    const word = episodeWord(episode, progress.get(rowKey), protectedIds, now);
                    const risk = progress.get(rowKey)?.tone === 'risk';
                    const isSelected = selected.has(episode.id);
                    const rowActive = isSelected || focusKey === rowKey || panel?.key === rowKey;
                    return (
                      <li key={rowKey}>
                        <div
                          data-row-key={rowKey}
                          tabIndex={tabStop(rowKey)}
                          aria-selected={isSelected}
                          onFocus={(event) => { if (event.target === event.currentTarget) setFocusKey(rowKey); }}
                          onClick={(event) => onRowClick(event, rowKey)}
                          className={cn(
                            'group flex min-h-[34px] flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--mm-seam)] px-3 py-1 font-data text-[13px] select-none',
                            isSelected ? 'bg-[var(--mm-row-hover)]' : index % 2 === 0 ? 'bg-[var(--mm-row)]' : 'bg-[var(--mm-row-alt)]',
                            'focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-[var(--mm-ink)]',
                            dimmed(rowKey) && 'opacity-35',
                          )}
                        >
                          <Bookmark state={episode.monitored ? 'all' : 'none'} onToggle={() => toggleEpisode(episode)} />
                          <span className="w-6 tabular-nums text-[var(--mm-ink-2)]">{String(episode.episodeNumber).padStart(2, '0')}</span>
                          <span className={cn('min-w-0 flex-1 truncate font-ui text-[14px]', !episode.monitored && 'text-[var(--mm-ink-3)]')}>{episode.title}</span>
                          {episodeMarks(episode).map((mark) => <Chip key={mark}>{mark}</Chip>)}
                          <span className={cn('w-24 text-[var(--mm-ink-2)]', !episode.monitored && 'text-[var(--mm-ink-3)]')}>{relativeAirDate(episode.airDate, now)}</span>
                          {episode.file !== null && (
                            <span className="flex items-center gap-2">
                              {episode.file.quality !== null && <span className="bg-[var(--mm-ink)] px-1.5 text-[12px] text-[var(--mm-on-cell)]">{episode.file.quality}</span>}
                              <span className="text-[var(--mm-ink-2)]">{formatBytes(episode.file.size)}</span>
                            </span>
                          )}
                          {word !== null && <span className={risk ? 'text-[var(--mm-risk)]' : 'text-[var(--mm-ink-2)]'}>{word}</span>}
                          {sentText(rowKey)}
                          <Problem text={problems[rowKey]} />
                          <div className={cn('flex gap-2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100', rowActive && 'opacity-100')}>
                            <ActionButton onClick={() => void search(rowKey, { service: 'sonarr', kind: 'episodes', episodeIds: [episode.id] })}>Search automatically</ActionButton>
                            <ActionButton
                              onClick={() => openPick(rowKey, pickTarget(episode), pickTitle(episode))}
                            >
                              Pick a release
                            </ActionButton>
                            <ActionButton onClick={() => setPanel(panel?.key === rowKey && panel.panel === 'details' ? null : { key: rowKey, panel: 'details' })}>
                              {panel?.key === rowKey && panel.panel === 'details' ? 'Hide details' : 'Details'}
                            </ActionButton>
                          </div>
                        </div>
                        {panel?.key === rowKey && panel.panel === 'details' && (
                          <EpisodeDetails
                            episode={episode}
                            seeding={snapshot === undefined ? [] : seedingFacts(snapshot, { episodeId: episode.id })}
                            onSearch={() => void search(rowKey, { service: 'sonarr', kind: 'episodes', episodeIds: [episode.id] })}
                            onPick={() => openPick(rowKey, pickTarget(episode), pickTitle(episode))}
                            onClose={() => {
                              setPanel(null);
                              focusRow(rowKey);
                            }}
                            onUnauthenticated={onUnauthenticated}
                          />
                        )}
                        {panel?.key === rowKey && panel.panel === 'pick' && (
                          <PickPanel panel={panel} episodes={detail.episodes} onClose={() => setPanel(null)} onUnauthenticated={onUnauthenticated} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {selected.size >= 2 && (
        <div role="region" aria-label="Selection" className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-[var(--mm-seam)] bg-[var(--mm-row-hover)] px-3 py-2 font-ui text-[14px]">
          <span>{selectionSummary(selected, detail.episodes)}</span>
          <ActionButton filled onClick={() => setSelection([...selected], true)}>Monitor</ActionButton>
          <ActionButton onClick={() => setSelection([...selected], false)}>Unmonitor</ActionButton>
          <span className="text-[var(--mm-ink-2)]">Unmonitoring keeps files</span>
        </div>
      )}
    </>
  );
}
