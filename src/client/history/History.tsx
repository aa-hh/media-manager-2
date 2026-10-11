import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ScreenButton, ScreenHeading } from '../screen';
import { type HistoryEvent, type HistoryFilter, type ServiceChoice, sendJson, type useHistory } from './useHistory';

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

const columns = 'grid grid-cols-[52px_minmax(0,1fr)_minmax(0,1fr)] items-baseline gap-3 md:grid-cols-[88px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_120px]';
const medium = 'hidden md:block';
const label = 'font-data text-[11px] font-bold tracking-[0.6px] text-[var(--mm-ink-2)]';

const dayKey = (at: number) => new Date(at).toDateString();
const shortDate = (at: number) => new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const clock = (at: number) => new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export const dayTitle = (at: number, now = Date.now()) => {
  if (dayKey(at) === dayKey(now)) return 'Today';
  if (dayKey(at) === dayKey(now - 86_400_000)) return 'Yesterday';
  return shortDate(at);
};

// Times today and yesterday are under their day's heading; older ones carry their date.
export const formatWhen = (at: number, now = Date.now()) => (
  dayTitle(at, now) === shortDate(at) ? `${shortDate(at)} ${clock(at)}` : clock(at)
);

export function FilterTabs<T extends string>({ label: name, choices, value, onChange }: {
  label: string; choices: { value: T; label: string }[]; value: T; onChange: (value: T) => void;
}) {
  return (
    <div role="tablist" aria-label={name} className="flex flex-wrap">
      {choices.map((choice) => (
        <button
          key={choice.value}
          type="button"
          role="tab"
          aria-selected={value === choice.value}
          onClick={() => onChange(choice.value)}
          className={cn(
            'h-[34px] px-3 font-ui text-[13px] font-medium focus-visible:outline-1 focus-visible:outline-[var(--mm-ink)]',
            value === choice.value ? 'border-b border-[var(--mm-ink)] text-[var(--mm-ink)]' : 'text-[var(--mm-ink-2)]',
          )}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}

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

function MarkFailedPanel({ target, onClose }: { target: NonNullable<HistoryEvent['markFailed']>; onClose: () => void }) {
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
      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--mm-seam)] bg-[var(--mm-row-hover)] px-5 py-4" onClick={(event) => event.stopPropagation()}>
        <p role="status" className="text-[var(--mm-ink)]">Marked as failed. {outcome[state.searched] ?? ''}</p>
        <ScreenButton onClick={onClose}>Close</ScreenButton>
      </div>
    );
  }
  return (
    <div className="space-y-3 border-t border-[var(--mm-seam)] bg-[var(--mm-row-hover)] px-5 py-4" onClick={(event) => event.stopPropagation()}>
      <p className="text-[var(--mm-ink)]">Mark this grab as failed?</p>
      <p className="text-[var(--mm-ink-2)]">
        {service} blocklists this release and searches again. Your current file stays until a replacement imports; the torrent keeps seeding in rTorrent.
      </p>
      {state.kind === 'remove_failed_on' && (
        <p role="alert" className="text-[var(--mm-risk)]">
          Turn off &apos;Remove Failed&apos; for the rTorrent download client in {service}&apos;s settings first; media-manager-2 never removes a seeding torrent.
        </p>
      )}
      {state.kind === 'failed' && <p role="alert" className="text-[var(--mm-risk)]">{service} did not mark it. Try again.</p>}
      <div className="flex items-center gap-3">
        <ScreenButton filled disabled={state.kind === 'sending'} onClick={() => void send()}>Mark as failed, keep seeding</ScreenButton>
        <ScreenButton onClick={onClose}>Cancel</ScreenButton>
      </div>
    </div>
  );
}

function Detail({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className={cn(label, 'w-[180px] shrink-0 pt-0.5')}>{name}</span>
      <span className="min-w-0 [overflow-wrap:anywhere] text-[var(--mm-ink)]">{children}</span>
    </div>
  );
}

