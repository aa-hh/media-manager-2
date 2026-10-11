import { type RefObject, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ImportPanel } from '../downloads/ImportPanel';
import { formatDuration, type Service } from '../downloads/model';
import { postAction } from '../downloads/useDownloads';
import { PickRelease, type OwnedEpisode, type ReleaseTarget } from '../PickRelease';
import { ScreenButton, ScreenHeading } from '../screen';
import type { FlaggedAction, FlaggedItem, FlaggedState, Wanted } from './useFlagged';

type Tab = 'needs_you' | 'missing' | 'cutoff';

const tabs: { key: Tab; label: string }[] = [
  { key: 'needs_you', label: 'Needs you' },
  { key: 'missing', label: 'Missing' },
  { key: 'cutoff', label: 'Below cutoff' },
];

const actionLabels: Record<FlaggedAction['kind'], string> = {
  pick_release: 'Pick a release',
  search: 'Search automatically',
  manual_import: 'Manual import',
  open_health: 'Open Health',
};

const serviceName = (service: Service) => (service === 'sonarr' ? 'Sonarr' : 'Radarr');
const header = 'font-data text-[11px] font-bold tracking-[0.6px] text-[var(--mm-ink-2)]';
const rowTone = (index: number, selected: boolean, dimmed: boolean) => cn(
  'border-b border-[var(--mm-seam)] font-data text-[13px]',
  selected ? 'bg-[var(--mm-row-hover)]' : index % 2 === 0 ? 'bg-[var(--mm-row)]' : 'bg-[var(--mm-row-alt)]',
  dimmed && 'opacity-35',
);
const needsYouColumns = 'grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 md:grid-cols-[160px_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,220px)]';
const wantedColumns = 'grid grid-cols-[24px_minmax(0,1fr)_minmax(0,140px)] items-center gap-3 md:grid-cols-[24px_minmax(0,1fr)_minmax(0,220px)_72px_120px_minmax(0,240px)]';

const sendSearch = async (service: Service, type: 'movie' | 'episode', ids: number[]) => {
  const status = await postAction('/api/flagged/search', { service, type, ids }).catch(() => 0);
  return status === 204;
};

