// v2/Row/history — design/design-system.lib.pen nT6fn
import type { ReactNode } from 'react';
import { TableCell, TableHead, TableHeader, TableRow, type TableRowProps } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// When 128, Event fill, By 112, Detail 284. By and Detail line up with Tracker and Seeding of RowSecondVersion.
const w = { when: 'w-32', by: 'w-28', detail: 'w-71' };

function RowHistoryHeader() {
  return (
    <TableHeader>
      <TableHead className={w.when}>When</TableHead>
      <TableHead fill>Event</TableHead>
      <TableHead className={w.by}>By</TableHead>
      <TableHead className={w.detail}>Detail</TableHead>
    </TableHeader>
  );
}

type RowHistoryProps = Omit<TableRowProps, 'progress' | 'marker'> & {
  when: ReactNode;
  /** A 16 px lucide icon for the event. */
  icon: ReactNode;
  event: ReactNode;
  by: ReactNode;
  detail?: ReactNode;
  /** Problem: red bar and icon. Warning: amber bar and icon. */
  tone?: 'problem' | 'warning';
};

/** One event in a title's history or the activity log. */
function RowHistory({ when, icon, event, by, detail, tone, ...props }: RowHistoryProps) {
  return (
    <TableRow marker={tone === 'problem' ? 'risk' : tone} {...props}>
      <TableCell className={cn(w.when, 'text-muted-foreground')}>{when}</TableCell>
      <TableCell fill className="gap-2 font-ui">
        <span className={cn('flex shrink-0 [&>svg]:size-4', tone === 'problem' ? 'text-destructive' : tone === 'warning' ? 'text-warning' : 'text-muted-foreground')}>
          {icon}
        </span>
        <span className="truncate">{event}</span>
      </TableCell>
      <TableCell className={cn(w.by, 'text-muted-foreground')}>
        <span className="truncate">{by}</span>
      </TableCell>
      <TableCell className={cn(w.detail, 'text-muted-foreground')}>
        <span className="truncate">{detail}</span>
      </TableCell>
    </TableRow>
  );
}

export { RowHistory, RowHistoryHeader };
