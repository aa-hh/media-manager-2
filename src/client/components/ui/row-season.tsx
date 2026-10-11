// v2/Row/season — design/design-system.lib.pen C5GiQ
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress, type ProgressTone } from '@/components/ui/progress';
import { TableCell, TableRow, type TableRowProps } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// 48 px row. Chevron 20, Bookmark 28, Title 120, Progress 220, Status 140, Size 96, spacer, Actions 112.
const w = { chevron: 'w-5', bookmark: 'w-7', title: 'w-30', progress: 'w-55', status: 'w-35', size: 'w-24', actions: 'w-28' };

type RowSeasonProps = Omit<TableRowProps, 'progress'> & {
  open?: boolean;
  /** A ToggleBookmark: monitored, not, or mixed. */
  bookmark: ReactNode;
  title: ReactNode;
  /** On disk, 0 to 100. */
  progress: number;
  /** "done" (grey) once every episode is on disk. */
  progressTone?: ProgressTone;
  /** On disk + downloading / total, such as "7 + 1 / 10". */
  count: ReactNode;
  /** Airing, Ended or Upcoming. */
  status?: ReactNode;
  size?: ReactNode;
  actions?: ReactNode;
  monitored?: boolean;
};

/** Season header row that opens its episodes; the chevron turns 90 degrees as it opens. */
function RowSeason({ open = false, bookmark, title, progress, progressTone, count, status, size, actions, monitored = true, className, ...props }: RowSeasonProps) {
  return (
    <TableRow aria-expanded={open} className={cn('h-12', className)} {...props}>
      <TableCell className={w.chevron}>
        <ChevronRight
          aria-hidden="true"
          className={cn('size-4 text-muted-foreground transition-transform duration-(--duration-base) ease-out', open && 'rotate-90')}
        />
      </TableCell>
      <TableCell className={w.bookmark}>{bookmark}</TableCell>
      <TableCell className={cn(w.title, 'font-ui text-[15px] font-bold', !monitored && 'text-muted-foreground')}>
        <span className="truncate">{title}</span>
      </TableCell>
      <TableCell className={cn(w.progress, 'gap-2.5')}>
        <Progress value={progress} tone={progressTone} className="w-25" />
        <span className={cn('font-semibold', !monitored && 'text-muted-foreground')}>{count}</span>
      </TableCell>
      <TableCell className={w.status}>{status !== undefined && <Badge className="bg-transparent">{status}</Badge>}</TableCell>
      <TableCell align="end" className={cn(w.size, 'text-muted-foreground')}>{size}</TableCell>
      <TableCell fill />
      <TableCell align="end" className={cn(w.actions, 'gap-0.5')}>{actions}</TableCell>
    </TableRow>
  );
}

export { RowSeason };
