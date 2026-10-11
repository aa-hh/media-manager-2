import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ScreenButton, ScreenHeading } from '../screen';
import { dayTitle, FilterTabs, formatWhen } from './History';
import { type BlockEntry, sendJson, type useBlocklist } from './useHistory';

type View = 'all' | 'you' | 'automatic' | 'sonarr' | 'radarr';

const views: { value: View; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'you', label: 'Blocked by you' },
  { value: 'automatic', label: 'Blocked automatically' },
  { value: 'sonarr', label: 'Sonarr' },
  { value: 'radarr', label: 'Radarr' },
];
const shows: Record<View, (entry: BlockEntry) => boolean> = {
  all: () => true,
  you: (entry) => entry.by === 'you',
  automatic: (entry) => entry.by !== 'you',
  sonarr: (entry) => entry.service === 'sonarr',
  radarr: (entry) => entry.service === 'radarr',
};
const serviceWords = { sonarr: 'Sonarr', radarr: 'Radarr' } as const;
const UNDO_MS = 8_000;

const columns = 'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_96px] items-baseline gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)_120px]';
const label = 'font-data text-[11px] font-bold tracking-[0.6px] text-[var(--mm-ink-2)]';
// No day headings here, so today's and yesterday's times carry their day word.
const when = (at: number) => (['Today', 'Yesterday'].includes(dayTitle(at)) ? `${dayTitle(at)} ${formatWhen(at)}` : formatWhen(at));
const keyOf = (entry: BlockEntry) => `${entry.service}:${entry.id}`;
const why = (entry: BlockEntry) => (entry.by === 'you' ? `by you ${entry.reason}` : `by ${entry.by}${entry.reason === '' ? '' : `: ${entry.reason}`}`);

export function BlocklistScreen({ blocklist }: { blocklist: ReturnType<typeof useBlocklist> }) {
  const { state, loadMore, reload } = blocklist;
  const [view, setView] = useState<View>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState<BlockEntry | null>(null);
  const [failed, setFailed] = useState<BlockEntry | null>(null);
  const timerRef = useRef<{ entry: BlockEntry; timer: number } | null>(null);

  const show = (key: string, visible: boolean) => setHidden((current) => {
    const next = new Set(current);
    if (visible) next.delete(key);
    else next.add(key);
    return next;
  });

  // The delete goes out only once the Undo window has passed; Sonarr and Radarr cannot put an entry back.
  const commit = async (entry: BlockEntry) => {
    timerRef.current = null;
    setPending((current) => (current === entry ? null : current));
    const { status } = await sendJson(`/api/blocklist/${entry.service}/${entry.id}`, 'DELETE').catch(() => ({ status: 0 }));
    if (status === 204) return;
    show(keyOf(entry), true);
    setFailed(entry);
  };

  const unblock = (entry: BlockEntry) => {
    const previous = timerRef.current;
    if (previous !== null) {
      window.clearTimeout(previous.timer);
      void commit(previous.entry);
    }
    show(keyOf(entry), false);
    setSelected(null);
    setFailed(null);
    setPending(entry);
    timerRef.current = { entry, timer: window.setTimeout(() => void commit(entry), UNDO_MS) };
  };

  const undo = () => {
    const current = timerRef.current;
    if (current === null) return;
    window.clearTimeout(current.timer);
    timerRef.current = null;
    show(keyOf(current.entry), true);
    setPending(null);
  };

  const entries = state.kind === 'ready' ? state.items.filter((entry) => !hidden.has(keyOf(entry))) : [];
  const visible = entries.filter(shows[view]);
  return (
    <section aria-label="Blocklist">
      <ScreenHeading title="Blocklist" summary={state.kind === 'ready' ? `${entries.length} blocked releases` : undefined} />
      <p className="px-5 pb-3 text-[13px] text-[var(--mm-ink-2)]">
        Sonarr and Radarr never grab a blocked release again. Unblocking one lets them grab it on the next search.
      </p>
      <div className="border-b border-[var(--mm-seam)] px-2">
        <FilterTabs label="Blocked releases" choices={views} value={view} onChange={(value) => { setSelected(null); setView(value); }} />
      </div>
      {pending !== null && (
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13px]">
          <p role="status" className="text-[var(--mm-ink)]">
            Unblocked {pending.title}. {serviceWords[pending.service]} can grab that release again on the next search.
          </p>
          <ScreenButton onClick={undo}>Undo</ScreenButton>
        </div>
      )}
      {failed !== null && (
        <p role="alert" className="px-5 py-3 text-[13px] text-[var(--mm-risk)]">{serviceWords[failed.service]} did not unblock it.</p>
      )}
      {state.kind === 'loading' && <p className="px-5 py-6 text-[13px] text-[var(--mm-ink-2)]">Reading the blocklist…</p>}
      {state.kind === 'failed' && (
        <div className="flex items-center gap-3 px-5 py-6 text-[13px]">
          <p role="alert" className="text-[var(--mm-risk)]">The blocklist could not be read.</p>
          <ScreenButton onClick={() => void reload()}>Try again</ScreenButton>
        </div>
      )}
      {state.kind === 'ready' && (<>
        <div className={cn(columns, 'h-[30px] items-center bg-[var(--mm-row)] px-5', label)} role="row">
          <span>TITLE</span><span>WHY BLOCKED</span><span className="hidden md:block">RELEASE</span><span>WHEN</span>
        </div>
        {visible.length === 0 && <p className="px-5 py-6 text-[13px] text-[var(--mm-ink-2)]">Nothing is blocked here.</p>}
        <div role="table" aria-label="Blocklist">
          {visible.map((entry, index) => {
            const key = keyOf(entry);
            const isSelected = selected === key;
            return (
              <div
                key={key}
                role="row"
                tabIndex={0}
                aria-selected={isSelected}
                onClick={() => setSelected(isSelected ? null : key)}
                onKeyDown={(event) => { if (event.key === 'Enter' && event.target === event.currentTarget) setSelected(isSelected ? null : key); }}
                className={cn(
                  'border-b border-[var(--mm-seam)] font-data text-[13px] focus-visible:outline-1 focus-visible:outline-[var(--mm-ink)]',
                  isSelected ? 'bg-[var(--mm-row-hover)]' : index % 2 === 0 ? 'bg-[var(--mm-row)]' : 'bg-[var(--mm-row-alt)]',
                )}
              >
                <div className={cn(columns, 'min-h-[34px] px-5 py-1.5')}>
                  <span className="min-w-0 [overflow-wrap:anywhere] text-[var(--mm-ink)]">{entry.title}</span>
                  <span className="min-w-0 [overflow-wrap:anywhere] text-[var(--mm-ink-2)]">{why(entry)}</span>
                  <span className="hidden min-w-0 [overflow-wrap:anywhere] text-[var(--mm-ink-2)] md:block">
                    {[entry.release, entry.quality, entry.indexer].filter((part) => part !== null && part !== '').join(' · ')}
                  </span>
                  <span className="tabular-nums text-[var(--mm-ink-2)]">{when(entry.at)}</span>
                </div>
                {isSelected && (
                  <div className="px-5 pb-3"><ScreenButton onClick={() => unblock(entry)}>Unblock</ScreenButton></div>
                )}
              </div>
            );
          })}
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
