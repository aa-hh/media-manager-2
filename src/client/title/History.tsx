import { Ban, CircleX, Download, FileCheck, FilePen, FileX } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { LabelGroup } from '@/components/ui/label-group';
import { RowHistory } from '@/components/ui/row-history';
import { SkeletonRow } from '@/components/ui/skeleton';
import { StatusInline } from '@/components/ui/status-inline';
import { Table } from '@/components/ui/table';
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

const eventIcons: Record<string, ReactNode> = {
  grabbed: <Download />,
  downloadFolderImported: <FileCheck />,
  seriesFolderImported: <FileCheck />,
  movieFolderImported: <FileCheck />,
  downloadFailed: <CircleX />,
  downloadIgnored: <Ban />,
  episodeFileDeleted: <FileX />,
  movieFileDeleted: <FileX />,
  episodeFileRenamed: <FilePen />,
  movieFileRenamed: <FilePen />,
};

export type HistoryLoad = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; entries: HistoryEntry[] };

const when = (iso: string | null) => (iso === null ? '' : new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));

// `query` is the /api/library/history query string, e.g. "service=sonarr&episodeId=12".
export function useTitleHistory(query: string, onUnauthenticated: () => void) {
  const [load, setLoad] = useState<HistoryLoad>({ kind: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    setLoad({ kind: 'loading' });
    getJson<HistoryEntry[]>(`/api/library/history?${query}`, onUnauthenticated, controller.signal)
      .then((entries) => { if (!controller.signal.aborted) setLoad({ kind: 'ready', entries }); })
      .catch(() => { if (!controller.signal.aborted) setLoad({ kind: 'failed' }); });
    return () => controller.abort();
  }, [query, onUnauthenticated]);
  return load;
}

// Hand-off to AA-34: mark as failed.
export const historyRows = (entries: HistoryEntry[]) => entries.map((entry, index) => (
  <RowHistory
    key={index}
    when={when(entry.at)}
    icon={eventIcons[entry.eventType] ?? <FileCheck />}
    event={[[eventWords[entry.eventType] ?? entry.eventType, entry.quality].filter((part) => part !== null).join(' '), entry.sourceTitle]
      .filter((part) => part !== null && part !== '').join(' · ')}
    by=""
    detail={entry.detail}
    tone={entry.eventType === 'downloadFailed' ? 'problem' : undefined}
  />
));

// The one line the history panel shows when there are no rows to draw.
export const historyEmpty = (load: HistoryLoad, service: 'Sonarr' | 'Radarr') => {
  if (load.kind === 'loading') return undefined;
  if (load.kind === 'failed') return <StatusInline status="failed">{service} didn't answer.</StatusInline>;
  return load.entries.length === 0 ? `${service} has no history for this yet.` : undefined;
};

/** A title's history as its own group: heading with the count, then a table of events. */
export function History({ query, service, onUnauthenticated }: { query: string; service: 'Sonarr' | 'Radarr'; onUnauthenticated: () => void }) {
  const load = useTitleHistory(query, onUnauthenticated);
  const empty = historyEmpty(load, service);
  return (
    <section aria-label="History" className="flex flex-col">
      <LabelGroup count={load.kind === 'ready' ? load.entries.length : undefined}>History</LabelGroup>
      <Table>
        {load.kind === 'loading' && <SkeletonRow />}
        {load.kind === 'ready' && historyRows(load.entries)}
        {empty !== undefined && <p className="m-0 flex h-(--row) items-center px-4 font-ui text-sm text-muted-foreground">{empty}</p>}
      </Table>
    </section>
  );
}
