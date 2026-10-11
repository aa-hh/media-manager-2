import { Clock, Download, Ellipsis } from 'lucide-react';
import { type RefObject, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { CardChoice } from '@/components/ui/card-choice';
import { Dialog } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { HeaderPage } from '@/components/ui/header-page';
import { LabelGroup } from '@/components/ui/label-group';
import { RadioGroup } from '@/components/ui/radio';
import { type DownloadState, RowDownload, RowDownloadHeader } from '@/components/ui/row-download';
import { SkeletonRowTwoLine } from '@/components/ui/skeleton';
import { StatusInline } from '@/components/ui/status-inline';
import { Table } from '@/components/ui/table';
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

const groupTitles: Record<Group['key'], string> = {
  needs_you: 'Needs you',
  handling: 'Being handled by media-manager-2',
  rest: 'Everything else',
};

const serviceName = (item: QueueItem) => (item.service === 'sonarr' ? 'Sonarr' : 'Radarr');
const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const useClock = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
};

// Lime while bytes arrive, amber when the import is blocked, red for every other risk except waiting for peers, grey otherwise.
const downloadState = (row: Row): DownloadState => {
  if (row.status.word === 'import blocked') return 'import-blocked';
  if (row.status.tone === 'risk' && row.status.word !== 'waiting for peers') return 'stalled';
  if (row.downloading && row.status.word === 'downloading') return 'downloading';
  return 'waiting';
};

const stateLabel = (row: Row, now: number) => {
  if (row.delayedUntil !== null) {
    return <><Clock aria-hidden="true" />{`Delayed · ${row.delayedUntil > now ? `grabs in ${formatDuration(row.delayedUntil - now)}` : 'grabbing now'}`}</>;
  }
  const word = capitalised(row.status.word);
  if (row.status.word === 'seeding' && row.ratio !== '') return `${word} · ratio ${row.ratio}`;
  if (row.seeders !== null && ['downloading', 'stalled', 'waiting for peers'].includes(row.status.word)) return `${word} · ${row.seeders} seeders`;
  return word;
};

const speedText = (row: Row) => {
  if (row.downloading) return formatSpeed(row.downRate);
  return row.upRate > 0 ? `${formatSpeed(row.upRate)} up` : '';
};

// The second line: what media-manager-2 is doing about a problem, else why it stopped, else the release.
const detailText = (row: Row) => {
  if (row.problems.length > 0) {
    const needsYou = row.problems.some((problem) => problem.state === 'needs_you');
    const text = row.problems.map((problem) => (latestStep(problem) === problem.summary ? problem.summary : `${problem.summary} ${latestStep(problem)}`)).join(' · ');
    return <span className={cn(needsYou && 'text-foreground')}>{text}</span>;
  }
  if (row.status.tone === 'risk' && row.status.detail !== '') return <span className="text-foreground">{row.status.detail}</span>;
  const parts = [row.quality, row.release];
  if (row.status.word === 'importing' || row.status.word === 'queued') parts.push(row.status.detail);
  if (row.progress === null && row.queueItem !== null) parts.push(`in ${row.queueItem.service === 'sonarr' ? "Sonarr's" : "Radarr's"} queue, not in rTorrent yet`);
  const text = parts.filter((part) => part !== '').join(' · ');
  return text === '' ? undefined : text;
};

function RemoveDialog({ open, row, item, onDone, onCancel }: { open: boolean; row: Row; item: QueueItem; onDone: () => void; onCancel: () => void }) {
  const [release, setRelease] = useState<Release>(row.byHand ? 'keep' : 'blocklist_search');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const service = serviceName(item);
  const confirm = async () => {
    setSending(true);
    setFailed(false);
    const status = await postAction(`/api/queue/${item.service}/${item.queueId}/remove`, { release }).catch(() => 0);
    setSending(false);
    if (status === 204) onDone();
    else setFailed(true);
  };
  const cancel = () => { setFailed(false); onCancel(); };
  const chosen = releaseChoices.find((choice) => choice.value === release)!;
  const descriptions: Record<Release, string> = {
    blocklist: `${service} won't grab this release again.`,
    blocklist_search: `${service} won't grab it again and searches for another release now.`,
    keep: `${service} may grab this same release again.${row.byHand ? ' You picked this release.' : ''}`,
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => { if (!next) cancel(); }}
      title="Remove from downloads?"
      subject={`${[row.label, row.quality, row.release].filter((part) => part !== '').join(' · ')}. The torrent keeps seeding in rTorrent; media-manager-2 never removes a torrent from here.`}
      callout={failed ? <Callout look="risk" title={`${service} did not remove it. Try again.`} /> : undefined}
      actions={(
        <>
          <Button variant="outline" onClick={cancel}>Cancel</Button>
          <Button variant="destructive" size="large" loading={sending} onClick={() => void confirm()}>
            {release === 'blocklist_search' ? 'Remove and search again' : `Remove from downloads, keep seeding, ${chosen.summary}`}
          </Button>
        </>
      )}
    >
      <RadioGroup value={release} onValueChange={(value) => setRelease(value as Release)} className="flex flex-col gap-2">
        {releaseChoices.map((choice) => (
          <CardChoice key={choice.value} value={choice.value} title={choice.label} description={descriptions[choice.value]} />
        ))}
      </RadioGroup>
    </Dialog>
  );
}

