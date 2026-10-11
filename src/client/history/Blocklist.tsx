import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';
import { Ban, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Collapsible } from '@/components/ui/collapsible-trigger';
import { EmptyState } from '@/components/ui/empty-state';
import { HeaderPage } from '@/components/ui/header-page';
import { RowBlocklist, RowBlocklistHeader } from '@/components/ui/row-blocklist';
import { SkeletonRow } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { StatusInline } from '@/components/ui/status-inline';
import { Table } from '@/components/ui/table';
import { useToastManager } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
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

// No day headings here, so today's and yesterday's times carry their day word.
const when = (at: number) => (['Today', 'Yesterday'].includes(dayTitle(at)) ? `${dayTitle(at)} ${formatWhen(at)}` : formatWhen(at));
const keyOf = (entry: BlockEntry) => `${entry.service}:${entry.id}`;
const why = (entry: BlockEntry) => (entry.by === 'you' ? `by you ${entry.reason}` : `by ${entry.by}${entry.reason === '' ? '' : `: ${entry.reason}`}`);

// An unblocked row closes to height 0 (duration-base); Undo opens it again.
const panelMotion = cn(
  'h-(--collapsible-panel-height) overflow-hidden transition-all duration-(--duration-base) ease-out',
  'data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none',
);

export function BlocklistScreen({ blocklist }: { blocklist: ReturnType<typeof useBlocklist> }) {
  const { state, loadMore, reload } = blocklist;
  const toasts = useToastManager();
  const [view, setView] = useState<View>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState<BlockEntry | null>(null);
  const pendingRef = useRef<{ entry: BlockEntry; toast: string } | null>(null);

  const show = (key: string, visible: boolean) => setHidden((current) => {
    const next = new Set(current);
    if (visible) next.delete(key);
    else next.add(key);
    return next;
  });

  // The delete goes out only once the Undo window has passed; Sonarr and Radarr cannot put an entry back.
  const commit = async (entry: BlockEntry) => {
    const { status } = await sendJson(`/api/blocklist/${entry.service}/${entry.id}`, 'DELETE').catch(() => ({ status: 0 }));
    if (status === 204) return;
    show(keyOf(entry), true);
    setFailed(entry);
  };

  const undo = () => {
    const current = pendingRef.current;
    if (current === null) return;
    pendingRef.current = null;
    toasts.close(current.toast);
    show(keyOf(current.entry), true);
  };

  const unblock = (entry: BlockEntry) => {
    const previous = pendingRef.current;
    if (previous !== null) toasts.close(previous.toast);
    show(keyOf(entry), false);
    setSelected(null);
    setFailed(null);
    // The Undo window is the toast's own life, which pauses while hovered: the delete goes out when the toast closes
    // by timing out or being dismissed, never while Undo is still on screen.
    const toast = toasts.add({
      title: `Unblocked ${entry.release}`,
      description: `${serviceWords[entry.service]} can grab that release again on the next search.`,
      timeout: UNDO_MS,
      actionProps: { children: 'Undo', onClick: undo },
      onClose: () => {
        if (pendingRef.current?.entry !== entry) return;
        pendingRef.current = null;
        void commit(entry);
      },
    });
    pendingRef.current = { entry, toast };
  };

  const entries = state.kind === 'ready' ? state.items.filter((entry) => !hidden.has(keyOf(entry))) : [];
  const listed = state.kind === 'ready' ? state.items.filter(shows[view]) : [];
  return (
    <section aria-label="Blocklist" className="flex flex-col gap-4 pt-2 pb-6">
      <HeaderPage
        title="Blocklist"
        summary={state.kind === 'ready' ? `${entries.length} blocked releases` : undefined}
        note="Sonarr and Radarr never grab a blocked release again. Unblocking one lets them grab it on the next search."
      />
      <div className="border-b border-border">
        <FilterTabs label="Blocked releases" choices={views} value={view} onChange={(value) => { setSelected(null); setView(value); }} />
      </div>
      {state.kind === 'loading' && (
        <div className="flex flex-col gap-3">
          <StatusInline status="busy">Reading the blocklist…</StatusInline>
          <Table aria-label="Blocklist">
            <RowBlocklistHeader />
            {[0, 1, 2, 3, 4].map((index) => <SkeletonRow key={index} />)}
          </Table>
        </div>
      )}
      {state.kind === 'failed' && (
        <Callout title="The blocklist could not be read." action={<Button variant="outline" size="row" onClick={() => void reload()}>Try again</Button>} />
      )}
      {state.kind === 'ready' && entries.filter(shows[view]).length === 0 && (
        <EmptyState icon={<Ban />} title="Nothing is blocked here" className="mt-16" />
      )}
      {state.kind === 'ready' && entries.filter(shows[view]).length > 0 && (
        <div className="flex flex-col">
          <Table aria-label="Blocklist">
            <RowBlocklistHeader />
            {listed.map((entry) => {
              const key = keyOf(entry);
              const isSelected = selected === key;
              return (
                <Collapsible key={key} open={!hidden.has(key)}>
                  <CollapsiblePrimitive.Panel className={panelMotion}>
                    <RowBlocklist
                      release={entry.release}
                      title={entry.title}
                      tracker={entry.indexer ?? undefined}
                      reason={why(entry)}
                      added={when(entry.at)}
                      actions={(
                        <Button
                          variant="ghost"
                          size="row"
                          iconOnly
                          icon={<X />}
                          aria-label={`Unblock ${entry.release}`}
                          onClick={(event) => { event.stopPropagation(); unblock(entry); }}
                        />
                      )}
                      selected={isSelected}
                      tabIndex={0}
                      aria-selected={isSelected}
                      onClick={() => setSelected(isSelected ? null : key)}
                      onKeyDown={(event) => { if (event.key === 'Enter' && event.target === event.currentTarget) setSelected(isSelected ? null : key); }}
                    />
                    {isSelected && (
                      <div className="flex h-(--row) w-full items-center gap-2 border-b border-border bg-selected px-4">
                        <Button variant="outline" size="row" onClick={() => unblock(entry)}>Unblock</Button>
                      </div>
                    )}
                    {failed !== null && keyOf(failed) === key && (
                      <div className="flex h-8 w-full items-center border-b border-border bg-muted px-4">
                        <StatusInline status="failed">{serviceWords[failed.service]} did not unblock it.</StatusInline>
                      </div>
                    )}
                  </CollapsiblePrimitive.Panel>
                </Collapsible>
              );
            })}
          </Table>
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
}
