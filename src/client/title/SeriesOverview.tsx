import type { DownloadsState } from '../downloads/useDownloads';
import type { SeriesDetail } from '../library/api';
import type { SubjectProgress } from '../library/progress';
import { EpisodeRows } from './EpisodeRows';
import { TitleHeader } from './TitleHeader';

export function SeriesOverview({ detail, protectedIds, progress, onUnauthenticated }: {
  detail: SeriesDetail;
  protectedIds: Set<number>;
  downloads: DownloadsState;
  progress: Map<string, SubjectProgress>;
  onUnauthenticated: () => void;
}) {
  return (
    <>
      <TitleHeader
        subject={{ type: 'tv', detail }}
        owned
        monitored={detail.monitored ? 'all' : 'none'}
        onUnauthenticated={onUnauthenticated}
      />
      <EpisodeRows detail={detail} protectedIds={protectedIds} progress={progress} onUnauthenticated={onUnauthenticated} />
    </>
  );
}
