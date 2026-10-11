// v2/Row/flagged — design/design-system.lib.pen NKsS2
import type { ReactNode } from 'react';
import { TableCell, TableRow, type TableRowProps } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// Two lines, 56 px. Poster 32, What fill, Gave up 120, Tries 64, Actions 240.
const w = { poster: 'w-8', gaveUp: 'w-30', tries: 'w-16', actions: 'w-60' };

type RowFlaggedProps = Omit<TableRowProps, 'progress'> & {
  /** Poster image address; a muted block stands in without one. */
  poster?: string;
  title: ReactNode;
  /** Why automation gave up. */
  reason?: ReactNode;
  gaveUp?: ReactNode;
  tries?: ReactNode;
  /** Search again (row default) and Pick a release (row outline). */
  actions?: ReactNode;
};

/** Something automation gave up on. Use marker "risk" when a hit and run is at stake. */
function RowFlagged({ poster, title, reason, gaveUp, tries, actions, className, ...props }: RowFlaggedProps) {
  return (
    <TableRow className={cn('h-(--row-two-line)', className)} {...props}>
      <TableCell className={w.poster}>
        {poster !== undefined
          ? <img src={poster} alt="" className="h-12 w-8 rounded-xs object-cover" />
          : <span aria-hidden="true" className="h-12 w-8 rounded-xs bg-muted" />}
      </TableCell>
      <TableCell fill className="flex-col items-start justify-center gap-0.5">
        <span className="w-full truncate font-ui font-semibold">{title}</span>
        {reason !== undefined && <span className="w-full truncate text-[13px] text-muted-foreground">{reason}</span>}
      </TableCell>
      <TableCell className={cn(w.gaveUp, 'text-muted-foreground')}>{gaveUp}</TableCell>
      <TableCell align="end" className={w.tries}>{tries}</TableCell>
      <TableCell align="end" className={cn(w.actions, 'gap-1.5')}>{actions}</TableCell>
    </TableRow>
  );
}

export { RowFlagged };
