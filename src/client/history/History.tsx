import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';
import { CircleX, Download, FilePen, FolderInput, History as HistoryIcon, RefreshCw, Trash2 } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Collapsible } from '@/components/ui/collapsible-trigger';
import { EmptyState } from '@/components/ui/empty-state';
import { FactRow } from '@/components/ui/fact';
import { HeaderPage } from '@/components/ui/header-page';
import { LabelGroup } from '@/components/ui/label-group';
import { trackerName } from '@/components/ui/logo';
import { PanelInline } from '@/components/ui/panel-inline';
import { RowHistory, RowHistoryHeader } from '@/components/ui/row-history';
import { SkeletonRow } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { StatusInline } from '@/components/ui/status-inline';
import { Table } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs-trigger';
import { cn } from '@/lib/utils';
import { type HistoryEvent, type HistoryFilter, type ServiceChoice, sendJson, type useHistory } from './useHistory';
import { dayTitle, formatWhen } from './when';

const filters: { value: HistoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'grabs', label: 'Grabs' },
  { value: 'imports', label: 'Imports' },
  { value: 'failures', label: 'Failures' },
  { value: 'fixes', label: 'Automatic fixes' },
  { value: 'deletions', label: 'Deletions' },
];
const serviceChoices: { value: ServiceChoice; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'sonarr', label: 'Sonarr' },
  { value: 'radarr', label: 'Radarr' },
];
const serviceWords = { sonarr: 'Sonarr', radarr: 'Radarr' } as const;

export function FilterTabs<T extends string>({ label: name, choices, value, onChange }: {
  label: string; choices: { value: T; label: string }[]; value: T; onChange: (value: T) => void;
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as T)}>
      <TabsList aria-label={name}>
        {choices.map((choice) => <TabsTrigger key={choice.value} value={choice.value}>{choice.label}</TabsTrigger>)}
      </TabsList>
    </Tabs>
  );
}

// Height change for the details band: 0 to full at duration-size, instant under reduced motion.
const panelMotion = cn(
  'h-(--collapsible-panel-height) overflow-hidden transition-all duration-(--duration-size) ease-out',
  'data-starting-style:h-0 data-ending-style:h-0 data-ending-style:duration-(--duration-fast) data-ending-style:ease-in motion-reduce:transition-none',
);

const eventIcon = (event: HistoryEvent) => {
  if (event.eventType.startsWith('mm2_')) return <RefreshCw />;
  if (event.eventType === 'grabbed') return <Download />;
  if (event.eventType.endsWith('Imported')) return <FolderInput />;
  if (event.eventType.endsWith('Deleted')) return <Trash2 />;
  if (event.eventType.endsWith('Renamed')) return <FilePen />;
  return <CircleX />;
};

const scoreText = (details: HistoryEvent['details']) => {
  const parts = [...(details.score === null ? [] : [`${details.score >= 0 ? '+' : ''}${details.score.toLocaleString('en-US')}`]), ...details.formats];
  return parts.length === 0 ? null : parts.join(' · ');
};

type MarkState =
  | { kind: 'confirm' }
  | { kind: 'sending' }
  | { kind: 'done'; searched: string }
  | { kind: 'remove_failed_on' }
  | { kind: 'failed' };

