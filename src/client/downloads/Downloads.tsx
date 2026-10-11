import { type ReactNode, type RefObject, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ImportPanel } from './ImportPanel';
import { buildRows, formatDuration, formatSpeed, groupRows, latestStep, type Group, type QueueItem, type Row } from './model';
import { postAction, type DownloadsState } from './useDownloads';

type Release = 'keep' | 'blocklist' | 'blocklist_search';

const releaseChoices: { value: Release; label: string; summary: string }[] = [
  { value: 'blocklist', label: 'Blocklist only', summary: 'blocklist' },
  { value: 'blocklist_search', label: 'Blocklist and search again', summary: 'blocklist and search again' },
  { value: 'keep', label: "Don't blocklist", summary: "don't blocklist" },
];

const columns = 'grid grid-cols-[44px_minmax(0,1fr)_112px] items-center gap-3 md:grid-cols-[56px_minmax(0,1fr)_152px_150px] lg:grid-cols-[56px_minmax(0,1fr)_96px_152px_64px_170px_56px_48px_minmax(0,200px)_52px]';
const wide = 'hidden lg:block';
const medium = 'hidden md:block';

const useClock = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
};

function ActionButton({ children, onClick, disabled, filled }: { children: ReactNode; onClick: () => void; disabled?: boolean; filled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => { event.stopPropagation(); onClick(); }}
      className={cn(
        'h-8 shrink-0 px-3 font-ui text-[14px] font-semibold disabled:opacity-50',
        'focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-[var(--mm-ink)]',
        filled ? 'bg-[var(--mm-ink)] text-[var(--mm-on-cell)]' : 'border border-[var(--mm-ink-3)] text-[var(--mm-ink)] hover:bg-[var(--mm-row-hover)]',
      )}
    >
      {children}
    </button>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 bg-[var(--mm-seam)]" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-[var(--mm-ink)]" style={{ width: `${value}%` }} />
      </div>
      <span className="w-10 tabular-nums">{value}%</span>
    </div>
  );
}

function RemovePanel({ row, item, onDone, onCancel }: { row: Row; item: QueueItem; onDone: () => void; onCancel: () => void }) {
  const [release, setRelease] = useState<Release>(row.byHand ? 'keep' : 'blocklist_search');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const confirm = async () => {
    setSending(true);
    setFailed(false);
    const status = await postAction(`/api/queue/${item.service}/${item.queueId}/remove`, { release }).catch(() => 0);
    setSending(false);
    if (status === 204) onDone();
    else setFailed(true);
  };
  const chosen = releaseChoices.find((choice) => choice.value === release)!;
  return (
    <div className="space-y-3 border-t border-[var(--mm-seam)] bg-[var(--mm-row-hover)] px-5 py-4" onClick={(event) => event.stopPropagation()}>
      <p className="text-[var(--mm-ink)]">Remove from downloads</p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="w-[110px] text-[var(--mm-ink-2)]">Torrent</span>
        <span>Keep seeding in rTorrent</span>
        <span className="text-[var(--mm-ink-2)]">media-manager-2 never removes a torrent from here</span>
      </div>
      <fieldset className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <legend className="float-left w-[110px] text-[var(--mm-ink-2)]">Release</legend>
        {releaseChoices.map((choice) => (
          <label key={choice.value} className={cn('flex cursor-pointer items-center gap-2', release === choice.value ? 'text-[var(--mm-ink)]' : 'text-[var(--mm-ink-2)]')}>
            <input
              type="radio"
              name={`release-${row.key}`}
              value={choice.value}
              checked={release === choice.value}
              onChange={() => setRelease(choice.value)}
              className="accent-[var(--mm-ink)]"
            />
            {choice.label}
            {choice.value === 'keep' && row.byHand && <span className="text-[var(--mm-ink-2)]">you picked this release</span>}
          </label>
        ))}
      </fieldset>
      {failed && <p role="alert" className="text-[var(--mm-risk)]">{item.service === 'sonarr' ? 'Sonarr' : 'Radarr'} did not remove it. Try again.</p>}
      <div className="flex items-center gap-3">
        <ActionButton filled disabled={sending} onClick={() => void confirm()}>
          {sending ? 'Removing…' : `Remove from downloads, keep seeding, ${chosen.summary}`}
        </ActionButton>
        <ActionButton onClick={onCancel}>Cancel</ActionButton>
      </div>
    </div>
  );
}

type Panel = 'remove' | 'import';

