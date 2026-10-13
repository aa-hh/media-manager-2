import { Suspense, useState, type SetStateAction } from 'react';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { CollapsibleContent } from '@/components/ui/collapsible-content';
import { Collapsible } from '@/components/ui/collapsible-trigger';
import { LabelGroup } from '@/components/ui/label-group';
import { RowSecondVersionHeader } from '@/components/ui/row-second-version';
import { Table } from '@/components/ui/table';
import { formatBytes } from '../downloads/model';
import type { DownloadsState } from '../downloads/useDownloads';
import type { OwnedMovieDetail, SecondVersion } from '../library/api';
import { seedingFacts, type SubjectProgress } from '../library/progress';
import { lazyScreen } from '../lazyScreen';
import { statusLabel } from '../Search';
import { TrackedVersion } from './EpisodeDetails';
import { History } from './History';
import { movieWord } from './rows';
import { SecondVersionRows } from './SecondVersions';
import { sendAction, TitleHeader, type TitleFact } from './TitleHeader';

const PickRelease = lazyScreen(() => import('../PickRelease').then((module) => module.PickRelease));

const wordLook = (word: string, live: boolean): BadgeVariant => {
  if (live) return 'live';
  if (word === 'deleted') return 'risk';
  if (word === 'missing' || word === 'below cutoff') return 'warning';
  return 'neutral';
};

export function MovieOverview({ detail: loaded, downloads, progress, onUnauthenticated }: {
  detail: OwnedMovieDetail;
  downloads: DownloadsState;
  progress: Map<string, SubjectProgress>;
  onUnauthenticated: () => void;
}) {
  const [detail, setDetail] = useState(loaded);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [picking, setPicking] = useState(false);
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

  const setVersions = (next: SetStateAction<SecondVersion[]>) => setDetail((current) => ({
    ...current,
    secondVersions: typeof next === 'function' ? next(current.secondVersions) : next,
  }));
  const imported = detail.secondVersions.filter((version) => version.state === 'imported');
  const versionCount = (detail.file === null ? 0 : 1) + imported.length;
  const fileCount = (detail.hasFile ? 1 : 0) + imported.length;
  const onDisk = detail.sizeOnDisk + imported.reduce((sum, version) => sum + (version.sizeBytes ?? 0), 0);

  const availableWhen = statusLabel(detail.minimumAvailability);
  const file = detail.file === null ? '' : [detail.file.quality, detail.file.releaseGroup].filter((part) => part !== null && part !== '').join(' · ');
  const facts: TitleFact[] = [
    { label: 'Monitoring', value: detail.monitored ? 'Monitored' : 'Not monitored' },
    ...(availableWhen === null ? [] : [{ label: 'Available when', value: availableWhen }]),
    ...(detail.qualityProfile === null ? [] : [{ label: 'Quality profile', value: detail.qualityProfile.name }]),
    ...(file === '' ? [] : [{ label: 'File', value: file }]),
    { label: 'On disk', value: fileCount > 0 ? `${formatBytes(onDisk)} · ${fileCount} ${fileCount === 1 ? 'file' : 'files'}` : 'Nothing yet' },
  ];

  return (
    <>
      <TitleHeader
        subject={{ type: 'movie', detail }}
        owned
        badges={(
          <>
            <Badge variant="strong">{versionCount > 1 ? `In library · ${versionCount} versions` : 'In library'}</Badge>
            {word !== null && <Badge variant={wordLook(word, live !== undefined)} percent={live?.percent ?? undefined}>{word.charAt(0).toUpperCase() + word.slice(1)}</Badge>}
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
      <div className="flex flex-col pt-2 pb-10">
        <LabelGroup count={(detail.file === null ? 0 : 1) + detail.secondVersions.length}>Versions</LabelGroup>
        <Table>
          <RowSecondVersionHeader />
          {detail.file !== null && (
            <TrackedVersion
              file={detail.file}
              seeding={snapshot === undefined ? [] : seedingFacts(snapshot, { movieId: detail.id })}
              hitAndRun={detail.trackedHitAndRun[0]?.hitAndRun ?? null}
              inset={false}
            />
          )}
          <Collapsible open={picking}>
            <CollapsibleContent className="gap-0 p-0">
              <Suspense fallback={null}>
                <PickRelease
                  target={{ service: 'radarr', kind: 'movie', movieId: detail.id }}
                  name={detail.title}
                  episodes={[]}
                  movieHasFile={detail.hasFile}
                  variant="movie"
                  live={live}
                  onClose={() => setPicking(false)}
                  onUnauthenticated={onUnauthenticated}
                />
              </Suspense>
            </CollapsibleContent>
          </Collapsible>
          {detail.file === null && detail.secondVersions.length === 0 && <p className="m-0 flex h-(--row) items-center px-4 font-ui text-sm text-muted-foreground">No file yet.</p>}
          <SecondVersionRows
            versions={detail.secondVersions}
            inset={false}
            subject={detail.title}
            trackedQuality={detail.file?.quality ?? null}
            onChanged={setVersions}
            onUnauthenticated={onUnauthenticated}
          />
        </Table>
        <History query={`service=radarr&movieId=${detail.id}`} service="Radarr" onUnauthenticated={onUnauthenticated} />
      </div>
    </>
  );
}