// While marking, the band holds the confirm panel in place of the details; once marked, it shows the outcome.
function MarkFailed({ target, onClose }: { target: NonNullable<HistoryEvent['markFailed']>; onClose: () => void }) {
  const [state, setState] = useState<MarkState>({ kind: 'confirm' });
  const service = serviceWords[target.service];
  const send = async () => {
    setState({ kind: 'sending' });
    const result = await sendJson(`/api/history/${target.service}/${target.historyId}/failed`, 'POST', {
      movieId: target.movieId, episodeIds: target.episodeIds, releaseTitle: target.releaseTitle,
    }).catch(() => ({ status: 0, body: undefined }));
    const searched = (result.body as { searched?: unknown } | undefined)?.searched;
    if (result.status === 200 && typeof searched === 'string') setState({ kind: 'done', searched });
    else setState(result.status === 409 ? { kind: 'remove_failed_on' } : { kind: 'failed' });
  };
  if (state.kind === 'done') {
    const outcome: Record<string, string> = {
      service: `${service} is searching again.`,
      'media-manager-2': `media-manager-2 asked ${service} to search again.`,
      manual_download: 'This is a manual download, so nothing is searched automatically.',
      search_failed: `${service} did not take the search; the next scheduled search will look again.`,
    };
    return (
      <div className="flex items-center gap-3 py-3 pr-4 pl-(--detail-indent)">
        <StatusInline status="sent">Marked as failed. {outcome[state.searched] ?? ''}</StatusInline>
        <Button variant="outline" size="row" onClick={onClose}>Close</Button>
      </div>
    );
  }
  return (
    <div className="pt-3 pr-4 pb-4 pl-(--detail-indent)">
      <PanelInline
        open
        title="Mark this grab as failed?"
        onClose={onClose}
        primary={<Button size="large" loading={state.kind === 'sending'} onClick={() => void send()}>Mark as failed, keep seeding</Button>}
        secondary={<Button variant="outline" onClick={onClose}>Cancel</Button>}
      >
        <div className="flex flex-col gap-2 px-5">
          <p className="text-body leading-normal text-muted-foreground">
            {service} blocklists this release and searches again. Your current file stays until a replacement imports; the torrent keeps seeding in rTorrent.
          </p>
          {state.kind === 'remove_failed_on' && (
            <p className="text-label leading-normal font-normal text-destructive">
              Turn off 'Remove Failed' for the rTorrent download client in {service}'s settings first; media-manager-2 never removes a seeding torrent.
            </p>
          )}
          {state.kind === 'failed' && <p className="text-label leading-normal font-normal text-destructive">{service} did not mark it. Try again.</p>}
        </div>
      </PanelInline>
    </div>
  );
}

function EventRow({ event, expanded, dimmed, marking, onToggle, onMark, onCloseMark }: {
  event: HistoryEvent; expanded: boolean; dimmed: boolean; marking: boolean;
  onToggle: () => void; onMark: () => void; onCloseMark: () => void;
}) {
  const { details } = event;
  const rows: [string, string | null][] = [
    ['Release', event.release],
    ['Quality', event.quality],
    ['Tracker', details.tracker === null ? null : trackerName(details.tracker)],
    ['Release group', details.releaseGroup],
    ['Custom format score', scoreText(details)],
    ['How it was found', details.howFound],
    ['Age when grabbed', details.ageWhenGrabbed],
    ['Deletion reason', details.deletionReason],
    ['From', details.droppedPath],
    ['To', details.importedPath],
    [`${event.source} says`, details.message],
  ];
  const facts = (
    <div className="flex flex-col gap-3 pt-3 pr-4 pb-4 pl-(--detail-indent)">
      <dl className="m-0 flex flex-col *:last:border-b-0">
        {rows.filter(([, value]) => value !== null).map(([name, value]) => (
          <FactRow key={name} label={name} className="h-8"><span className="font-normal">{value}</span></FactRow>
        ))}
      </dl>
      {event.markFailed !== null && (
        <div><Button variant="outline" size="row" onClick={onMark}>Mark as failed</Button></div>
      )}
    </div>
  );
  return (
    <>
      <RowHistory
        when={formatWhen(event.at)}
        icon={eventIcon(event)}
        event={`${event.title} · ${event.event}`}
        by={event.byHand ? 'You' : event.source}
        detail={event.detail}
        tone={event.event === 'Download failed' ? 'problem' : undefined}
        selected={expanded}
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(keyEvent) => { if (keyEvent.key === 'Enter' && keyEvent.target === keyEvent.currentTarget) onToggle(); }}
        className={cn('transition-all', dimmed && 'opacity-35')}
      />
      <Collapsible open={expanded}>
        <CollapsiblePrimitive.Panel className={panelMotion}>
          <div role="row" className="relative border-b border-border bg-muted">
            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.75 bg-foreground" />
            <div role="cell">
              {marking && event.markFailed !== null
                ? <MarkFailed target={event.markFailed} onClose={onCloseMark} />
                : facts}
            </div>
          </div>
        </CollapsiblePrimitive.Panel>
      </Collapsible>
    </>
  );
}

