// v2/Row/release — ~/Projects/media-manager-2-design/design-system.lib.pen NXfpc
// v2/Row/release/best — ~/Projects/media-manager-2-design/design-system.lib.pen qfXmm
// v2/Row/release/rejected — ~/Projects/media-manager-2-design/design-system.lib.pen B5OQ0G
// v2/Row/release/cooldown — ~/Projects/media-manager-2-design/design-system.lib.pen So9dQ
// v2/Row/release/yours — ~/Projects/media-manager-2-design/design-system.lib.pen R2TgoO
// v2/Row/release/grabbed — ~/Projects/media-manager-2-design/design-system.lib.pen TzXh1
// v2/Row/release/movie — ~/Projects/media-manager-2-design/design-system.lib.pen qTBZf
// v2/Table/Header/releases — ~/Projects/media-manager-2-design/design-system.lib.pen wQU07
// v2/Table/Header/releases/movie — ~/Projects/media-manager-2-design/design-system.lib.pen tQZov
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
    <TableHeader className="px-0">
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
  return (
    <TableRow
      aria-label={yours ? 'Your current file' : undefined}
      className={cn(
        'border-input px-0',
        cooldown && 'before:absolute before:inset-y-0 before:left-[calc(var(--inset)*-1)] before:w-0.75 before:bg-destructive',
        className,
      )}
      {...props}
    >
      <TableCell fill className="pl-2.5">
        <span className="flex min-w-0 items-center">
          <span className={cn('shrink-0 whitespace-pre text-muted-foreground', dim)}>{name.head}</span>
          <span className={cn('min-w-0 truncate whitespace-pre text-muted-foreground', dim)}>{name.middle}</span>
          {name.group !== undefined && <span className={cn('shrink-0 font-bold text-foreground', dim)}>{name.group}</span>}
        </span>
        {history !== undefined && <span className="ml-auto flex shrink-0"><MarkHistory kind={history.kind} tooltip={history.tooltip} /></span>}
      </TableCell>
      <TableCell className={cn(w.audio, 'overflow-hidden whitespace-nowrap')}>
        {formats.map((format, index) => <TagFormat key={`${index}:${format}`} className={cn(dim)}>{format}</TagFormat>)}
      </TableCell>
      <TableCell align="end" className={cn(w.seeders, seedersLook(seeders), dim)}>
        {typeof leechers === 'number' ? <Tooltip text={`${leechers} leechers`}><span>{seedersText}</span></Tooltip> : seedersText}
      </TableCell>
      <TableCell className={w.tracker}>
        <TableCellTracker name={tracker} className={cn(dim)} />
        {freeleech !== undefined && <MarkFreeleech tooltip={freeleech} />}
      </TableCell>
      <TableCell className={w.fit}>{fit}</TableCell>
      <TableCell className={w.quality}>
        <span className={cn('shrink-0 font-medium text-foreground', dim)}>{quality.resolution}</span>
        {quality.source !== undefined && <span className={cn('min-w-0 truncate text-muted-foreground', dim)}>{quality.source}</span>}
        {proper !== undefined && <MarkProper tooltip={proper} />}
      </TableCell>
      <TableCell align="end" className={cn(w.size, 'text-muted-foreground', dim)}>{size}</TableCell>
      <TableCell align="end" className={w.action}>{action}</TableCell>
    </TableRow>
  );
}

/** Loading row for the releases inset: one grey block per column at the column widths. */
function RowReleaseSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex h-(--row) w-full shrink-0 items-center gap-4 border-b border-input px-0">
      <div className="flex min-w-0 flex-1 pl-2.5"><Skeleton className="w-75 max-w-full" /></div>
      <div className={cn('flex shrink-0 gap-1', w.audio)}><Skeleton className="h-4 w-11" /><Skeleton className="h-4 w-5" /></div>
      <div className={cn('flex shrink-0 justify-end', w.seeders)}><Skeleton className="w-6" /></div>
      <div className={cn('flex shrink-0 gap-1.5', w.tracker)}><Skeleton className="size-4" /><Skeleton className="w-15" /></div>
      <div className={cn('flex shrink-0', w.fit)}><Skeleton className="h-5 w-9" /></div>
      <div className={cn('flex shrink-0', w.quality)}><Skeleton className="w-19" /></div>
      <div className={cn('flex shrink-0 justify-end', w.size)}><Skeleton className="w-10" /></div>
      <div className={cn('flex shrink-0 justify-end', w.action)}><Skeleton className="h-7 w-18" /></div>
    </div>
  );
}

export { RowRelease, RowReleaseHeader, RowReleaseSkeleton };
