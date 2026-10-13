import { useState, type KeyboardEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OptionRow } from '@/components/ui/option-row';
import { PanelInline } from '@/components/ui/panel-inline';
import { Radio, RadioGroup } from '@/components/ui/radio';
import { formatBytes } from '../downloads/model';
import type { DownloadsState } from '../downloads/useDownloads';
import type { EpisodeDetail, SeriesDetail } from '../library/api';
import type { SubjectProgress } from '../library/progress';
import { EpisodeRows, type MonitorChange } from './EpisodeRows';
import { History } from './History';
import { episodeWord } from './rows';
import { episodeCode as code, sendAction, TitleHeader, type TitleFact } from './TitleHeader';

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

const aired = (episode: EpisodeDetail, now: number) => episode.airDate !== null && Date.parse(episode.airDate) <= now;

// The monitoring choices Sonarr offers for a whole show, applied here as episode changes through the monitor endpoint.
const scopes: Array<{ value: string; title: string; description: string; wants: (episode: EpisodeDetail, now: number) => boolean }> = [
  { value: 'all', title: 'All episodes', description: 'Every episode, aired and future.', wants: () => true },
  { value: 'future', title: 'Future episodes', description: 'Only episodes that have not aired yet.', wants: (episode, now) => !aired(episode, now) },
  { value: 'missing', title: 'Missing episodes', description: 'Aired episodes without a file, plus future ones.', wants: (episode) => !episode.hasFile },
  { value: 'existing', title: 'Existing episodes', description: 'Episodes that already have a file, plus future ones.', wants: (episode, now) => episode.hasFile || !aired(episode, now) },
  { value: 'firstSeason', title: 'First season', description: 'Only Season 1.', wants: (episode) => episode.seasonNumber === 1 },
  { value: 'none', title: 'None', description: 'Nothing is monitored. Files stay on disk.', wants: () => false },
];