// A title's history names the title; a series link drops the episode code from its first event's title.
const linkTitle = (history: ReturnType<typeof useHistory>) => {
  const { link, state } = history;
  if (Object.keys(link).length === 0 || state.kind !== 'ready') return null;
  const first = state.items.find((event) => event.source !== 'media-manager-2');
  if (first === undefined) return null;
  return link.seriesId !== undefined && link.episodeId === undefined ? first.title.replace(/ S\d+E\d+$/, '') : first.title;
};

// Memo: the parent re-renders on every download event, and this table can hold thousands of rows.
export const HistoryScreen = memo(function HistoryScreen({ history, onNavigate }: { history: ReturnType<typeof useHistory>; onNavigate: (path: string) => void }) {
  const { state, filter, setFilter, service, setService, loadMore, reload } = history;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (expanded === null) return;
    const onKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== 'Escape') return;
      if (marking) setMarking(false);
      else setExpanded(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, marking]);

  const days = useMemo(() => {
    const groups: { title: string; events: HistoryEvent[] }[] = [];
    for (const event of state.kind === 'ready' ? state.items : []) {
      const title = dayTitle(event.at);
      if (groups.at(-1)?.title === title) groups.at(-1)!.events.push(event);
      else groups.push({ title, events: [event] });
    }
    return groups;
  }, [state]);

  const title = linkTitle(history);
  const toggle = (id: string) => {
    if (marking) return;
    setExpanded((current) => (current === id ? null : id));
  };
  return (
    <section aria-label="History" className="flex flex-col gap-4 pt-2 pb-6">
      <HeaderPage
        title="History"
        summary={`Sonarr, Radarr and media-manager-2 · newest first${title === null ? '' : ` · ${title}`}`}
        action={(
          <Button
            variant="ghost"
            nativeButton={false}
            render={<a href="/blocklist" />}
            onClick={(clickEvent) => { clickEvent.preventDefault(); onNavigate('/blocklist'); }}
          >
            Blocklist
          </Button>
        )}
      />
      <div className="flex flex-wrap items-center justify-between border-b border-border">
        <FilterTabs label="Events" choices={filters} value={filter} onChange={(value) => { setExpanded(null); setFilter(value); }} />
        <FilterTabs label="Service" choices={serviceChoices} value={service} onChange={(value) => { setExpanded(null); setService(value); }} />
      </div>
      {state.kind === 'loading' && (
        <div className="flex flex-col gap-3">
          <p className="font-ui text-sm text-muted-foreground">Reading history…</p>
          <Table aria-label="History">
            <RowHistoryHeader />
            {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => <SkeletonRow key={index} />)}
          </Table>
        </div>
      )}
      {state.kind === 'failed' && (
        <Callout title="History could not be read." action={<Button variant="outline" size="row" onClick={() => void reload()}>Try again</Button>} />
      )}
      {state.kind === 'ready' && state.items.length === 0 && <EmptyState icon={<HistoryIcon />} title="No events yet" className="mt-16" />}
      {state.kind === 'ready' && state.items.length > 0 && (
        <div className="flex flex-col">
          {days.map((day) => (
            <div key={day.title} className="flex flex-col">
              <LabelGroup count={day.events.length}>{day.title}</LabelGroup>
              <Table aria-label={day.title}>
                <RowHistoryHeader />
                {day.events.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    expanded={expanded === event.id}
                    dimmed={expanded !== null && expanded !== event.id}
                    marking={marking && expanded === event.id}
                    onToggle={() => toggle(event.id)}
                    onMark={() => setMarking(true)}
                    onCloseMark={() => setMarking(false)}
                  />
                ))}
              </Table>
            </div>
          ))}
          {state.hasMore && (
            <div className="pt-4">
              <Button variant="outline" disabled={state.loadingMore} icon={state.loadingMore ? <Spinner /> : undefined} onClick={loadMore}>
                {state.loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
});
