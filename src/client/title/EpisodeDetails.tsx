import type { KeyboardEvent, SetStateAction } from 'react';
import { FactRow } from '@/components/ui/fact';
import { RowEpisodeDetails } from '@/components/ui/row-episode-details';
import { RowHistoryHeader } from '@/components/ui/row-history';
import { RowSecondVersion, RowSecondVersionHeader } from '@/components/ui/row-second-version';
import { SkeletonRow } from '@/components/ui/skeleton';
import { formatBytes } from '../downloads/model';
import type { EpisodeDetail, FileDetail, SecondVersion } from '../library/api';
import type { SeedingFact } from '../library/progress';
import { historyEmpty, historyRows, useTitleHistory } from './History';
import { seedingText } from './secondVersionText';
import { SecondVersionRows } from './SecondVersions';
import { episodeCode } from './TitleHeader';

const day = (iso: string | null) => (iso === null ? '' : new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }));

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

// The file Sonarr or Radarr tracks, as the tracked-version row; movies use the same row under their header.
export function TrackedVersion({ file, seeding, indent }: { file: FileDetail; seeding: SeedingFact[]; indent: boolean }) {
  return (
    <RowSecondVersion
      tracked
      indent={indent}
      quality={file.quality ?? ''}
      release={releaseName(file)}
      detail={fileDetail(file)}
      size={formatBytes(file.size)}
      tracker={seeding[0]?.trackerHost ?? ''}
      seeding={seeding.map(seedingText).join('; ')}
    />
  );
}

export function EpisodeDetails({ episode, seeding, secondVersions, onSecondVersions, profile, seriesPath, onClose, onUnauthenticated }: {
  episode: EpisodeDetail;
  seeding: SeedingFact[];
  /** This episode's second versions. */
  secondVersions: SecondVersion[];
  /** Takes the series' whole list, as the delete reply gives it, or an update to it. */
  onSecondVersions: (next: SetStateAction<SecondVersion[]>) => void;
  profile: string | null;
  seriesPath: string | null;
  onClose: () => void;
  onUnauthenticated: () => void;
}) {
  const history = useTitleHistory(`service=sonarr&episodeId=${episode.id}`, onUnauthenticated);
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
    <FactRow key="last-search" label="Last search">{episode.lastSearchTime === null ? 'Never' : day(episode.lastSearchTime)}</FactRow>,
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
      versionCount={(file === null ? 0 : 1) + secondVersions.length}
      versions={file === null && secondVersions.length === 0 ? undefined : (
        <>
          <RowSecondVersionHeader />
          {file !== null && <TrackedVersion file={file} seeding={seeding} indent={false} />}
          <SecondVersionRows
            versions={secondVersions}
            indent={false}
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
      historyEmpty={historyEmpty(history, 'Sonarr')}
    />
  );
}
