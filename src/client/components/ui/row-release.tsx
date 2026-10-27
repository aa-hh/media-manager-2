// Figma: RowRelease — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-3346
// Figma: RowReleaseHeader — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-3905
// Figma: RowReleaseSkeleton — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-3922
import type { ReactNode } from 'react';
import { MarkFreeleech } from '@/components/ui/mark-freeleech';
import { MarkHistory } from '@/components/ui/mark-history';
import { MarkProper } from '@/components/ui/mark-proper';
import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableCellTracker, TableHead, TableHeader, TableRow, type TableRowProps } from '@/components/ui/table';
import { TagFormat } from '@/components/ui/tag-format';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Release takes the rest of the row (384 under an episode and 520 on the movie page at 1360); Audio · HDR 144, Seeders 64,
// Tracker 104, Fit 96, Quality 104, Size 72, last column 112. Anchored from the right, Quality, Size and the last column keep
// the shared edges at any width, as the episode rows above do.
const w = { audio: 'w-36', seeders: 'w-16', tracker: 'w-26', fit: 'w-24', quality: 'w-26', size: 'w-18', action: 'w-28' };

/** Header for the releases inset. The inset block supplies the left offset, so it has no side padding. */
function RowReleaseHeader() {
  return (
    <TableHeader className="px-0 [&>*]:font-bold">
      <TableHead fill className="pl-2.5">Release</TableHead>
      <TableHead className={w.audio}>Audio · HDR</TableHead>
      <TableHead align="end" className={w.seeders}>Seeders</TableHead>
      <TableHead className={w.tracker}>Tracker</TableHead>
      <TableHead className={w.fit}>Fit</TableHead>
      <TableHead className={w.quality}>Quality</TableHead>
      <TableHead align="end" className={w.size}>Size</TableHead>
      <TableHead className={w.action} />
    </TableHeader>
  );
}

type RowReleaseProps = Omit<TableRowProps, 'progress' | 'selected'> & {
  /** The release name in three parts: the start up to SxxExx (or the movie's year), the rest, and the group with its dash in 700 foreground. Only the middle is cut. */
  name: { head: string; middle: string; group?: string };
  /** The worst earlier event, at the release cell's right edge. */
  history?: { kind: 'failed' | 'blocklisted' | 'grabbed'; tooltip: string };
  /** One TagFormat each, audio first. */
  formats: string[];
  /** Undefined leaves the cell blank (the Yours row); null reads "?". */
  seeders?: number | null;
  /** Shown in the seeders tooltip. */
  leechers?: number | null;
  tracker: string;
  /** The freeleech kind, such as "Freeleech 75%": draws the mark with it as the tooltip. */
  freeleech?: string;
  /** A ChipFit. */
  fit?: ReactNode;
  quality: { resolution: string; source?: string };
  /** "Proper" or "Repack": draws the mark with it as the tooltip. */
  proper?: string;
  size: string;
  /** The row-size Grab Button, or a ChipReleaseState. */
  action?: ReactNode;
  /** Fails the profile: every value dims. */
  rejected?: boolean;
  /** The tracker is cooling down: the red bar at the table's left edge, reached through the inset's --inset. */
  cooldown?: boolean;
  /** The owned file pinned under the header. */
  yours?: boolean;
};

const seedersLook = (seeders: number | null | undefined) => {
  if (seeders === 0) return 'font-semibold text-destructive';
  if (typeof seeders === 'number' && seeders < 10) return 'font-semibold text-warning';
  return 'text-muted-foreground';
};

