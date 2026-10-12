// v2/Downloads live bar — design/design-system.lib.pen jXjdR
import { Collapsible } from '@base-ui/react/collapsible';
import { ArrowDownToLine, ChevronUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type LiveItem = { key: string; name: ReactNode; percent: number };

type DownloadsLiveBarProps = {
  /** Such as "3 downloading", or "Nothing downloading" when idle. */
  count: ReactNode;
  /** Idle: grey arrow, 500 count, no items. */
  idle?: boolean;
  /** Such as "41.6 MB/s down · 12.3 MB/s up". */
  speeds?: ReactNode;
  /** Up to three items, each with a lime progress fill. */
  items?: LiveItem[];
  /** Red dot and words when something is stalled. */
  problem?: ReactNode;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  expandLabel?: ReactNode;
  collapseLabel?: ReactNode;
  /** The expanded panel (a Panel/inline with RowDownload rows, Open Downloads and Collapse). It rises from the bar. */
  panel?: ReactNode;
  className?: string;
};

/** Always at the bottom of desktop screens: 40 px, black, white text. Lime is allowed here because it sits on black. */
function DownloadsLiveBar({ count, idle = false, speeds, items = [], problem, expanded, onExpandedChange, expandLabel = 'Expand', collapseLabel = 'Collapse', panel, className }: DownloadsLiveBarProps) {
  return (
    <Collapsible.Root open={expanded} onOpenChange={onExpandedChange} className={cn('fixed inset-x-0 bottom-0 z-20', className)}>
      <Collapsible.Panel
        className={cn(
          'absolute right-(--page-margin) bottom-full left-(--page-margin) mb-2 overflow-hidden',
          'h-(--collapsible-panel-height) transition-[height,opacity] duration-(--duration-size) ease-out',
          'data-starting-style:h-0 data-starting-style:opacity-0',
          'data-ending-style:h-0 data-ending-style:opacity-0 data-ending-style:duration-(--duration-fast) data-ending-style:ease-in motion-reduce:data-ending-style:duration-0',
        )}
      >
        {panel}
      </Collapsible.Panel>
      <div className="flex h-(--livebar) items-center gap-4 overflow-hidden bg-bar px-(--page-margin) whitespace-nowrap">
        <ArrowDownToLine aria-hidden="true" className={cn('size-4 shrink-0', idle ? 'text-bar-muted-foreground' : 'text-live')} />
        <span className={cn('font-ui text-sm text-bar-foreground', idle ? 'font-medium' : 'font-semibold')}>{count}</span>
        {speeds !== undefined && <span className="min-w-0 truncate font-data text-sm text-bar-muted-foreground">{speeds}</span>}
        {!idle && items.slice(0, 3).map((item) => (
          <span key={item.key} className="flex min-w-0 items-center gap-2 font-data text-sm">
            <span className="truncate text-bar-foreground">{item.name}</span>
            <Progress value={item.percent} tone="on-dark" className="w-12 shrink-0" />
            <span className="text-bar-muted-foreground">{Math.round(item.percent)}%</span>
          </span>
        ))}
        {problem !== undefined && (
          <span className="flex items-center gap-1.5 font-data text-sm text-bar-foreground">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-destructive" />
            {problem}
          </span>
        )}
        <span className="flex-1" />
        <Collapsible.Trigger
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-1 font-ui text-[13px] font-semibold text-bar-foreground',
            'transition-colors duration-(--duration-fast) ease-out hover:bg-bar-foreground/12 active:duration-0 focus-ring-on-dark',
          )}
        >
          {expanded ? collapseLabel : expandLabel}
          <ChevronUp aria-hidden="true" className={cn('size-4 transition-transform duration-(--duration-base) ease-out', expanded && 'rotate-180')} />
        </Collapsible.Trigger>
      </div>
    </Collapsible.Root>
  );
}

export { DownloadsLiveBar };
export type { LiveItem };
