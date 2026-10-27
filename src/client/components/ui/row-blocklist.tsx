// Figma: RowBlocklist — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-3473
// Figma: RowBlocklistHeader — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-3461
import type { ReactNode } from 'react';
import { TableCell, TableCellTracker, TableHead, TableHeader, TableRow, type TableRowProps } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// Release fill, Title 220, Tracker 112, Reason 240, Added 104, Action 28.
const w = { title: 'w-55', tracker: 'w-28', reason: 'w-60', added: 'w-26', action: 'w-7' };

function RowBlocklistHeader() {
  return (
    <TableHeader>
      <TableHead fill>Release</TableHead>
      <TableHead className={w.title}>Title</TableHead>
      <TableHead className={w.tracker}>Tracker</TableHead>
      <TableHead className={w.reason}>Reason</TableHead>
      <TableHead className={w.added}>Added</TableHead>
      <TableHead className={w.action} />
    </TableHeader>
  );
}

type RowBlocklistProps = Omit<TableRowProps, 'progress'> & {
  release: ReactNode;
  title: ReactNode;
  tracker?: string;
  reason?: ReactNode;
  added?: ReactNode;
  /** The icon-only remove button. */
  actions?: ReactNode;
};

/** A release that will not be grabbed again. With marker "risk" the reason turns red. */
function RowBlocklist({ release, title, tracker, reason, added, actions, marker, ...props }: RowBlocklistProps) {
  return (
    <TableRow marker={marker} {...props}>
      <TableCell fill className="text-muted-foreground">
        <span className="truncate">{release}</span>
      </TableCell>
      <TableCell className={cn(w.title, 'font-ui font-medium')}>
        <span className="truncate" title={typeof title === 'string' ? title : undefined}>{title}</span>
      </TableCell>
      <TableCell className={w.tracker}>{tracker !== undefined && <TableCellTracker name={tracker} />}</TableCell>
      <TableCell className={cn(w.reason, marker === 'risk' ? 'text-destructive' : 'text-muted-foreground')}>
        <span className="truncate">{reason}</span>
      </TableCell>
      <TableCell className={cn(w.added, 'text-muted-foreground')}>{added}</TableCell>
      <TableCell align="end" className={w.action}>{actions}</TableCell>
    </TableRow>
  );
}

export { RowBlocklist, RowBlocklistHeader };
