import { useEffect, useState } from 'react';
import { getJson, type HistoryEntry } from '../library/api';

const eventWords: Record<string, string> = {
  grabbed: 'Grabbed',
  downloadFolderImported: 'Imported',
  seriesFolderImported: 'Imported from folder',
  movieFolderImported: 'Imported from folder',
  downloadFailed: 'Download failed',
  downloadIgnored: 'Download ignored',
  episodeFileDeleted: 'File deleted',
  movieFileDeleted: 'File deleted',
  episodeFileRenamed: 'File renamed',
  movieFileRenamed: 'File renamed',
};

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; entries: HistoryEntry[] };

// `query` is the /api/library/history query string, e.g. "service=sonarr&episodeId=12".
export function History({ query, service, onUnauthenticated }: { query: string; service: 'Sonarr' | 'Radarr'; onUnauthenticated: () => void }) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    setLoad({ kind: 'loading' });
    getJson<HistoryEntry[]>(`/api/library/history?${query}`, onUnauthenticated, controller.signal)
      .then((entries) => { if (!controller.signal.aborted) setLoad({ kind: 'ready', entries }); })
      .catch(() => { if (!controller.signal.aborted) setLoad({ kind: 'failed' }); });
    return () => controller.abort();
  }, [query, onUnauthenticated]);

  return (
    <section aria-label="History" className="mt-4 font-data text-[13px]">
      <h3 className="font-ui text-[14px] font-semibold">History</h3>
      {load.kind === 'loading' && <p className="mt-1 text-[var(--mm-ink-2)]">Loading…</p>}
      {load.kind === 'failed' && <p role="alert" className="mt-1 text-[var(--mm-risk)]">{service} didn't answer.</p>}
      {load.kind === 'ready' && load.entries.length === 0 && <p className="mt-1 text-[var(--mm-ink-2)]">{service} has no history for this yet.</p>}
      {load.kind === 'ready' && load.entries.length > 0 && (
        // Hand-off to AA-34: mark as failed.
        <ul className="mt-1 divide-y divide-[var(--mm-seam)] border-y border-[var(--mm-seam)]">
          {load.entries.map((entry, index) => (
            <li key={index} className="flex flex-wrap gap-x-4 gap-y-0.5 py-1">
              <span className="w-40 shrink-0 text-[var(--mm-ink-2)]">{entry.at === null ? '' : new Date(entry.at).toLocaleString()}</span>
              <span className={entry.eventType === 'downloadFailed' ? 'w-36 shrink-0 text-[var(--mm-risk)]' : 'w-36 shrink-0'}>{eventWords[entry.eventType] ?? entry.eventType}</span>
              {entry.quality !== null && <span className="text-[var(--mm-ink-2)]">{entry.quality}</span>}
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{entry.sourceTitle}</span>
              {entry.detail !== '' && <span className="text-[var(--mm-ink-2)]">{entry.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