// Sonarr's pick needs the series' episodes and Radarr's whether the movie has a file, so those are read before the releases open.
function PickPanel({ target, title, onClose, onUnauthenticated }: {
  target: ReleaseTarget; title: string; onClose: () => void; onUnauthenticated: () => void;
}) {
  const [owned, setOwned] = useState<{ kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; episodes: OwnedEpisode[]; movieHasFile: boolean }>({ kind: 'loading' });
  const path = target.service === 'sonarr' ? `/api/owned/series/${target.seriesId}/episodes` : `/api/owned/movie/${target.movieId}`;
  useEffect(() => {
    let current = true;
    void (async () => {
      try {
        const response = await fetch(path, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
        if (response.status === 401) {
          onUnauthenticated();
          return;
        }
        if (!response.ok) throw new Error('unreadable');
        const body: unknown = await response.json();
        if (!current) return;
        setOwned(Array.isArray(body)
          ? { kind: 'ready', episodes: body as OwnedEpisode[], movieHasFile: false }
          : { kind: 'ready', episodes: [], movieHasFile: (body as { hasFile?: unknown }).hasFile === true });
      } catch {
        if (current) setOwned({ kind: 'failed' });
      }
    })();
    return () => { current = false; };
  }, [path, onUnauthenticated]);
  if (owned.kind === 'loading') return <p className="px-5 pb-3 text-[var(--mm-ink-2)]">Reading {title} from {serviceName(target.service)}…</p>;
  if (owned.kind === 'failed') {
    return (
      <div className="flex items-center gap-3 px-5 pb-3">
        <p role="alert" className="text-[var(--mm-risk)]">{serviceName(target.service)} could not be read.</p>
        <ScreenButton onClick={onClose}>Close</ScreenButton>
      </div>
    );
  }
  return (
    <div className="px-5 pb-3 font-ui" onClick={(event) => event.stopPropagation()}>
      <PickRelease target={target} title={title} episodes={owned.episodes} movieHasFile={owned.movieHasFile} onClose={onClose} onUnauthenticated={onUnauthenticated} />
    </div>
  );
}

type Open = { key: string; panel: 'pick' | 'import' };

function NeedsYouRow({ item, index, selected, open, dimmed, onSelect, onOpen, onClose, onChanged, onOpenHealth, onUnauthenticated }: {
  item: FlaggedItem; index: number; selected: boolean; open: Open['panel'] | null; dimmed: boolean;
  onSelect: () => void; onOpen: (panel: Open['panel']) => void; onClose: () => void; onChanged: () => void;
  onOpenHealth: () => void; onUnauthenticated: () => void;
}) {
  const [searched, setSearched] = useState<{ ok: boolean; service: Service } | null>(null);
  const [searching, setSearching] = useState(false);
  const pick = item.actions.find((action): action is Extract<FlaggedAction, { kind: 'pick_release' }> => action.kind === 'pick_release');
  const manual = item.actions.find((action): action is Extract<FlaggedAction, { kind: 'manual_import' }> => action.kind === 'manual_import');
  const run = async (action: FlaggedAction) => {
    if (action.kind === 'pick_release') onOpen('pick');
    else if (action.kind === 'manual_import') onOpen('import');
    else if (action.kind === 'open_health') onOpenHealth();
    else {
      setSearching(true);
      const ok = await sendSearch(action.service, action.type, action.ids);
      setSearching(false);
      setSearched({ ok, service: action.service });
    }
  };
  return (
    <div className={rowTone(index, selected, dimmed)} onClick={onSelect} aria-selected={selected} role="row">
      <div className={cn(needsYouColumns, 'min-h-[34px] px-5 py-1')}>
        <span className="text-[var(--mm-ink-2)]">{item.kindWord}</span>
        <span className="min-w-0 text-[var(--mm-ink)] [overflow-wrap:anywhere]">{item.label}</span>
        <span className="hidden min-w-0 text-[var(--mm-ink-2)] md:block">{item.detail}</span>
        <span className="hidden min-w-0 text-[var(--mm-ink-2)] md:block">{item.actions.map((action) => actionLabels[action.kind]).join(' · ')}</span>
      </div>
      {selected && open === null && item.actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-5 pb-3">
          {item.actions.map((action) => (
            <ScreenButton key={action.kind} disabled={action.kind === 'search' && searching} onClick={() => void run(action)}>{actionLabels[action.kind]}</ScreenButton>
          ))}
          {searched?.ok === true && <span role="status" className="text-[var(--mm-ink-2)]">Search sent</span>}
          {searched?.ok === false && <span role="alert" className="text-[var(--mm-risk)]">{serviceName(searched.service)} refused the search.</span>}
        </div>
      )}
      {open === 'pick' && pick !== undefined && (
        <PickPanel target={pick.target} title={pick.title} onClose={onChanged} onUnauthenticated={onUnauthenticated} />
      )}
      {open === 'import' && manual !== undefined && (
        <ImportPanel
          service={manual.service}
          downloadId={manual.downloadId}
          onDone={onChanged}
          onCancel={onClose}
          button={({ children, ...props }) => <ScreenButton {...props}>{children}</ScreenButton>}
        />
      )}
    </div>
  );
}

const searchedText = (item: Wanted, now: number) => [
  item.lastSearchAt === null ? 'never' : `last ${formatDuration(now - item.lastSearchAt)} ago`,
  item.nextSearchAt === null ? 'not available yet' : `next in ${formatDuration(item.nextSearchAt - now)}`,
].join(' · ');

const dateText = (at: number | null) => (at === null ? '' : new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }));

const wantedKey = (item: Wanted) => `${item.service}:${item.type}:${item.id}`;

const wantedTarget = (item: Wanted): ReleaseTarget | undefined => {
  if (item.type === 'movie') return { service: 'radarr', kind: 'movie', movieId: item.id };
  return item.seriesId === null ? undefined : { service: 'sonarr', kind: 'episode', seriesId: item.seriesId, episodeId: item.id };
};