function EventRow({ event, index, expanded, dimmed, marking, onToggle, onMark, onCloseMark }: {
  event: HistoryEvent; index: number; expanded: boolean; dimmed: boolean; marking: boolean;
  onToggle: () => void; onMark: () => void; onCloseMark: () => void;
}) {
  const { details } = event;
  const rows: [string, string | null][] = [
    ['RELEASE', event.release],
    ['TRACKER', details.tracker],
    ['RELEASE GROUP', details.releaseGroup],
    ['CUSTOM FORMAT SCORE', scoreText(details)],
    ['HOW IT WAS FOUND', details.howFound],
    ['AGE WHEN GRABBED', details.ageWhenGrabbed],
    ['DELETION REASON', details.deletionReason],
    ['FROM', details.droppedPath],
    ['TO', details.importedPath],
    [`${event.source.toUpperCase()} SAYS`, details.message],
  ];
  return (
    <div
      role="row"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={onToggle}
      onKeyDown={(keyEvent) => { if (keyEvent.key === 'Enter' && keyEvent.target === keyEvent.currentTarget) onToggle(); }}
      className={cn(
        'border-b border-[var(--mm-seam)] font-data text-[13px] focus-visible:outline-1 focus-visible:outline-[var(--mm-ink)]',
        expanded ? 'bg-[var(--mm-row-hover)]' : index % 2 === 0 ? 'bg-[var(--mm-row)]' : 'bg-[var(--mm-row-alt)]',
        dimmed && 'opacity-35',
      )}
    >
      <div className={cn(columns, 'min-h-[34px] px-5 py-1.5')}>
        <span className="tabular-nums text-[var(--mm-ink-2)]">{formatWhen(event.at)}</span>
        <span className="min-w-0 [overflow-wrap:anywhere] text-[var(--mm-ink)]">{event.title}</span>
        <span className="min-w-0 [overflow-wrap:anywhere]">
          <span className={event.event === 'Download failed' ? 'text-[var(--mm-risk)]' : 'text-[var(--mm-ink)]'}>{event.event}</span>
          {event.detail !== '' && <span className="ml-2 text-[var(--mm-ink-2)]">{event.detail}</span>}
        </span>
        <span className={cn(medium, 'min-w-0 [overflow-wrap:anywhere] text-[var(--mm-ink-2)]')}>
          {[event.release, event.quality].filter((part) => part !== null).join(' · ')}
        </span>
        <span className={cn(medium, 'text-[var(--mm-ink-2)]')}>{event.source}</span>
      </div>
      {expanded && !marking && (
        <div className="space-y-1.5 px-5 pb-3 md:pl-[120px]" onClick={(clickEvent) => clickEvent.stopPropagation()}>
          {rows.filter(([, value]) => value !== null).map(([name, value]) => <Detail key={name} name={name}>{value}</Detail>)}
          {event.markFailed !== null && (
            <div className="pt-2"><ScreenButton onClick={onMark}>Mark as failed</ScreenButton></div>
          )}
        </div>
      )}
      {expanded && marking && event.markFailed !== null && <MarkFailedPanel target={event.markFailed} onClose={onCloseMark} />}
    </div>
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

export function HistoryScreen({ history, onNavigate }: { history: ReturnType<typeof useHistory>; onNavigate: (path: string) => void }) {
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
    <section aria-label="History">
      <ScreenHeading title="History" summary={`Sonarr, Radarr and media-manager-2 · newest first${title === null ? '' : ` · ${title}`}`}>
        <a
          href="/blocklist"
          onClick={(clickEvent) => { clickEvent.preventDefault(); onNavigate('/blocklist'); }}
          className="font-ui text-[13px] font-medium text-[var(--mm-ink-2)] hover:text-[var(--mm-ink)]"
        >
          Blocklist →
        </a>
      </ScreenHeading>
      <div className="flex flex-wrap items-center justify-between gap-x-6 border-b border-[var(--mm-seam)] px-2">
        <FilterTabs label="Events" choices={filters} value={filter} onChange={(value) => { setExpanded(null); setFilter(value); }} />
        <FilterTabs label="Service" choices={serviceChoices} value={service} onChange={(value) => { setExpanded(null); setService(value); }} />
      </div>
      {state.kind === 'loading' && <p className="px-5 py-6 text-[13px] text-[var(--mm-ink-2)]">Reading history…</p>}
      {state.kind === 'failed' && (
        <div className="flex items-center gap-3 px-5 py-6 text-[13px]">
          <p role="alert" className="text-[var(--mm-risk)]">History could not be read.</p>
          <ScreenButton onClick={() => void reload()}>Try again</ScreenButton>
        </div>
      )}
      {state.kind === 'ready' && (<>
        <div className={cn(columns, 'h-[30px] items-center bg-[var(--mm-row)] px-5', label)} role="row">
          <span>WHEN</span><span>TITLE</span><span>EVENT</span><span className={medium}>RELEASE AND QUALITY</span><span className={medium}>SOURCE</span>
        </div>
        {state.items.length === 0 && <p className="px-5 py-6 text-[13px] text-[var(--mm-ink-2)]">No events yet.</p>}
        <div role="table" aria-label="History">
          {days.map((day) => (
            <div key={day.title} role="rowgroup">
              <p className={cn('border-b border-[var(--mm-seam)] bg-[var(--mm-ground)] px-5 pb-1.5 pt-3', label)}>{day.title}</p>
              {day.events.map((event, index) => (
                <EventRow
                  key={event.id}
                  event={event}
                  index={index}
                  expanded={expanded === event.id}
                  dimmed={expanded !== null && expanded !== event.id}
                  marking={marking && expanded === event.id}
                  onToggle={() => toggle(event.id)}
                  onMark={() => setMarking(true)}
                  onCloseMark={() => setMarking(false)}
                />
              ))}
            </div>
          ))}
        </div>
        {state.hasMore && (
          <div className="px-5 py-4">
            <ScreenButton disabled={state.loadingMore} onClick={loadMore}>{state.loadingMore ? 'Loading…' : 'Load more'}</ScreenButton>
          </div>
        )}
      </>)}
    </section>
  );
}
