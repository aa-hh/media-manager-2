import { useState } from 'react';
import type { DownloadsState } from '../downloads/useDownloads';
import type { SeriesDetail } from '../library/api';
import type { SubjectProgress } from '../library/progress';
import { EpisodeRows, type MonitorChange } from './EpisodeRows';
import { sendAction, TitleHeader } from './TitleHeader';

const MAX_EPISODE_IDS = 100;

// Applies a monitoring change locally; `previous` restores exactly what the change touched.
const apply = (detail: SeriesDetail, change: MonitorChange, previous?: SeriesDetail): SeriesDetail => {
  const before = previous ?? detail;
  if (change.kind === 'series') return { ...detail, monitored: previous === undefined ? change.monitored : before.monitored };
  const touched = (episode: SeriesDetail['episodes'][number]) => (
    change.kind === 'season' ? episode.seasonNumber === change.seasonNumber : change.episodeIds.includes(episode.id)
  );
  const was = new Map(before.episodes.map((episode) => [episode.id, episode.monitored]));
  const seasonWas = new Map(before.seasons.map((season) => [season.seasonNumber, season.monitored]));
  return {
    ...detail,
    seasons: change.kind !== 'season' ? detail.seasons : detail.seasons.map((season) => (
      season.seasonNumber === change.seasonNumber
        ? { ...season, monitored: previous === undefined ? change.monitored : seasonWas.get(season.seasonNumber) ?? season.monitored }
        : season
    )),
    episodes: detail.episodes.map((episode) => (
      touched(episode) ? { ...episode, monitored: previous === undefined ? change.monitored : was.get(episode.id) ?? episode.monitored } : episode
    )),
  };
};

export function SeriesOverview({ detail: loaded, protectedIds, progress, onUnauthenticated }: {
  detail: SeriesDetail;
  protectedIds: Set<number>;
  downloads: DownloadsState;
  progress: Map<string, SubjectProgress>;
  onUnauthenticated: () => void;
}) {
  const [detail, setDetail] = useState(loaded);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const seriesId = detail.id;

  // Optimistic: the bookmark flips at once and flips back with a reason if Sonarr refuses.
  const monitor = async (change: MonitorChange, problemKey: string) => {
    const previous = detail;
    setDetail((current) => apply(current, change));
    setProblems((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== problemKey)));
    const bodies = change.kind === 'series'
      ? [{ service: 'sonarr', kind: 'series', seriesId, monitored: change.monitored }]
      : change.kind === 'season'
        ? [{ service: 'sonarr', kind: 'season', seriesId, seasonNumber: change.seasonNumber, monitored: change.monitored }]
        : Array.from({ length: Math.ceil(change.episodeIds.length / MAX_EPISODE_IDS) }, (_, index) => ({
          service: 'sonarr', kind: 'episodes', episodeIds: change.episodeIds.slice(index * MAX_EPISODE_IDS, (index + 1) * MAX_EPISODE_IDS), monitored: change.monitored,
        }));
    const results = await Promise.all(bodies.map((body) => sendAction('/api/library/monitor', body, onUnauthenticated)));
    if (results.every(Boolean)) return;
    setDetail((current) => apply(current, change, previous));
    setProblems((current) => ({ ...current, [problemKey]: "Sonarr didn't answer." }));
  };

  return (
    <>
      <TitleHeader
        subject={{ type: 'tv', detail }}
        owned
        monitored={detail.monitored ? 'all' : 'none'}
        onToggleMonitored={() => void monitor({ kind: 'series', monitored: !detail.monitored }, 'show')}
        monitorProblem={problems.show}
        onUnauthenticated={onUnauthenticated}
      />
      <EpisodeRows
        detail={detail}
        protectedIds={protectedIds}
        progress={progress}
        problems={problems}
        onMonitor={(change, problemKey) => void monitor(change, problemKey)}
        onUnauthenticated={onUnauthenticated}
      />
    </>
  );
}
