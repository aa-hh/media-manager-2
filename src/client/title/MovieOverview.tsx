import { useState } from 'react';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { LabelGroup } from '@/components/ui/label-group';
import { Table } from '@/components/ui/table';
import { formatBytes } from '../downloads/model';
import type { DownloadsState } from '../downloads/useDownloads';
import type { MovieDetail } from '../library/api';
import { seedingFacts, type SubjectProgress } from '../library/progress';
import { PickRelease, type ReleaseTarget } from '../PickRelease';
import { statusLabel } from '../Search';
import { TrackedVersion } from './EpisodeDetails';
import { History } from './History';
import { movieWord } from './rows';
import { sendAction, TitleHeader, type TitleFact } from './TitleHeader';

const wordLook = (word: string, live: boolean): BadgeVariant => {
  if (live) return 'live';
  if (word === 'deleted') return 'risk';
  if (word === 'missing' || word === 'below cutoff') return 'warning';
  return 'neutral';
};

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
  const live = progress.get(`movie:${detail.id}`);
  const word = movieWord(detail, live);

  // Optimistic: the bookmark flips at once and flips back with a reason if Radarr refuses.
  const toggleMonitored = async () => {
    const monitored = !detail.monitored;
    setDetail((current) => ({ ...current, monitored }));
    setProblem(undefined);
    if (await sendAction('/api/library/monitor', { service: 'radarr', kind: 'movie', movieId: detail.id, monitored }, onUnauthenticated)) return;
    setDetail((current) => ({ ...current, monitored: !monitored }));
    setProblem("Radarr didn't answer.");
  };

  const availableWhen = statusLabel(detail.minimumAvailability);
  const file = detail.file === null ? '' : [detail.file.quality, detail.file.releaseGroup].filter((part) => part !== null && part !== '').join(' · ');
  const facts: TitleFact[] = [
    { label: 'Monitoring', value: detail.monitored ? 'Monitored' : 'Not monitored' },
    ...(availableWhen === null ? [] : [{ label: 'Available when', value: availableWhen }]),
    ...(detail.qualityProfile === null ? [] : [{ label: 'Quality profile', value: detail.qualityProfile.name }]),
    ...(file === '' ? [] : [{ label: 'File', value: file }]),
    { label: 'On disk', value: detail.hasFile ? `${formatBytes(detail.sizeOnDisk)} · 1 file` : 'Nothing yet' },
  ];

  return (
    <>
      <TitleHeader
        subject={{ type: 'movie', detail }}
        owned
        compact={picking}
        badges={(
          <>
            <Badge variant="strong">In library</Badge>
            {word !== null && <Badge variant={wordLook(word, live !== undefined)}>{word.charAt(0).toUpperCase() + word.slice(1)}</Badge>}
          </>
        )}
        facts={facts}
        onPick={() => setPicking(!picking)}
        picking={picking}
        monitored={detail.monitored ? 'all' : 'none'}
        onToggleMonitored={() => void toggleMonitored()}
        monitorProblem={problem}
        onUnauthenticated={onUnauthenticated}
      />
      {picking && (
        <div className="pt-2">
          <PickRelease target={target} title={detail.title} episodes={[]} movieHasFile={detail.hasFile} onClose={() => setPicking(false)} onUnauthenticated={onUnauthenticated} />
        </div>
      )}
      {/* Hand-off to AA-32: second version row and delete. */}
      <div className="flex flex-col pt-2 pb-10">
        <LabelGroup count={detail.file === null ? 0 : 1}>Versions</LabelGroup>
        <Table>
          {detail.file === null
            ? <p className="m-0 flex h-(--row) items-center px-4 font-ui text-sm text-muted-foreground">No file yet.</p>
            : <TrackedVersion file={detail.file} seeding={snapshot === undefined ? [] : seedingFacts(snapshot, { movieId: detail.id })} indent />}
        </Table>
        <History query={`service=radarr&movieId=${detail.id}`} service="Radarr" onUnauthenticated={onUnauthenticated} />
      </div>
    </>
  );
}
