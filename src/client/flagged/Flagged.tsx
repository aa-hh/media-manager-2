import { Flag } from 'lucide-react';
import { memo, Suspense, useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { HeaderPage } from '@/components/ui/header-page';
import { PanelInline } from '@/components/ui/panel-inline';
import { RowFlagged } from '@/components/ui/row-flagged';
import { SkeletonRowTwoLine } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { StatusInline } from '@/components/ui/status-inline';
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs-trigger';
import { cn } from '@/lib/utils';
import { ImportPanel } from '../downloads/ImportPanel';
import { formatDuration, type Service } from '../downloads/model';
import { postAction } from '../downloads/useDownloads';
import type { OwnedEpisode, ReleaseTarget } from '../PickRelease';
import { lazyScreen } from '../lazyScreen';
import { useScreenReady } from '../navigation';
import type { FlaggedAction, FlaggedItem, FlaggedState, Wanted } from './useFlagged';

const PickRelease = lazyScreen(() => import('../PickRelease').then((module) => module.PickRelease));

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
// Rows dim while another row's panel is open; the opacity change runs at duration-fast like the row's colours.
const dim = (dimmed: boolean) => cn('transition-all', dimmed && 'opacity-35');
const actionsLine = 'flex h-(--row) w-full shrink-0 items-center gap-2 border-b border-border bg-selected pr-4';

const sendSearch = async (service: Service, type: 'movie' | 'episode', ids: number[], onUnauthenticated: () => void) => {
  const status = await postAction('/api/flagged/search', { service, type, ids }).catch(() => 0);
  if (status === 401) onUnauthenticated();
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
  if (owned.kind === 'ready') {
    // The server's labels read "Series S02E08" or "Movie (2024)"; its "Sonarr episode 12" and "Radarr movie 7" fallbacks carry no name.
    const name = target.kind === 'movie' ? (/^Radarr movie \d+$/.test(title) ? undefined : title) : /^(.+) S\d{2,}E\d{2,}$/.exec(title)?.[1];
    return (
      <PanelInline open title={`Pick a release for ${title}`} onClose={onClose}>
        <Suspense fallback={null}>
          <PickRelease target={target} name={name} episodes={owned.episodes} movieHasFile={owned.movieHasFile} variant="movie" onClose={onClose} onUnauthenticated={onUnauthenticated} />
        </Suspense>
      </PanelInline>
    );
  }
  return (
    <PanelInline open title={`Pick a release for ${title}`} onClose={onClose}>
      <div className="px-5 pt-3 pb-6">
        {owned.kind === 'loading'
          ? (
            <p className="flex items-center gap-2 font-ui text-sm text-muted-foreground">
              <Spinner />
              Reading {title} from {serviceName(target.service)}…
            </p>
          )
          : <Callout title={`${serviceName(target.service)} could not be read.`} action={<Button variant="outline" size="row" onClick={onClose}>Close</Button>} />}
      </div>
    </PanelInline>
  );
}

type Open = { key: string; panel: 'pick' | 'import' };

function NeedsYouRow({ item, selected, open, dimmed, onSelect, onOpen, onClose, onChanged, onOpenHealth, onUnauthenticated }: {
  item: FlaggedItem; selected: boolean; open: Open['panel'] | null; dimmed: boolean;
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
      const ok = await sendSearch(action.service, action.type, action.ids, onUnauthenticated);
      setSearching(false);
      setSearched({ ok, service: action.service });
    }
  };
  return (
    <>
      <RowFlagged
        title={item.label}
        reason={`${item.kindWord} · ${item.detail}`}
        actions={<span className="w-full truncate text-right font-ui text-muted-foreground">{item.actions.map((action) => actionLabels[action.kind]).join(' · ')}</span>}
        selected={selected}
        aria-selected={selected}
        onClick={onSelect}
        className={dim(dimmed)}
      />
      {selected && open === null && item.actions.length > 0 && (
        <div className={cn(actionsLine, 'pl-16')}>
          {item.actions.map((action, index) => (
            <Button
              key={action.kind}
              size="row"
              variant={index === 0 ? 'default' : 'outline'}
              loading={action.kind === 'search' && searching}
              onClick={() => void run(action)}
            >
              {actionLabels[action.kind]}
            </Button>
          ))}
          {searched?.ok === true && <StatusInline status="sent">Search sent</StatusInline>}
          {searched?.ok === false && <StatusInline status="failed">{serviceName(searched.service)} refused the search.</StatusInline>}
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
          onUnauthenticated={onUnauthenticated}
        />
      )}
    </>
  );
}

const searchedText = (item: Wanted, now: number) => [
  item.lastSearchAt === null ? 'never' : `last ${formatDuration(now - item.lastSearchAt)} ago`,
  item.backlog ? 'not searched automatically'
    : item.nextSearchAt === null ? 'not available yet' : `next in ${formatDuration(item.nextSearchAt - now)}`,
].join(' · ');

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const dateText = (at: number | null) => (at === null ? '' : dateFormat.format(at));