function WantedList({ items, empty, now, open, setOpen, onChanged, onUnauthenticated }: {
  items: Wanted[]; empty: string; now: number; open: Open | null; setOpen: (open: Open | null) => void;
  onChanged: () => void; onUnauthenticated: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [refused, setRefused] = useState<Service[] | null>(null);
  const searchable = items.filter((item) => !item.inQueue);
  const chosen = searchable.filter((item) => checked.has(wantedKey(item)));
  const toggle = (key: string) => setChecked((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  // One search per service and type, since Sonarr and Radarr each take one command for many ids.
  const search = async () => {
    setSearching(true);
    const groups = new Map<string, Wanted[]>();
    for (const item of chosen) groups.set(`${item.service}:${item.type}`, [...(groups.get(`${item.service}:${item.type}`) ?? []), item]);
    const results = await Promise.all([...groups.values()].map(async (group) => ({
      service: group[0].service,
      ok: await sendSearch(group[0].service, group[0].type, group.map((item) => item.id)),
    })));
    setSearching(false);
    setRefused(results.filter((result) => !result.ok).map((result) => result.service));
    setChecked(new Set());
    onChanged();
  };
  const allChecked = searchable.length > 0 && chosen.length === searchable.length;
  return (
    <>
      {(chosen.length > 0 || refused !== null) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--mm-seam)] px-5 py-2 text-[13px]">
          {chosen.length > 0 && (
            <>
              <span className="text-[var(--mm-ink)]">{chosen.length} selected</span>
              <ScreenButton disabled={searching} onClick={() => void search()}>Search</ScreenButton>
              <ScreenButton onClick={() => setChecked(new Set())}>Clear</ScreenButton>
            </>
          )}
          {refused !== null && refused.length === 0 && <span role="status" className="text-[var(--mm-ink-2)]">Search sent</span>}
          {refused !== null && refused.map((service) => (
            <span key={service} role="alert" className="text-[var(--mm-risk)]">{serviceName(service)} refused the search.</span>
          ))}
        </div>
      )}
      <div className={cn(wantedColumns, 'h-[30px] bg-[var(--mm-row)] px-5', header)} role="row">
        <input
          type="checkbox"
          aria-label="Select every item that can be searched"
          checked={allChecked}
          disabled={searchable.length === 0}
          onChange={() => setChecked(allChecked ? new Set() : new Set(searchable.map(wantedKey)))}
        />
        <span>TITLE</span><span>LAST RESULT</span><span className="hidden md:block">TYPE</span>
        <span className="hidden md:block">DATE, OLDEST FIRST</span><span className="hidden md:block">SEARCHED</span>
      </div>
      {items.length === 0 && <p className="px-5 py-6 text-[13px] text-[var(--mm-ink-2)]">{empty}</p>}
      <div role="table" aria-label="Wanted">
        {items.map((item, index) => {
          const key = wantedKey(item);
          const target = wantedTarget(item);
          const isSelected = selected === key;
          return (
            <div
              key={key}
              className={rowTone(index, isSelected, open !== null && open.key !== key)}
              onClick={() => { if (open === null) setSelected(key); }}
              aria-selected={isSelected}
              role="row"
            >
              <div className={cn(wantedColumns, 'min-h-[34px] px-5 py-1')}>
                {item.inQueue
                  ? <span />
                  : (
                    <input
                      type="checkbox"
                      aria-label={`Select ${item.title}`}
                      checked={checked.has(key)}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => toggle(key)}
                    />
                  )}
                <span className="min-w-0 text-[var(--mm-ink)] [overflow-wrap:anywhere]">{item.title}</span>
                <span className="min-w-0 truncate text-[var(--mm-ink-2)]" title={item.lastResult}>{item.lastResult}</span>
                <span className="hidden text-[var(--mm-ink-2)] md:block">{item.type === 'movie' ? 'Movie' : 'Episode'}</span>
                <span className="hidden tabular-nums text-[var(--mm-ink-2)] md:block">{dateText(item.availableAt)}</span>
                <span className="hidden text-[var(--mm-ink-2)] md:block">{searchedText(item, now)}</span>
              </div>
              {isSelected && open === null && target !== undefined && (
                <div className="flex flex-wrap items-center gap-3 px-5 pb-3">
                  <ScreenButton onClick={() => setOpen({ key, panel: 'pick' })}>Pick a release</ScreenButton>
                </div>
              )}
              {open?.key === key && target !== undefined && (
                <PickPanel target={target} title={item.title} onClose={onChanged} onUnauthenticated={onUnauthenticated} />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export function FlaggedScreen({ state, reload, headingRef, onUnauthenticated, onOpenHealth }: {
  state: FlaggedState; reload: () => Promise<void>; headingRef: RefObject<HTMLDivElement | null>;
  onUnauthenticated: () => void; onOpenHealth: () => void;
}) {
  const [tab, setTab] = useState<Tab>('needs_you');
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (open === null) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const changed = () => {
    setOpen(null);
    setSelected(null);
    void reload();
  };
  const switchTab = (next: Tab) => {
    setTab(next);
    setOpen(null);
    setSelected(null);
  };

  const handled = state.needsYou.kind === 'ready' ? state.needsYou.value.handledThisWeek : undefined;
  const summary = handled === undefined ? undefined
    : tab === 'needs_you'
      ? `Automatic fixes handled ${handled} problems this week on their own. These are the ones they gave up on.`
      : `Automatic fixes handled ${handled} problems this week. Missing items are searched every 6h.`;
  const load = tab === 'needs_you' ? state.needsYou : state.wanted;

  return (
    <section aria-label="Flagged">
      <div ref={headingRef} tabIndex={-1}>
        <ScreenHeading title="Flagged" summary={summary} />
      </div>
      <div role="tablist" aria-label="Flagged lists" className="flex gap-5 border-b border-[var(--mm-seam)] px-5">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => switchTab(item.key)}
            className={cn(
              'h-9 font-ui text-[13px] font-medium focus-visible:outline-1 focus-visible:outline-[var(--mm-ink)]',
              tab === item.key ? 'border-b border-[var(--mm-ink)] text-[var(--mm-ink)]' : 'text-[var(--mm-ink-2)]',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {load.kind === 'loading' && <p className="px-5 py-6 text-[13px] text-[var(--mm-ink-2)]">Reading flagged items…</p>}
      {load.kind === 'failed' && (
        <div className="flex items-center gap-3 px-5 py-6 text-[13px]">
          <p role="alert" className="text-[var(--mm-risk)]">Flagged items could not be read.</p>
          <ScreenButton onClick={() => void reload()}>Try again</ScreenButton>
        </div>
      )}
      {tab === 'needs_you' && state.needsYou.kind === 'ready' && (
        <>
          <div className={cn(needsYouColumns, 'h-[30px] bg-[var(--mm-row)] px-5', header)} role="row">
            <span>KIND</span><span>ITEM</span><span className="hidden md:block">WHAT HAPPENED</span><span className="hidden md:block">NEXT STEP</span>
          </div>
          {state.needsYou.value.items.length === 0 && <p className="px-5 py-6 text-[13px] text-[var(--mm-ink-2)]">Nothing needs you.</p>}
          <div role="table" aria-label="Needs you">
            {state.needsYou.value.items.map((item, index) => {
              const key = String(item.problem.id);
              return (
                <NeedsYouRow
                  key={key}
                  item={item}
                  index={index}
                  selected={selected === key}
                  open={open?.key === key ? open.panel : null}
                  dimmed={open !== null && open.key !== key}
                  onSelect={() => { if (open === null) setSelected(key); }}
                  onOpen={(panel) => setOpen({ key, panel })}
                  onClose={() => setOpen(null)}
                  onChanged={changed}
                  onOpenHealth={onOpenHealth}
                  onUnauthenticated={onUnauthenticated}
                />
              );
            })}
          </div>
        </>
      )}
      {tab !== 'needs_you' && state.wanted.kind === 'ready' && (
        <WantedList
          key={tab}
          items={tab === 'missing' ? state.wanted.value.missing : state.wanted.value.cutoff}
          empty={tab === 'missing' ? 'Nothing is missing.' : 'Nothing is below cutoff.'}
          now={now}
          open={open}
          setOpen={setOpen}
          onChanged={changed}
          onUnauthenticated={onUnauthenticated}
        />
      )}
    </section>
  );
}
