import { LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { SelectContent, SelectItem } from '@/components/ui/dropdown-menu';
import { PanelInline } from '@/components/ui/panel-inline';
import { RowImportFile, RowImportFileHeader } from '@/components/ui/row-import-file';
import { RowImportFileGroup } from '@/components/ui/row-import-file-group';
import { Select, SelectTrigger } from '@/components/ui/select-trigger';
import { Table } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { type Assignment, checkAssignments } from '../../server/assignments';
import type { Service } from './model';

type ImportView = {
  title: string;
  reasons: string[];
  target:
    | { kind: 'series'; seriesId: number; episodes: { id: number; code: string; title: string }[] }
    | { kind: 'movie'; movieId: number; title: string };
  files: { path: string; relativePath: string; qualityId: number | null; languageIds: number[]; episodeIds: number[]; movieId: number | null; rejections: string[] }[];
  qualities: { id: number; name: string }[];
  languages: { id: number; name: string }[];
};

type Draft = Assignment & { include: boolean };

// Finish an import by hand: pick the movie or episodes, quality and language per file. The same check runs on the server.
export function ImportPanel({ service, downloadId, onDone, onCancel, onUnauthenticated }: {
  service: Service; downloadId: string; onDone: () => void; onCancel: () => void; onUnauthenticated: () => void;
}) {
  const [view, setView] = useState<ImportView | 'loading' | 'failed'>('loading');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [sending, setSending] = useState(false);
  const [serverReasons, setServerReasons] = useState<string[]>([]);

  useEffect(() => {
    let current = true;
    void fetch(`/api/imports/${service}/${downloadId}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (response.status === 401) {
          onUnauthenticated();
          return;
        }
        if (!response.ok) throw new Error('unreadable');
        const loaded = await response.json() as ImportView;
        if (!current) return;
        setView(loaded);
        setDrafts(loaded.files.map((file) => ({
          path: file.path,
          include: true,
          episodeIds: loaded.target.kind === 'series' ? file.episodeIds : [],
          movieId: loaded.target.kind === 'movie' ? file.movieId ?? loaded.target.movieId : null,
          qualityId: file.qualityId,
          languageIds: file.languageIds,
        })));
      })
      .catch(() => { if (current) setView('failed'); });
    return () => { current = false; };
  }, [service, downloadId, onUnauthenticated]);

  const chosen = useMemo(() => drafts.filter((draft) => draft.include), [drafts]);
  const reasons = useMemo(() => {
    if (typeof view === 'string') return [];
    const target = view.target.kind === 'series'
      ? { kind: 'series' as const, episodeIds: view.target.episodes.map((episode) => episode.id) }
      : { kind: 'movie' as const, movieId: view.target.movieId };
    return checkAssignments(chosen, target, {
      paths: view.files.map((file) => file.path),
      qualityIds: view.qualities.map((quality) => quality.id),
      languageIds: view.languages.map((language) => language.id),
    });
  }, [view, chosen]);

  const update = (index: number, change: Partial<Draft>) => setDrafts((current) => current.map((draft, at) => (at === index ? { ...draft, ...change } : draft)));

  const submit = async () => {
    setSending(true);
    setServerReasons([]);
    try {
      const response = await fetch(`/api/imports/${service}/${downloadId}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'media-manager-2' },
        body: JSON.stringify({ files: chosen.map(({ include: _include, ...assignment }) => assignment) }),
      });
      if (response.status === 204) {
        onDone();
        return;
      }
      if (response.status === 401) {
        onUnauthenticated();
        return;
      }
      const body = await response.json().catch(() => ({})) as { reasons?: string[]; reason?: string };
      setServerReasons(body.reasons ?? [body.reason ?? 'The import did not go through. Try again.']);
    } catch {
      setServerReasons(['The import did not go through. Try again.']);
    } finally {
      setSending(false);
    }
  };

  const loaded = typeof view === 'string' ? null : view;
  const allReasons = [...reasons, ...serverReasons];
  const included = chosen.length;
  const groupChecked = included === drafts.length ? true : included === 0 ? false : 'mixed';
  const label = 'text-label font-normal text-muted-foreground';

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <PanelInline
        open
        title="Import by hand"
        onClose={onCancel}
        primary={(
          <Button
            size="large"
            disabled={loaded === null || reasons.length > 0}
            loading={sending}
            icon={sending ? <LoaderCircle /> : undefined}
            onClick={() => void submit()}
          >
            {sending ? 'Importing…' : `Import ${chosen.length} ${chosen.length === 1 ? 'file' : 'files'} with hardlinks`}
          </Button>
        )}
        secondary={<Button variant="outline" onClick={onCancel}>Cancel</Button>}
      >
        <div className={cn('flex w-full flex-col gap-3 px-5', allReasons.length > 0 && 'gap-4')}>
          {view === 'loading' && <p className={label}>Reading the download's files…</p>}
          {view === 'failed' && <Callout look="risk" title="The download's files could not be read." />}
          {loaded !== null && (
            <>
              <div className="flex w-full flex-col gap-1">
                {loaded.reasons.map((reason) => <p key={reason} className={label}>Why it stopped: {reason}</p>)}
                <p className={label}>Files are hardlinked into the library, so the torrent keeps seeding.</p>
              </div>
              {allReasons.map((reason) => <Callout key={reason} look="risk" title={reason} />)}
              <Table>
                <RowImportFileHeader />
                <RowImportFileGroup
                  open
                  checked={groupChecked}
                  onCheckedChange={(checked) => setDrafts((current) => current.map((draft) => ({ ...draft, include: checked })))}
                  checkLabel={`All files in ${loaded.title}`}
                  folder={loaded.title}
                  count={`${included} of ${drafts.length} ${drafts.length === 1 ? 'file' : 'files'}`}
                />
                {loaded.files.map((file, index) => {
                  const draft = drafts[index];
                  if (draft === undefined) return null;
                  const target = loaded.target;
                  return (
                    <RowImportFile
                      key={file.path}
                      checked={draft.include}
                      onCheckedChange={(checked) => update(index, { include: checked })}
                      checkLabel={file.relativePath}
                      file={file.rejections.length > 0 ? `${file.relativePath} · ${file.rejections.join('; ')}` : file.relativePath}
                      mapsTo={target.kind === 'series' ? (
                        <Select multiple value={draft.episodeIds} onValueChange={(episodeIds) => update(index, { episodeIds })}>
                          <SelectTrigger size="row" aria-label={`Episodes for ${file.relativePath}`} className="w-full">
                            {draft.episodeIds.length === 0
                              ? 'episodes'
                              : target.episodes.filter((episode) => draft.episodeIds.includes(episode.id)).map((episode) => episode.code).join(', ')}
                          </SelectTrigger>
                          <SelectContent>
                            {target.episodes.map((episode) => <SelectItem key={episode.id} value={episode.id}>{episode.code} {episode.title}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : target.title}
                      quality={(
                        <Select value={draft.qualityId} onValueChange={(qualityId) => update(index, { qualityId })}>
                          <SelectTrigger size="row" aria-label={`Quality for ${file.relativePath}`} className="w-full">
                            {loaded.qualities.find((quality) => quality.id === draft.qualityId)?.name ?? 'quality'}
                          </SelectTrigger>
                          <SelectContent>
                            {loaded.qualities.map((quality) => <SelectItem key={quality.id} value={quality.id}>{quality.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                      languages={(
                        <Select
                          value={draft.languageIds[0] ?? null}
                          onValueChange={(languageId) => update(index, { languageIds: languageId === null ? [] : [languageId] })}
                        >
                          <SelectTrigger size="row" aria-label={`Language for ${file.relativePath}`} className="w-full">
                            {loaded.languages.find((language) => language.id === draft.languageIds[0])?.name ?? 'language'}
                          </SelectTrigger>
                          <SelectContent>
                            {loaded.languages.map((language) => <SelectItem key={language.id} value={language.id}>{language.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  );
                })}
              </Table>
            </>
          )}
        </div>
      </PanelInline>
    </div>
  );
}