function MonitoringPanel({ open, episodes, onApply, onClose }: {
  open: boolean;
  episodes: EpisodeDetail[];
  onApply: (on: number[], off: number[]) => void;
  onClose: () => void;
}) {
  const [scope, setScope] = useState('all');
  const now = Date.now();
  // Specials stay as they are, as in Sonarr.
  const regular = episodes.filter((episode) => episode.seasonNumber > 0);
  const chosen = scopes.find((candidate) => candidate.value === scope) ?? scopes[0];
  const wanted = regular.filter((episode) => chosen.wants(episode, now));
  const seasons = new Set(wanted.map((episode) => episode.seasonNumber)).size;
  const option = (candidate: typeof scopes[number]) => (
    <OptionRow key={candidate.value} control={<Radio value={candidate.value} />} title={candidate.title} description={candidate.description} />
  );
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    onClose();
  };
  return (
    <div onKeyDown={onKeyDown}>
      <PanelInline
        open={open}
        title="Change monitoring"
        onClose={onClose}
        primary={(
          <Button
            size="large"
            onClick={() => onApply(
              wanted.filter((episode) => !episode.monitored).map((episode) => episode.id),
              regular.filter((episode) => episode.monitored && !chosen.wants(episode, now)).map((episode) => episode.id),
            )}
          >
            Apply monitoring
          </Button>
        )}
        secondary={<Button variant="outline" onClick={onClose}>Cancel</Button>}
        hint={`Monitors ${wanted.length} episode${wanted.length === 1 ? '' : 's'} across ${seasons} season${seasons === 1 ? '' : 's'}`}
      >
        <RadioGroup value={scope} onValueChange={(value) => setScope(String(value))} aria-label="Monitor" className="flex gap-6 px-5 py-4">
          <div className="flex flex-1 flex-col">{scopes.slice(0, 3).map(option)}</div>
          <div className="flex flex-1 flex-col">{scopes.slice(3).map(option)}</div>
        </RadioGroup>
      </PanelInline>
    </div>
  );
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export function SeriesOverview({ detail: loaded, protectedIds, downloads, progress, onUnauthenticated }: {
  detail: SeriesDetail;
  protectedIds: Set<number>;
  downloads: DownloadsState;
  progress: Map<string, SubjectProgress>;
  onUnauthenticated: () => void;
}) {
  const [detail, setDetail] = useState(loaded);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [changing, setChanging] = useState(false);
  const [pickRequest, setPickRequest] = useState(0);
  const seriesId = detail.id;
  const now = Date.now();

  // Optimistic: the bookmark flips at once and flips back with a reason if Sonarr refuses.
  const monitor = async (change: MonitorChange, problemKey: string) => {
    const previous = detail;
    setDetail((current) => apply(current, change));
    setProblems((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== problemKey)));
    const chunks = change.kind !== 'episodes' ? [] : Array.from(
      { length: Math.ceil(change.episodeIds.length / MAX_EPISODE_IDS) },
      (_, index) => change.episodeIds.slice(index * MAX_EPISODE_IDS, (index + 1) * MAX_EPISODE_IDS),
    );
    const bodies = change.kind === 'series'
      ? [{ service: 'sonarr', kind: 'series', seriesId, monitored: change.monitored }]
      : change.kind === 'season'
        ? [{ service: 'sonarr', kind: 'season', seriesId, seasonNumber: change.seasonNumber, monitored: change.monitored }]
        : chunks.map((episodeIds) => ({ service: 'sonarr', kind: 'episodes', episodeIds, monitored: change.monitored }));
    const results = await Promise.all(bodies.map((body) => sendAction('/api/library/monitor', body, onUnauthenticated)));
    if (results.every(Boolean)) return;
    // Only the chunks Sonarr refused flip back; the ones it accepted are already true on its side.
    const refused = change.kind !== 'episodes' ? change : { ...change, episodeIds: chunks.filter((_, index) => !results[index]).flat() };
    setDetail((current) => apply(current, refused, previous));
    setProblems((current) => ({ ...current, [problemKey]: "Sonarr didn't answer." }));
  };

  const regular = detail.episodes.filter((episode) => episode.seasonNumber > 0);
  const monitoredCount = regular.filter((episode) => episode.monitored).length;
  const downloading = detail.episodes.filter((episode) => progress.get(`episode:${episode.id}`)?.percent != null);
  const missing = detail.episodes.filter((episode) => episodeWord(episode, progress.get(`episode:${episode.id}`), protectedIds, now) === 'Missing');
  const { statistics } = detail;
  const facts: TitleFact[] = [
    {
      label: 'Monitoring',
      value: !detail.monitored ? 'Not monitored'
        : monitoredCount === regular.length ? 'All episodes'
          : monitoredCount === 0 ? 'No episodes' : `${monitoredCount} of ${plural(regular.length, 'episode')}`,
    },
    ...(detail.monitorNewItems === null ? [] : [{ label: 'New seasons', value: detail.monitorNewItems === 'all' ? 'Monitored' : detail.monitorNewItems === 'none' ? 'Not monitored' : detail.monitorNewItems }]),
    ...(detail.qualityProfile === null ? [] : [{ label: 'Quality profile', value: detail.qualityProfile.name }]),
    { label: 'Episodes', value: `${statistics.episodeFileCount} of ${statistics.episodeCount} on disk` },
    { label: 'On disk', value: statistics.episodeFileCount === 0 ? 'Nothing yet' : `${formatBytes(statistics.sizeOnDisk)} · ${plural(statistics.episodeFileCount, 'file')}` },
  ];
  const live = downloading.length === 1 ? progress.get(`episode:${downloading[0].id}`) : undefined;
  const badges = (
    <>
      <Badge variant="strong">In library · {statistics.episodeFileCount} of {plural(statistics.episodeCount, 'episode')}</Badge>
      {downloading.length > 0 && (
        <Badge variant="live" percent={live?.percent ?? undefined}>
          {downloading.length === 1 ? `Downloading ${code(downloading[0])}${live?.percent == null ? '' : ` ${live.percent}%`}` : `Downloading ${plural(downloading.length, 'episode')}`}
        </Badge>
      )}
      {missing.length > 0 && <Badge variant="warning">{missing.length === 1 ? `Missing ${code(missing[0])}` : `Missing ${plural(missing.length, 'episode')}`}</Badge>}
    </>
  );

  return (
    <>
      <TitleHeader
        subject={{ type: 'tv', detail }}
        owned
        badges={badges}
        facts={facts}
        onPick={() => setPickRequest((count) => count + 1)}
        onChangeMonitoring={() => setChanging(!changing)}
        monitored={detail.monitored ? 'all' : 'none'}
        onToggleMonitored={() => void monitor({ kind: 'series', monitored: !detail.monitored }, 'show')}
        monitorProblem={problems.show}
        history={<History query={`service=sonarr&seriesId=${seriesId}`} service="Sonarr" onUnauthenticated={onUnauthenticated} />}
        onUnauthenticated={onUnauthenticated}
      />
      <div className="flex flex-col gap-4 pt-2 pb-10">
        <MonitoringPanel
          open={changing}
          episodes={detail.episodes}
          onClose={() => setChanging(false)}
          onApply={(on, off) => {
            setChanging(false);
            if (on.length > 0) void monitor({ kind: 'episodes', episodeIds: on, monitored: true }, 'show');
            if (off.length > 0) void monitor({ kind: 'episodes', episodeIds: off, monitored: false }, 'show');
          }}
        />
        <EpisodeRows
          detail={detail}
          pickRequest={pickRequest}
          snapshot={downloads.kind === 'ready' ? downloads.snapshot : undefined}
          protectedIds={protectedIds}
          progress={progress}
          problems={problems}
          onMonitor={(change, problemKey) => void monitor(change, problemKey)}
          onSecondVersions={(next) => setDetail((current) => ({
            ...current,
            secondVersions: typeof next === 'function' ? next(current.secondVersions ?? []) : next,
          }))}
          onUnauthenticated={onUnauthenticated}
        />
      </div>
    </>
  );
}
