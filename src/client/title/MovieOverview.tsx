import { useState } from 'react';
import type { DownloadsState } from '../downloads/useDownloads';
import type { MovieDetail } from '../library/api';
import { seedingFacts, type SubjectProgress } from '../library/progress';
import { PickRelease, type ReleaseTarget } from '../PickRelease';
import { VersionTable } from './EpisodeDetails';
import { History } from './History';
import { movieWord } from './rows';
import { ActionButton, sendAction, TitleHeader } from './TitleHeader';

export function MovieOverview({ detail: loaded, downloads, progress, onUnauthenticated }: {
  detail: MovieDetail;
  downloads: DownloadsState;
  progress: Map<string, SubjectProgress>;
  onUnauthenticated: () => void;
}) {
  const [detail, setDetail] = useState(loaded);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [picking, setPicking] = useState(false);
  // Held in state so live progress redraws never hand Pick a release a new target, which would search again.
  const [target] = useState<ReleaseTarget>({ service: 'radarr', kind: 'movie', movieId: loaded.id });
  const snapshot = downloads.kind === 'ready' ? downloads.snapshot : undefined;

  // Optimistic: the bookmark flips at once and flips back with a reason if Radarr refuses.
  const toggleMonitored = async () => {
    const monitored = !detail.monitored;
    setDetail((current) => ({ ...current, monitored }));
    setProblem(undefined);
    if (await sendAction('/api/library/monitor', { service: 'radarr', kind: 'movie', movieId: detail.id, monitored }, onUnauthenticated)) return;
    setDetail((current) => ({ ...current, monitored: !monitored }));
    setProblem("Radarr didn't answer.");
  };

  return (
    <>
      <TitleHeader
        subject={{ type: 'movie', detail }}
        owned
        statusWord={movieWord(detail, progress.get(`movie:${detail.id}`))}
        monitored={detail.monitored ? 'all' : 'none'}
        onToggleMonitored={() => void toggleMonitored()}
        monitorProblem={problem}
        history={<History query={`service=radarr&movieId=${detail.id}`} service="Radarr" onUnauthenticated={onUnauthenticated} />}
        onUnauthenticated={onUnauthenticated}
      />
      <div className="mt-5 flex gap-2">
        <ActionButton onClick={() => setPicking(!picking)}>{picking ? 'Close Pick a release' : 'Pick a release'}</ActionButton>
      </div>
      {picking && (
        // Pick a release keeps its light styling, so it sits on a light surface.
        <div className="mt-3 bg-[var(--control)] pb-2 text-[var(--ink)]">
          <PickRelease target={target} title={detail.title} episodes={[]} movieHasFile={detail.hasFile} onClose={() => setPicking(false)} onUnauthenticated={onUnauthenticated} />
        </div>
      )}
      {/* Hand-off to AA-32: second version row and delete. */}
      <VersionTable label="Your file" file={detail.file} seeding={snapshot === undefined ? [] : seedingFacts(snapshot, { movieId: detail.id })} />
    </>
  );
}