const wantedKey = (item: Wanted) => `${item.service}:${item.type}:${item.id}`;

const wantedTarget = (item: Wanted): ReleaseTarget | undefined => {
  if (item.type === 'movie') return { service: 'radarr', kind: 'movie', movieId: item.id };
  return item.seriesId === null ? undefined : { service: 'sonarr', kind: 'episode', seriesId: item.seriesId, episodeId: item.id };
};

// Memoised so ticking one checkbox in a long Missing list re-renders one row, not all of them.
const WantedRow = memo(function WantedRow({ item, now, checked, selected, dimmed, panelOpen, actionsShown, onToggle, onSelect, onPick, onChanged, onUnauthenticated }: {
  item: Wanted; now: number; checked: boolean; selected: boolean; dimmed: boolean; panelOpen: boolean; actionsShown: boolean;
  onToggle: (key: string) => void; onSelect: (key: string) => void; onPick: (key: string) => void; onChanged: () => void; onUnauthenticated: () => void;
}) {
  const key = wantedKey(item);
  const target = wantedTarget(item);
  return (
    <div className="contents">
      <TableRow
        selected={selected}
        aria-selected={selected}
        onClick={() => onSelect(key)}
        className={cn('h-(--row-two-line)', dim(dimmed))}
      >
        <TableCell className="w-4">
          {!item.inQueue && (
            <Checkbox
              aria-label={`Select ${item.title}`}
              checked={checked}
              onClick={(event) => event.stopPropagation()}
              onCheckedChange={() => onToggle(key)}
            />
          )}
        </TableCell>
        <TableCell fill className="flex-col items-start justify-center gap-0.5">
          <span className="w-full truncate font-ui font-semibold" title={item.title}>{item.title}</span>
          <span className="w-full truncate text-muted-foreground" title={item.lastResult}>Last result: {item.lastResult}</span>
        </TableCell>
        <TableCell className="w-40 text-muted-foreground">{dateText(item.availableAt)}</TableCell>
        <TableCell className="w-16 text-muted-foreground">{item.type === 'movie' ? 'Movie' : 'Episode'}</TableCell>
        <TableCell className="w-60 text-muted-foreground">
          <span className="min-w-0 truncate">{searchedText(item, now)}</span>
        </TableCell>
      </TableRow>
      {actionsShown && target !== undefined && (
        <div className={cn(actionsLine, 'pl-12')}>
          <Button size="row" variant="outline" onClick={() => onPick(key)}>Pick a release</Button>
        </div>
      )}
      {panelOpen && target !== undefined && (
        <PickPanel target={target} title={item.title} onClose={onChanged} onUnauthenticated={onUnauthenticated} />
      )}
    </div>
  );
});

