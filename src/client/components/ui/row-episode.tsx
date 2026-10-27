// Figma: RowEpisode — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-4854
// Figma: RowEpisodeHeader — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-4458
// With a still: ~/Projects/media-manager-2-design/title.pen NIjoo (Rows B1 refined, 56 px). Not in Figma yet.
import type { ReactNode } from 'react';
import { TableCell, TableHead, TableHeader, TableRow, type TableRowProps } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// Cells start at x 52 (the chevron column stays empty). Bookmark 28, Number 40, Title fill, Air date 104, Status 176,
// Quality 104, Size 72, Actions 112: the same edges as the season row above.
const w = { monitor: 'w-16', bookmark: 'w-7', number: 'w-10', aired: 'w-26', status: 'w-44', quality: 'w-26', size: 'w-18', actions: 'w-28' };

/** Directly under each open season. */
function RowEpisodeHeader() {
  return (
    <TableHeader>
      <TableHead align="end" className={w.monitor}>Monitor</TableHead>
      <TableHead className={w.number}>Ep</TableHead>
      <TableHead fill>Title</TableHead>
      <TableHead className={w.aired}>Air date</TableHead>
      <TableHead className={w.status}>Status</TableHead>
      <TableHead className={w.quality}>Quality</TableHead>
      <TableHead align="end" className={w.size}>Size</TableHead>
      <TableHead className={w.actions} />
    </TableHeader>
  );
}

type RowEpisodeProps = Omit<TableRowProps, 'progress' | 'title'> & {
  /** A ToggleBookmark. */
  bookmark: ReactNode;
  number: ReactNode;
  title: ReactNode;
  /** A StillEpisode before the title; the row grows to 56 px and the title takes two lines. */
  still?: ReactNode;
  /** The title's second line under it, such as "31 min left", "Played" or the runtime. */
  secondLine?: ReactNode;
  aired: ReactNode;
  /** One Badge, or nothing when normal. */
  status?: ReactNode;
  /** The file's quality in plain words, or nothing. */
  quality?: ReactNode;
  size?: ReactNode;
  /** Icon-only row buttons: search, pick a release, more. */
  actions?: ReactNode;
  /** Not monitored: the title turns muted. */
  monitored?: boolean;
  /** Not aired yet: the date reads in black. */
  upcoming?: boolean;
  /** Something is open under it: accent tint from the number column, no bar. */
  open?: boolean;
};

/** Episode row inside a season. Use marker "warning" for missing and "risk" for stalled. */
function RowEpisode({ bookmark, number, title, still, secondLine, aired, status, quality, size, actions, monitored = true, upcoming = false, open = false, selected, line = 'episode', className, ...props }: RowEpisodeProps) {
  return (
    <TableRow
      selected={selected}
      line={line}
      className={cn(
        'pl-13',
        still !== undefined && 'h-(--row-two-line)',
        // The open tint paints above the row's own fill, so it steps aside for the selected tint.
        open && !selected && 'isolate before:absolute before:inset-y-0 before:right-4 before:left-24 before:-z-10 before:bg-accent hover:before:bg-surface-pressed',
        className,
      )}
      {...props}
    >
      <TableCell className={w.bookmark}>{bookmark}</TableCell>
      <TableCell className={cn(w.number, 'font-medium text-muted-foreground')}>{number}</TableCell>
      <TableCell fill className={cn('gap-3 font-ui font-medium', !monitored && 'text-muted-foreground')}>
        {still}
        {still === undefined && secondLine === undefined ? <span className="truncate">{title}</span> : (
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{title}</span>
            {secondLine !== undefined && <span className="truncate font-data text-xs font-normal text-muted-foreground">{secondLine}</span>}
          </span>
        )}
      </TableCell>
      <TableCell className={cn(w.aired, !upcoming && 'text-muted-foreground')}>{aired}</TableCell>
      <TableCell className={cn(w.status, 'min-w-0')}>{status}</TableCell>
      <TableCell className={cn(w.quality, 'text-muted-foreground')}><span className="truncate">{quality}</span></TableCell>
      <TableCell align="end" className={w.size}>{size}</TableCell>
      <TableCell align="end" className={cn(w.actions, 'gap-0.5')}>{actions}</TableCell>
    </TableRow>
  );
}

export { RowEpisode, RowEpisodeHeader };
