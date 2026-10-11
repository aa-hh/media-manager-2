import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatBytes } from '../downloads/model';
import type { EpisodeDetail, SeriesDetail } from '../library/api';
import { progressText } from '../library/grid';
import { downloadingEpisodes, type SubjectProgress } from '../library/progress';
import { PickRelease, type ReleaseTarget } from '../PickRelease';
import { episodeMarks, episodeWord, relativeAirDate, seasonAiredState, seasonMonitoredState } from './rows';
import { ActionButton, Bookmark, sendAction } from './TitleHeader';

// One inline panel at a time, keyed by row so live progress updates never close it.
export type Panel = { key: string; panel: 'pick'; target: ReleaseTarget; title: string } | { key: string; panel: 'details' };

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

export function EpisodeRows({ detail, protectedIds, progress, onUnauthenticated }: {
  detail: SeriesDetail;
  protectedIds: Set<number>;
  progress: Map<string, SubjectProgress>;
  onUnauthenticated: () => void;
}) {
  const seasons = [...detail.seasons].sort((a, b) => b.seasonNumber - a.seasonNumber);
  const [open, setOpen] = useState<Set<number>>(() => new Set(seasons.length === 0 ? [] : [seasons[0].seasonNumber]));
  const [panel, setPanel] = useState<Panel | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, 'sent' | 'failed'>>({});
  const now = Date.now();
  const seriesId = detail.id;

  const toggleOpen = (seasonNumber: number) => {
    const next = new Set(open);
    if (next.has(seasonNumber)) next.delete(seasonNumber);
    else next.add(seasonNumber);
    setOpen(next);
  };
  const openPick = (key: string, target: ReleaseTarget, title: string) => {
    setSelected(key);
    setPanel(panel?.key === key && panel.panel === 'pick' ? null : { key, panel: 'pick', target, title });
  };
  const search = async (key: string, body: unknown) => {
    const ok = await sendAction('/api/library/search', body, onUnauthenticated);
    setSent((current) => ({ ...current, [key]: ok ? 'sent' : 'failed' }));
  };
  const dimmed = (key: string) => panel !== null && panel.key !== key;
  const sentText = (key: string) => {
    if (sent[key] === 'sent') return <span role="status" className="text-[var(--mm-ink-2)]">search sent</span>;
    if (sent[key] === 'failed') return <span role="alert" className="text-[var(--mm-risk)]">Sonarr didn't answer.</span>;
    return null;
  };

  if (seasons.length === 0) return <p className="mt-8 font-ui text-[14px] text-[var(--mm-ink-2)]">Sonarr has no episodes for this show yet.</p>;

  return (
    <ul aria-label="Seasons" className="mt-8 border-t border-[var(--mm-seam)] font-ui text-[14px]">
      {seasons.map((season) => {
        const key = seasonKey(season.seasonNumber);
        const episodes = detail.episodes.filter((episode) => episode.seasonNumber === season.seasonNumber);
        const isOpen = open.has(season.seasonNumber);
        const label = season.seasonNumber === 0 ? 'Specials' : `Season ${season.seasonNumber}`;
        const downloading = downloadingEpisodes(progress, episodes.map((episode) => episode.id));
        const monitored = seasonMonitoredState(episodes);
        return (
          <li key={key}>
            <div
              onClick={() => setSelected(key)}
              className={cn(
                'group flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--mm-seam)] bg-[var(--mm-row-alt)] px-3 py-1',
                selected === key && 'bg-[var(--mm-row-hover)]',
                dimmed(key) && 'opacity-35',
              )}
            >
              <Bookmark state={monitored} />
              <button type="button" aria-expanded={isOpen} onClick={() => toggleOpen(season.seasonNumber)} className={cn('font-semibold', monitored === 'none' && 'text-[var(--mm-ink-2)]')}>
                {label}
              </button>
              <Chip>{airedLabels[seasonAiredState(episodes, now)]}</Chip>
              <span className="font-data text-[13px] text-[var(--mm-ink-2)]">
                {progressText(season.statistics.episodeFileCount, downloading, season.statistics.episodeCount)}
              </span>
              <span className="font-data text-[13px] text-[var(--mm-ink-2)]">{formatBytes(season.statistics.sizeOnDisk)}</span>
              {sentText(key)}
              <div className={cn('ml-auto flex gap-2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100', (selected === key || panel?.key === key) && 'opacity-100')}>
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
                  const active = selected === rowKey || panel?.key === rowKey;
                  return (
                    <li key={rowKey}>
                      <div
                        tabIndex={0}
                        aria-selected={selected === rowKey}
                        onClick={() => setSelected(rowKey)}
                        className={cn(
                          'group flex min-h-[34px] flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--mm-seam)] px-3 py-1 font-data text-[13px]',
                          active ? 'bg-[var(--mm-row-hover)]' : index % 2 === 0 ? 'bg-[var(--mm-row)]' : 'bg-[var(--mm-row-alt)]',
                          'focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-[var(--mm-ink)]',
                          dimmed(rowKey) && 'opacity-35',
                        )}
                      >
                        <Bookmark state={episode.monitored ? 'all' : 'none'} />
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
                        <div className={cn('flex gap-2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100', active && 'opacity-100')}>
                          <ActionButton onClick={() => void search(rowKey, { service: 'sonarr', kind: 'episodes', episodeIds: [episode.id] })}>Search automatically</ActionButton>
                          <ActionButton
                            onClick={() => openPick(
                              rowKey,
                              { service: 'sonarr', kind: 'episode', seriesId, episodeId: episode.id },
                              `${detail.title} S${String(episode.seasonNumber).padStart(2, '0')}E${String(episode.episodeNumber).padStart(2, '0')}`,
                            )}
                          >
                            Pick a release
                          </ActionButton>
                        </div>
                      </div>
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
  );
}
