// Figma: RowSeason — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-5513
// Figma: RowSeasonHeader — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-5281
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { TableCell, TableHead, TableHeader, TableRow, type TableRowProps } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// 48 px row. Chevron 20, Bookmark 28, Season fill, Air dates 104, Status 176, Quality 104, Size 72, Actions 112.
// The title page's tables share every edge from Air date on (row-episode.tsx, row-second-version.tsx).
const w = { chevron: 'w-5', bookmark: 'w-7', monitor: 'w-16', dates: 'w-26', status: 'w-44', quality: 'w-26', size: 'w-18', actions: 'w-28' };

function RowSeasonHeader() {
  return (
    <TableHeader>
      <TableHead align="end" className={w.monitor}>Monitor</TableHead>
      <TableHead fill>Season</TableHead>
      <TableHead className={w.dates}>Air dates</TableHead>
      <TableHead className={w.status}>Status</TableHead>
      <TableHead className={w.quality}>Quality</TableHead>
      <TableHead align="end" className={w.size}>Size</TableHead>
      <TableHead className={w.actions} />
    </TableHeader>
  );
}

type RowSeasonProps = Omit<TableRowProps, 'progress' | 'title'> & {
  open?: boolean;
  /** A ToggleBookmark: monitored, not, or mixed. */
  bookmark: ReactNode;
  title: ReactNode;
  /** Second line under the name, such as "10 episodes · 9 monitored". */
  counts?: ReactNode;
  /** First to last air date, such as "22 Aug – 24 Oct". */
  airDates?: ReactNode;
  /** One Badge: the worst state first with a count. */
  status?: ReactNode;
  /** One quality, or "Mixed". */
  quality?: ReactNode;
  size?: ReactNode;
  actions?: ReactNode;
  monitored?: boolean;
};

/** Season row that opens its episodes; accent fill, the chevron turns 90 degrees as it opens. */
function RowSeason({ open = false, bookmark, title, counts, airDates, status, quality, size, actions, monitored = true, line = 'season', className, ...props }: RowSeasonProps) {
  return (
    <TableRow aria-expanded={open} line={line} className={cn('h-12 bg-accent hover:bg-surface-pressed', className)} {...props}>
      <TableCell className={w.chevron}>
        <ChevronRight
          aria-hidden="true"
          className={cn('size-4 text-muted-foreground transition-transform duration-(--duration-base) ease-out', open && 'rotate-90')}
        />
      </TableCell>
      <TableCell className={w.bookmark}>{bookmark}</TableCell>
      <TableCell fill className="flex-col items-start justify-center gap-0.5">
        <span className={cn('max-w-full truncate font-ui text-base font-bold', !monitored && 'text-muted-foreground')}>{title}</span>
        {counts !== undefined && <span className="max-w-full truncate text-[13px] text-muted-foreground">{counts}</span>}
      </TableCell>
      <TableCell className={cn(w.dates, 'text-muted-foreground')}><span className="truncate">{airDates}</span></TableCell>
      <TableCell className={w.status}>{status}</TableCell>
      <TableCell className={cn(w.quality, 'text-muted-foreground')}><span className="truncate">{quality}</span></TableCell>
      <TableCell align="end" className={w.size}>{size}</TableCell>
      <TableCell align="end" className={cn(w.actions, 'gap-0.5')}>{actions}</TableCell>
    </TableRow>
  );
}

export { RowSeason, RowSeasonHeader };