function WantedList({ items, empty, now, open, setOpen, onChanged, onUnauthenticated }: {
  items: Wanted[]; empty: string; now: number; open: Open | null; setOpen: (open: Open | null) => void;
  onChanged: () => void; onUnauthenticated: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [refused, setRefused] = useState<Service[] | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const searchable = items.filter((item) => !item.inQueue);
  const chosen = searchable.filter((item) => checked.has(wantedKey(item)));
  const toggle = useCallback((key: string) => setChecked((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  }), []);
  const select = useCallback((key: string) => { if (openRef.current === null) setSelected(key); }, []);
  const pick = useCallback((key: string) => setOpen({ key, panel: 'pick' }), [setOpen]);
  // One search per service and type, since Sonarr and Radarr each take one command for many ids.
  const search = async () => {
    setSearching(true);
    const groups = new Map<string, Wanted[]>();
    for (const item of chosen) groups.set(`${item.service}:${item.type}`, [...(groups.get(`${item.service}:${item.type}`) ?? []), item]);
    const results = await Promise.all([...groups.values()].map(async (group) => ({
      service: group[0].service,
      ok: await sendSearch(group[0].service, group[0].type, group.map((item) => item.id), onUnauthenticated),
    })));
    setSearching(false);
    setRefused(results.filter((result) => !result.ok).map((result) => result.service));
    setChecked(new Set());
    onChanged();
  };
  const allChecked = searchable.length > 0 && chosen.length === searchable.length;
  if (items.length === 0) return <EmptyState icon={<Flag />} title={empty} className="w-full max-w-90 py-16" />;
  return (
    <>
      {refused !== null && (
        <div className="flex flex-wrap items-center gap-3">
          {refused.length === 0 && <StatusInline status="sent">Search sent</StatusInline>}
          {refused.map((service) => <StatusInline key={service} status="failed">{serviceName(service)} refused the search.</StatusInline>)}
        </div>
      )}
      {chosen.length > 0 && (
        <div className="flex h-7 items-center gap-3">
          <span className="text-label text-foreground">{chosen.length} selected</span>
          <Button size="row" loading={searching} onClick={() => void search()}>Search</Button>
          <Button size="row" variant="outline" onClick={() => setChecked(new Set())}>Clear</Button>
        </div>
      )}
      <Table aria-label="Wanted">
        <TableHeader>
          <TableHead className="w-4">
            <Checkbox
              aria-label="Select every item that can be searched"
              checked={allChecked}
              indeterminate={chosen.length > 0 && !allChecked}
              disabled={searchable.length === 0}
              onCheckedChange={() => setChecked(allChecked ? new Set() : new Set(searchable.map(wantedKey)))}
            />
          </TableHead>
          <TableHead fill>Title and last result</TableHead>
          <TableHead className="w-40">Date, oldest first</TableHead>
          <TableHead className="w-16">Type</TableHead>
          <TableHead className="w-60">Searched</TableHead>
        </TableHeader>
        {items.map((item) => {
          const key = wantedKey(item);
          return (
            <WantedRow
              key={key}
              item={item}
              now={now}
              checked={checked.has(key)}
              selected={selected === key}
              dimmed={open !== null && open.key !== key}
              panelOpen={open?.key === key}
              actionsShown={selected === key && open === null}
              onToggle={toggle}
              onSelect={select}
              onPick={pick}
              onChanged={onChanged}
              onUnauthenticated={onUnauthenticated}
            />
          );
        })}
      </Table>
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

  const changed = useCallback(() => {
    setOpen(null);
    setSelected(null);
    void reload();
  }, [reload]);
  const switchTab = (next: Tab) => {
    setTab(next);
    setOpen(null);
    setSelected(null);
  };

  const handled = state.needsYou.kind === 'ready' ? state.needsYou.value.handledThisWeek : undefined;
  const note = handled === undefined ? undefined
    : tab === 'needs_you'
      ? `Automatic fixes handled ${handled} ${handled === 1 ? 'problem' : 'problems'} this week on their own. These are the ones they gave up on.`
      : `Automatic fixes handled ${handled} ${handled === 1 ? 'problem' : 'problems'} this week. Missing items are searched every 6h.`;
  const counts: Record<Tab, number | undefined> = {
    needs_you: state.needsYou.kind === 'ready' ? state.needsYou.value.items.length : undefined,
    missing: state.wanted.kind === 'ready' ? state.wanted.value.missing.length : undefined,
    cutoff: state.wanted.kind === 'ready' ? state.wanted.value.cutoff.length : undefined,
  };
  const words: Record<Tab, string> = { needs_you: 'need you', missing: 'missing', cutoff: 'below cutoff' };
  const summary = tabs.flatMap(({ key }) => (counts[key] === undefined ? [] : [`${counts[key]} ${words[key]}`])).join(' · ');
  const load = tab === 'needs_you' ? state.needsYou : state.wanted;
  const late = useScreenReady(load.kind !== 'loading');
  // Switching tabs crossfades; the screen's first draw is already part of the screen change.
  const [firstTab] = useState(tab);

  return (
    <section aria-label="Flagged" className="flex flex-col gap-6 pt-2 pb-6">
      <div ref={headingRef} tabIndex={-1}>
        <HeaderPage title="Flagged" summary={load.kind === 'ready' ? summary : undefined} note={load.kind === 'ready' ? note : undefined} />
      </div>
      <Tabs value={tab} onValueChange={(value) => switchTab(value as Tab)}>
        <TabsList aria-label="Flagged lists" className="gap-5 border-b border-border">
          {tabs.map((item) => <TabsTrigger key={item.key} value={item.key} count={counts[item.key]}>{item.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      <div key={`${tab}:${load.kind}`} className={cn('flex flex-col gap-6', (tab !== firstTab || late) && 'transition-opacity duration-(--duration-base) ease-out starting:opacity-0')}>
        {load.kind === 'loading' && (
          <div className="flex flex-col gap-3">
            <StatusInline status="busy">Reading flagged items…</StatusInline>
            <div className="flex flex-col">
              {[0, 1, 2, 3, 4].map((index) => <SkeletonRowTwoLine key={index} />)}
            </div>
          </div>
        )}
        {load.kind === 'failed' && (
          <Callout title="Flagged items could not be read." action={<Button variant="outline" size="row" onClick={() => void reload()}>Try again</Button>} />
        )}
        {tab === 'needs_you' && state.needsYou.kind === 'ready' && (state.needsYou.value.items.length === 0
          ? (
            <EmptyState icon={<Flag />} title="Nothing needs you" className="w-full max-w-90 py-16">
              Automatic fixes handled everything. Anything they give up on lands here.
            </EmptyState>
          )
          : (
            <Table aria-label="Needs you">
              <TableHeader>
                <TableHead className="w-8" />
                <TableHead fill>Item</TableHead>
                <TableHead className="w-30" />
                <TableHead className="w-16" />
                <TableHead align="end" className="w-60">Next step</TableHead>
              </TableHeader>
              {state.needsYou.value.items.map((item) => {
                const key = String(item.problem.id);
                return (
                  <NeedsYouRow
                    key={key}
                    item={item}
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
            </Table>
          ))}
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
      </div>
    </section>
  );
}
