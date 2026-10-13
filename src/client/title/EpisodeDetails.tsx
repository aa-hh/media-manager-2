import type { KeyboardEvent, SetStateAction } from 'react';
import { FactRow } from '@/components/ui/fact';
import { RowEpisodeDetails } from '@/components/ui/row-episode-details';
import { RowHistoryHeader } from '@/components/ui/row-history';
import { RowSecondVersion, RowSecondVersionHeader } from '@/components/ui/row-second-version';
import { SkeletonRow } from '@/components/ui/skeleton';
import { formatBytes } from '../downloads/model';
import type { EpisodeDetail, FileDetail, SecondVersion, TrackedHitAndRun } from '../library/api';
import type { SeedingFact } from '../library/progress';
import { historyEmpty, historyRows, useTitleHistory } from './History';
import { hitAndRunText } from './secondVersionText';
import { SecondVersionRows, seedingLook, StatusChip } from './SecondVersions';
import { episodeCode } from './TitleHeader';

const dayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const day = (iso: string | null) => {
  const time = iso === null ? Number.NaN : Date.parse(iso);
  return Number.isNaN(time) ? '' : dayFormat.format(time);
};

const releaseName = (file: FileDetail) => {
  const name = file.relativePath?.split('/').pop() ?? '';
  return name.replace(/\.[^.]+$/, '');
};

// HDR, audio, languages and custom formats of a file, for the second line of its version row.
const fileDetail = (file: FileDetail) => {
  const media = file.mediaInfo;
  const audio = [media?.audioCodec ?? '', media?.audioChannels == null ? '' : String(media.audioChannels)].filter((part) => part !== '').join(' ');
  const text = [media?.videoDynamicRangeType ?? '', audio, file.languages.join(', '), file.customFormats.join(', ')]
    .filter((part) => part !== '').join(' · ');
  return text === '' ? undefined : text;
};

// The file Sonarr or Radarr tracks, as the tracked-version row; movies use the same row at the top of their table.
// `hitAndRun` is the rule against the torrent behind its newest import, when this app grabbed it.
export function TrackedVersion({ file, seeding, hitAndRun, inset }: { file: FileDetail; seeding: SeedingFact[]; hitAndRun: TrackedHitAndRun['hitAndRun'] | null; inset: boolean }) {
  const fact = seeding[0];
  return (
    <RowSecondVersion
      tracked
      inset={inset}
      release={releaseName(file)}
      group={file.releaseGroup}
      detail={fileDetail(file)}
      hitAndRun={hitAndRunText(hitAndRun)}
      tracker={fact?.trackerHost ?? hitAndRun?.host ?? ''}
      status={fact === undefined ? undefined : <StatusChip look={fact.complete ? seedingLook(hitAndRun) : { label: 'Downloading', circle: 'downloading' }} />}
      quality={file.quality ?? ''}
      size={formatBytes(file.size)}
    />
  );
}

export function EpisodeDetails({ episode, seeding, hitAndRun, secondVersions, onSecondVersions, profile, seriesPath, onClose, onUnauthenticated }: {
  episode: EpisodeDetail;
  seeding: SeedingFact[];
  hitAndRun: TrackedHitAndRun['hitAndRun'] | null;
  /** This episode's second versions. */
  secondVersions: SecondVersion[];
  /** Takes the series' whole list, as the delete reply gives it, or an update to it. */
  onSecondVersions: (next: SetStateAction<SecondVersion[]>) => void;
  profile: string | null;
  seriesPath: string | null;
  onClose: () => void;
  onUnauthenticated: () => void;
}) {
  const { load: history, retry } = useTitleHistory(`service=sonarr&episodeId=${episode.id}`, onUnauthenticated);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    onClose();
  };
  const file = episode.file;
  const folder = file?.relativePath?.split('/').slice(0, -1).join('/');
  const fit = file === null ? 'no file' : file.qualityCutoffNotMet ? 'below cutoff' : 'cutoff met';
  const details = [
    <FactRow key="aired" label="Aired">
      {[day(episode.airDate), episode.runtime === null || episode.runtime <= 0 ? '' : `${episode.runtime} min`].filter((part) => part !== '').join(' · ') || '–'}
    </FactRow>,
    <FactRow key="monitored" label="Monitored">{episode.monitored ? 'Yes' : 'No'}</FactRow>,
    <FactRow key="last-search" label="Last search">{episode.lastSearchTime === null ? 'Never' : day(episode.lastSearchTime) || '–'}</FactRow>,
    ...(profile === null ? [] : [<FactRow key="profile" label="Quality profile">{`${profile} · ${fit}`}</FactRow>]),
    ...(folder === undefined || folder === '' ? [] : [
      <FactRow key="folder" label="Folder"><span className="[overflow-wrap:anywhere]">{[seriesPath, folder].filter((part) => part !== null).join('/')}</span></FactRow>,
    ]),
  ];
  return (
    <RowEpisodeDetails
      onKeyDown={onKeyDown}
      overview={episode.overview ?? undefined}
      stillUrl={episode.imageUrl ?? undefined}
      details={details}
      versions={file === null && secondVersions.length === 0 ? undefined : (
        <>
          <RowSecondVersionHeader inset />
          {file !== null && <TrackedVersion file={file} seeding={seeding} hitAndRun={hitAndRun} inset />}
          <SecondVersionRows
            versions={secondVersions}
            inset
            subject={episodeCode(episode)}
            trackedQuality={file?.quality ?? null}
            onChanged={onSecondVersions}
            onUnauthenticated={onUnauthenticated}
          />
        </>
      )}
      versionsEmpty={file === null && secondVersions.length === 0 ? 'No file yet.' : undefined}
      historyCount={history.kind === 'ready' ? history.entries.length : undefined}
      history={history.kind === 'loading'
        ? <SkeletonRow />
        : history.kind === 'ready' && history.entries.length > 0 ? <><RowHistoryHeader />{historyRows(history.entries)}</> : undefined}
      historyEmpty={historyEmpty(history, 'Sonarr', retry)}
    />
  );
}