/** One release in the releases inset, 40 high with an input-grey line. Best tints best-soft; cooldown draws the red bar. */
function RowRelease({
  name, history, formats, seeders, leechers, tracker, freeleech, fit, quality, proper, size, action,
  rejected = false, cooldown = false, yours = false, className, ...props
}: RowReleaseProps) {
  const dim = rejected && 'text-subtle-foreground';
  const seedersText = seeders === undefined ? '' : seeders === null ? '?' : String(seeders);
  // "4.2 GB": the number in foreground, the unit in subtle-foreground.
  const unitAt = size.lastIndexOf(' ');
  const sizeNumber = unitAt === -1 ? size : size.slice(0, unitAt);
  const sizeUnit = unitAt === -1 ? '' : size.slice(unitAt);
  return (
    <TableRow
      aria-label={yours ? 'Your current file' : undefined}
      className={cn(
        'px-0 after:right-0 after:left-0',
        cooldown && 'before:absolute before:inset-y-0 before:left-[calc(var(--inset)*-1)] before:w-0.75 before:bg-destructive',
        className,
      )}
      {...props}
    >
      <TableCell fill className="pl-2.5">
        <span className="flex min-w-0 items-center select-text">
          <span className={cn('shrink-0 whitespace-pre text-muted-foreground', dim)}>{name.head}</span>
          <span className={cn('min-w-0 truncate whitespace-pre text-muted-foreground', dim)}>{name.middle}</span>
          {name.group !== undefined && <span className={cn('shrink-0 text-foreground', rejected ? 'font-medium' : 'font-bold', dim)}>{name.group}</span>}
        </span>
        {history !== undefined && <span className="ml-auto flex shrink-0 pl-0.5"><MarkHistory kind={history.kind} tooltip={history.tooltip} /></span>}
      </TableCell>
      <TableCell className={cn(w.audio, 'overflow-hidden whitespace-nowrap')}>
        {formats.map((format, index) => <TagFormat key={`${index}:${format}`} className={cn(dim)}>{format}</TagFormat>)}
      </TableCell>
      <TableCell align="end" className={cn(w.seeders, seedersLook(seeders), dim)}>
        {typeof leechers === 'number' ? <Tooltip text={`${leechers} leechers`}><span>{seedersText}</span></Tooltip> : seedersText}
      </TableCell>
      <TableCell className={cn(w.tracker, 'gap-1.5')}>
        <TableCellTracker name={tracker} className={cn(dim)} />
        {freeleech !== undefined && <MarkFreeleech tooltip={freeleech} />}
      </TableCell>
      <TableCell className={w.fit}>{fit}</TableCell>
      <TableCell className={w.quality}>
        <span className={cn('shrink-0 text-foreground', rejected ? 'font-normal' : 'font-medium', dim)}>{quality.resolution}</span>
        {quality.source !== undefined && <span className={cn('min-w-0 truncate text-muted-foreground', dim)}>{quality.source}</span>}
        {proper !== undefined && <MarkProper tooltip={proper} />}
      </TableCell>
      <TableCell align="end" className={cn(w.size, 'gap-0 whitespace-pre text-foreground', dim)}>
        {sizeNumber}
        {sizeUnit !== '' && <span className={cn('text-subtle-foreground', dim)}>{sizeUnit}</span>}
      </TableCell>
      <TableCell align="end" className={w.action}>{action}</TableCell>
    </TableRow>
  );
}

// Placeholder widths vary by row as the library draws them, so four rows don't read as one repeated block.
const nameWidths = ['w-75', 'w-81', 'w-67.5', 'w-78'];

/** Loading row for the releases inset: one grey block per column at the column widths. */
function RowReleaseSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex h-(--row) w-full shrink-0 items-center gap-4 border-b border-input px-0">
      <div className="flex min-w-0 flex-1 pl-2.5"><Skeleton className={cn(nameWidths[index % nameWidths.length], 'max-w-full')} /></div>
      <div className={cn('flex shrink-0 gap-1', w.audio)}><Skeleton className="h-4 w-11.5" />{index % 2 === 1 && <Skeleton className="h-4 w-5" />}</div>
      <div className={cn('flex shrink-0 justify-end', w.seeders)}><Skeleton className="w-6" /></div>
      <div className={cn('flex shrink-0 gap-1.5', w.tracker)}><Skeleton className="size-4" /><Skeleton className="w-15" /></div>
      <div className={cn('flex shrink-0', w.fit)}><Skeleton className="h-5 w-9" /></div>
      <div className={cn('flex shrink-0', w.quality)}><Skeleton className="w-19" /></div>
      <div className={cn('flex shrink-0 justify-end', w.size)}><Skeleton className="w-10" /></div>
      <div className={cn('flex shrink-0 justify-end', w.action)}><Skeleton className="h-7 w-18 rounded-(--control-radius-row)" /></div>
    </div>
  );
}

export { RowRelease, RowReleaseHeader, RowReleaseSkeleton };
