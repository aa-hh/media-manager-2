import { type ReactNode, useEffect, useMemo, useState } from 'react';
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

const select = 'h-8 border border-[var(--mm-ink-3)] bg-[var(--mm-ground)] px-2 text-[var(--mm-ink)]';

// Finish an import by hand: pick the movie or episodes, quality and language per file. The same check runs on the server.
export function ImportPanel({ service, downloadId, onDone, onCancel, button }: {
  service: Service; downloadId: string; onDone: () => void; onCancel: () => void;
  button: (props: { children: ReactNode; onClick: () => void; disabled?: boolean; filled?: boolean }) => ReactNode;
}) {
  const [view, setView] = useState<ImportView | 'loading' | 'failed'>('loading');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [sending, setSending] = useState(false);
  const [serverReasons, setServerReasons] = useState<string[]>([]);

  useEffect(() => {
    let current = true;
    void fetch(`/api/imports/${service}/${downloadId}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(async (response) => {
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
  }, [service, downloadId]);

  const chosen = drafts.filter((draft) => draft.include);
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
      const body = await response.json().catch(() => ({})) as { reasons?: string[]; reason?: string };
      setServerReasons(body.reasons ?? [body.reason ?? 'The import did not go through. Try again.']);
    } catch {
      setServerReasons(['The import did not go through. Try again.']);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-[var(--mm-seam)] bg-[var(--mm-row-hover)] px-5 py-4" onClick={(event) => event.stopPropagation()}>
      <p className="text-[var(--mm-ink)]">Import by hand</p>
      {view === 'loading' && <p className="text-[var(--mm-ink-2)]">Reading the download's files…</p>}
      {view === 'failed' && <p role="alert" className="text-[var(--mm-risk)]">The download's files could not be read.</p>}
      {typeof view !== 'string' && (
        <>
          {view.reasons.map((reason) => <p key={reason} className="text-[var(--mm-ink-2)]">Why it stopped: {reason}</p>)}
          <p className="text-[var(--mm-ink-2)]">Files are hardlinked into the library, so the torrent keeps seeding.</p>
          <div className="space-y-2">
            {view.files.map((file, index) => {
              const draft = drafts[index];
              if (draft === undefined) return null;
              return (
                <div key={file.path} className={cn('flex flex-wrap items-center gap-3', !draft.include && 'opacity-50')}>
                  <label className="flex min-w-[220px] flex-1 items-center gap-2 [overflow-wrap:anywhere]">
                    <input type="checkbox" checked={draft.include} onChange={(event) => update(index, { include: event.target.checked })} className="accent-[var(--mm-ink)]" />
                    <span>{file.relativePath}</span>
                    {file.rejections.length > 0 && <span className="text-[var(--mm-ink-2)]">{file.rejections.join('; ')}</span>}
                  </label>
                  {view.target.kind === 'series' ? (
                    <select
                      multiple
                      aria-label={`Episodes for ${file.relativePath}`}
                      size={Math.min(4, view.target.episodes.length)}
                      className={cn(select, 'h-auto')}
                      value={draft.episodeIds.map(String)}
                      onChange={(event) => update(index, { episodeIds: [...event.target.selectedOptions].map((option) => Number(option.value)) })}
                    >
                      {view.target.episodes.map((episode) => <option key={episode.id} value={episode.id}>{episode.code} {episode.title}</option>)}
                    </select>
                  ) : (
                    <span className="text-[var(--mm-ink)]">{view.target.title}</span>
                  )}
                  <select
                    aria-label={`Quality for ${file.relativePath}`}
                    className={select}
                    value={draft.qualityId ?? ''}
                    onChange={(event) => update(index, { qualityId: event.target.value === '' ? null : Number(event.target.value) })}
                  >
                    <option value="">quality</option>
                    {view.qualities.map((quality) => <option key={quality.id} value={quality.id}>{quality.name}</option>)}
                  </select>
                  <select
                    aria-label={`Language for ${file.relativePath}`}
                    className={select}
                    value={draft.languageIds[0] ?? ''}
                    onChange={(event) => update(index, { languageIds: event.target.value === '' ? [] : [Number(event.target.value)] })}
                  >
                    <option value="">language</option>
                    {view.languages.map((language) => <option key={language.id} value={language.id}>{language.name}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
          {[...reasons, ...serverReasons].map((reason) => <p key={reason} role="alert" className="text-[var(--mm-risk)]">{reason}</p>)}
        </>
      )}
      <div className="flex items-center gap-3">
        {button({ filled: true, disabled: typeof view === 'string' || reasons.length > 0 || sending, onClick: () => void submit(), children: sending ? 'Importing…' : `Import ${chosen.length} ${chosen.length === 1 ? 'file' : 'files'} with hardlinks` })}
        {button({ onClick: onCancel, children: 'Cancel' })}
      </div>
    </div>
  );
}