function DownloadRow({ row, index, now, selected, dimmed, panel, onSelect, onOpen, onClose, onChanged }: {
  row: Row; index: number; now: number; selected: boolean; dimmed: boolean; panel: Panel | null;
  onSelect: () => void; onOpen: (panel: Panel) => void; onClose: () => void; onChanged: () => void;
}) {
  const [grabbing, setGrabbing] = useState(false);
  const [grabFailed, setGrabFailed] = useState(false);
  const item = row.queueItem;
  const delayed = row.delayedUntil !== null;
  const grabNow = async () => {
    if (item === null) return;
    setGrabbing(true);
    setGrabFailed(false);
    const status = await postAction(`/api/queue/${item.service}/${item.queueId}/grab`).catch(() => 0);
    setGrabbing(false);
    if (status === 204) onChanged();
    else setGrabFailed(true);
  };
  const statusDetail = delayed
    ? (row.delayedUntil! > now ? `grabs in ${formatDuration(row.delayedUntil! - now)}` : 'grabbing now')
    : row.status.detail;
  return (
    <div
      className={cn(
        'border-b border-[var(--mm-seam)] font-data text-[13px]',
        selected ? 'bg-[var(--mm-row-hover)]' : index % 2 === 0 ? 'bg-[var(--mm-row)]' : 'bg-[var(--mm-row-alt)]',
        dimmed && 'opacity-35',
      )}
      onClick={onSelect}
      aria-selected={selected}
      role="row"
    >
      <div className={cn(columns, 'min-h-[34px] px-5 py-1')}>
        <span className="text-[var(--mm-ink-2)]">{row.quality}</span>
        <span className="min-w-0 [overflow-wrap:anywhere]">
          <span className="text-[var(--mm-ink)]">{row.label}</span>
          {row.progress !== null && <span className="ml-2 tabular-nums text-[var(--mm-ink-2)] md:hidden">{row.progress}%</span>}
          {row.release !== '' && <span className="ml-2 text-[var(--mm-ink-3)]">{row.release}</span>}
        </span>
        <span className={cn(wide, 'truncate text-[var(--mm-ink-2)]')}>{row.tracker}</span>
        <span className={cn(medium, 'min-w-0', row.progress === null && 'text-[var(--mm-ink-3)]')}>
          {row.progress !== null
            ? <Progress value={row.progress} />
            : item !== null ? `in ${item.service === 'sonarr' ? "Sonarr's" : "Radarr's"} queue, not in rTorrent yet` : ''}
        </span>
        <span className={cn(wide, 'tabular-nums text-[var(--mm-ink-2)]')}>{row.timeLeft}</span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2">
          <span className={row.status.tone === 'risk' ? 'text-[var(--mm-risk)]' : 'text-[var(--mm-ink)]'}>{row.status.word}</span>
          {statusDetail !== '' && <span className="truncate text-[var(--mm-ink-2)]" title={statusDetail}>{statusDetail}</span>}
        </span>
        <span className={cn(wide, 'tabular-nums', row.seeders === 0 ? 'text-[var(--mm-risk)]' : 'text-[var(--mm-ink-2)]')}>{row.seeders ?? ''}</span>
        <span className={cn(wide, 'tabular-nums text-[var(--mm-ink-2)]')}>{row.ratio}</span>
        <span className={cn(wide, 'truncate text-[var(--mm-ink-2)]')} title={row.formats}>{row.formats}</span>
        <span className={cn(wide, 'tabular-nums text-[var(--mm-ink)]')}>{row.score}</span>
      </div>
      {row.problems.map((problem) => (
        <p key={problem.id} className="px-5 pb-2 md:pl-[88px] text-[var(--mm-ink-2)]">
          <span className={problem.state === 'needs_you' ? 'text-[var(--mm-ink)]' : undefined}>{problem.summary}</span>
          {latestStep(problem) !== problem.summary && <span> {latestStep(problem)}</span>}
        </p>
      ))}
      {row.status.tone === 'risk' && row.status.detail !== '' && row.problems.length === 0 && (
        <p className="px-5 pb-2 md:pl-[88px] text-[var(--mm-ink-2)]">{row.status.detail}</p>
      )}
      {selected && panel === null && (item !== null || row.importable !== null) && (
        <div className="flex flex-wrap items-center gap-3 px-5 pb-3 md:pl-[88px]">
          {delayed && <ActionButton disabled={grabbing} onClick={() => void grabNow()}>{grabbing ? 'Grabbing…' : 'Grab now'}</ActionButton>}
          {row.importable !== null && <ActionButton onClick={() => onOpen('import')}>Import by hand</ActionButton>}
          {item !== null && <ActionButton onClick={() => onOpen('remove')}>Remove from downloads</ActionButton>}
          {grabFailed && item !== null && <span role="alert" className="text-[var(--mm-risk)]">{item.service === 'sonarr' ? 'Sonarr' : 'Radarr'} did not grab it. Try again.</span>}
        </div>
      )}
      {panel === 'remove' && item !== null && <RemovePanel row={row} item={item} onDone={onChanged} onCancel={onClose} />}
      {panel === 'import' && row.importable !== null && (
        <ImportPanel
          service={row.importable.service}
          downloadId={row.importable.downloadId}
          onDone={onChanged}
          onCancel={onClose}
          button={({ children, ...props }) => <ActionButton {...props}>{children}</ActionButton>}
        />
      )}
    </div>
  );
}

const headerSummary = (rows: Row[], groups: Group[]) => {
  const count = (key: Group['key']) => groups.find((group) => group.key === key)?.rows.length ?? 0;
  return [`${rows.length} ${rows.length === 1 ? 'item' : 'items'}`, `${count('needs_you')} needs you`, `${count('handling')} being handled`].join(' · ');
};