type Panel = 'remove' | 'import';

function DownloadRow({ row, now, selected, dimmed, panel, onSelect, onOpen, onClose, onChanged }: {
  row: Row; now: number; selected: boolean; dimmed: boolean; panel: Panel | null;
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
  const canGrab = delayed && item !== null;
  const canImport = row.importable !== null;
  const canRemove = item !== null;
  const hasActions = canGrab || canImport || canRemove;
  return (
    <>
      <RowDownload
        title={row.label}
        detail={detailText(row)}
        progress={row.progress ?? undefined}
        speed={speedText(row)}
        eta={row.timeLeft}
        tracker={row.tracker === '' ? undefined : row.tracker}
        state={downloadState(row)}
        stateLabel={stateLabel(row, now)}
        selected={selected}
        aria-selected={selected}
        onClick={onSelect}
        className={cn('transition', dimmed && 'opacity-35')}
        actions={hasActions && (
          <span className="flex items-center" onClick={(event) => event.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="row" iconOnly icon={<Ellipsis className="text-muted-foreground" />} aria-label={`Actions for ${row.label}`} />} />
              <DropdownMenuContent align="end">
                {canGrab && <DropdownMenuItem onClick={() => void grabNow()}>Grab now</DropdownMenuItem>}
                {canImport && <DropdownMenuItem onClick={() => onOpen('import')}>Import by hand</DropdownMenuItem>}
                {canRemove && <DropdownMenuItem onClick={() => onOpen('remove')}>Remove from downloads</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        )}
      />
      {selected && panel !== 'import' && hasActions && (
        <div className="flex h-(--row) w-full shrink-0 items-center gap-2 border-b border-border bg-selected px-4">
          {canGrab && <Button size="row" loading={grabbing} onClick={() => void grabNow()}>Grab now</Button>}
          {canImport && <Button size="row" variant="outline" onClick={() => onOpen('import')}>Import by hand</Button>}
          {canRemove && <Button size="row" variant="outline" onClick={() => onOpen('remove')}>Remove from downloads</Button>}
          {grabFailed && item !== null && <StatusInline status="failed">{serviceName(item)} did not grab it. Try again.</StatusInline>}
        </div>
      )}
      {selected && item !== null && <RemoveDialog open={panel === 'remove'} row={row} item={item} onDone={onChanged} onCancel={onClose} />}
      {panel === 'import' && row.importable !== null && (
        <div className="w-full border-b border-border bg-selected px-4 pt-1 pb-4">
          <ImportPanel
            service={row.importable.service}
            downloadId={row.importable.downloadId}
            onDone={onChanged}
            onCancel={onClose}
          />
        </div>
      )}
    </>
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
    <section aria-label="Downloads">
      <HeaderPage
        ref={headingRef}
        tabIndex={-1}
        title="Downloads"
        summary={state.kind === 'ready' ? headerSummary(rows, groups) : undefined}
        note={state.kind !== 'ready'
          ? undefined
          : state.live
            ? 'live from rTorrent, plus releases Sonarr and Radarr are holding back'
            : <StatusInline status="busy">reconnecting to live updates…</StatusInline>}
      />
      {state.kind === 'loading' && (
        <div className="flex w-full flex-col gap-3">
          <p className="text-label font-normal text-muted-foreground">Reading downloads…</p>
          <div className="flex w-full flex-col">
            {Array.from({ length: 6 }, (_, index) => <SkeletonRowTwoLine key={index} />)}
          </div>
        </div>
      )}
      {state.kind === 'failed' && (
        <Callout look="risk" title="Downloads could not be read." action={<Button variant="outline" onClick={() => void reload()}>Try again</Button>} />
      )}
      {state.kind === 'ready' && rows.length === 0 && (
        <div className="w-full pt-24">
          <EmptyState icon={<Download />} title="Nothing is downloading" className="w-100">
            Grabs from Sonarr, Radarr and you show up here within seconds.
          </EmptyState>
        </div>
      )}
      {state.kind === 'ready' && groups.map((group) => (
        <div key={group.key}>
          <LabelGroup count={group.rows.length}>{groupTitles[group.key]}</LabelGroup>
          <Table aria-label={groupTitles[group.key]}>
            <RowDownloadHeader />
            {group.rows.map((row) => (
              <DownloadRow
                key={row.key}
                row={row}
                now={now}
                selected={selected === row.key}
                dimmed={open !== null && open.panel === 'import' && open.key !== row.key}
                panel={open?.key === row.key ? open.panel : null}
                onSelect={() => { if (open === null) setSelected(row.key); }}
                onOpen={(panel) => { setSelected(row.key); setOpen({ key: row.key, panel }); }}
                onClose={() => setOpen(null)}
                onChanged={changed}
              />
            ))}
          </Table>
        </div>
      ))}
    </section>
  );
}