export function DownloadsScreen({ state, reload, headingRef }: {
  state: DownloadsState; reload: () => Promise<void>; headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const now = useClock();
  const rows = useMemo(() => (state.kind === 'ready' ? buildRows(state.snapshot) : []), [state]);
  const groups = useMemo(() => groupRows(rows), [rows]);
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<{ key: string; panel: Panel } | null>(null);

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
  return (
    <section aria-labelledby="downloads-heading">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 pb-3 pt-5">
        <h1 ref={headingRef} id="downloads-heading" tabIndex={-1} className="font-ui text-[22px] font-semibold text-[var(--mm-ink)]">Downloads</h1>
        {state.kind === 'ready' && <p className="text-[13px] text-[var(--mm-ink-2)]">{headerSummary(rows, groups)}</p>}
        <span className="flex-1" />
        {state.kind === 'ready' && (
          <p className="text-[12px] text-[var(--mm-ink-3)]">
            {state.live ? 'live from rTorrent, plus releases Sonarr and Radarr are holding back' : 'reconnecting to live updates…'}
          </p>
        )}
      </div>
      {state.kind === 'loading' && <p className="px-5 py-6 text-[13px] text-[var(--mm-ink-2)]">Reading downloads…</p>}
      {state.kind === 'failed' && (
        <div className="flex items-center gap-3 px-5 py-6 text-[13px]">
          <p role="alert" className="text-[var(--mm-risk)]">Downloads could not be read.</p>
          <ActionButton onClick={() => void reload()}>Try again</ActionButton>
        </div>
      )}
      {state.kind === 'ready' && (<>
      <div className={cn(columns, 'h-[30px] bg-[var(--mm-row)] px-5 font-data text-[11px] font-bold tracking-[0.6px] text-[var(--mm-ink-2)]')} role="row">
        <span>QUALITY</span><span>TITLE</span><span className={wide}>TRACKER</span><span className={medium}>PROGRESS</span><span className={wide}>TIME LEFT</span>
        <span>STATUS</span><span className={wide}>SEEDERS</span><span className={wide}>RATIO</span>
        <span className={cn(wide, 'text-[var(--mm-ink-3)]')}>CUSTOM FORMATS</span><span className={cn(wide, 'text-[var(--mm-ink-3)]')}>SCORE</span>
      </div>
      {rows.length === 0 && <p className="px-5 py-6 text-[13px] text-[var(--mm-ink-2)]">Nothing is downloading.</p>}
      <div role="table" aria-label="Downloads">
        {groups.map((group) => (
          <div key={group.key} role="rowgroup">
            <p className="border-b border-[var(--mm-seam)] bg-[var(--mm-ground)] px-5 pb-1.5 pt-3 font-data text-[11px] font-bold tracking-[0.6px] text-[var(--mm-ink-2)]">
              {group.title} · {group.rows.length}
            </p>
            {group.rows.map((row, index) => (
              <DownloadRow
                key={row.key}
                row={row}
                index={index}
                now={now}
                selected={selected === row.key}
                dimmed={open !== null && open.key !== row.key}
                panel={open?.key === row.key ? open.panel : null}
                onSelect={() => { if (open === null) setSelected(row.key); }}
                onOpen={(panel) => setOpen({ key: row.key, panel })}
                onClose={() => setOpen(null)}
                onChanged={changed}
              />
            ))}
          </div>
        ))}
      </div>
      </>)}
    </section>
  );
}

// The one-line bar on every screen: what is downloading, total speed, and how many things need the owner.
export function LiveBar({ state, onOpen }: { state: DownloadsState; onOpen: () => void }) {
  const rows = useMemo(() => (state.kind === 'ready' ? buildRows(state.snapshot) : []), [state]);
  const downloading = rows.filter((row) => row.downloading);
  const down = rows.reduce((total, row) => total + row.downRate, 0);
  const up = rows.reduce((total, row) => total + row.upRate, 0);
  const needsYou = groupRows(rows).find((group) => group.key === 'needs_you')?.rows.length ?? 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="fixed inset-x-0 bottom-0 flex h-8 w-full items-center gap-4 overflow-hidden border-t border-[var(--mm-seam)] bg-[var(--mm-row)] px-5 text-left font-data text-[13px] whitespace-nowrap focus-visible:outline-1 focus-visible:outline-[var(--mm-ink)]"
    >
      <span className="text-[var(--mm-ink)]">{state.kind === 'ready' ? `${downloading.length} downloading` : 'downloads'}</span>
      <span className="text-[var(--mm-ink-2)]">{`${formatSpeed(down)} down`}<span className="hidden sm:inline">{` · ${formatSpeed(up)} up`}</span></span>
      {needsYou > 0 && <span className="text-[var(--mm-risk)]">{needsYou} {needsYou === 1 ? 'needs' : 'need'} you</span>}
      <span className="hidden min-w-0 truncate text-[12px] text-[var(--mm-ink-2)] md:inline">
        {downloading.map((row) => `${row.label} ${row.progress ?? 0}%`).join(' · ')}
      </span>
      <span className="flex-1" />
      <span className="text-[12px] text-[var(--mm-ink-2)]">open</span>
    </button>
  );
}
