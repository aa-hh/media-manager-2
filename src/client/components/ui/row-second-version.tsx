// Figma: RowSecondVersion — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-7373
// Figma: RowSecondVersionHeader — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-6225
import type { ReactNode } from 'react';
import { TableCell, TableCellTracker, TableHead, TableHeader, TableRow, type TableRowProps } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// Release fill, Hit and run 160, Tracker 104, Status 176, Quality 104, Size 72, Actions 112: Tracker sits on the
// episode table's Air date edge, and the rest on its shared edges.
const w = { hitAndRun: 'w-40', tracker: 'w-26', status: 'w-44', quality: 'w-26', size: 'w-18', actions: 'w-28' };

// Under an open episode the rows, the header and their lines start at x 152; on the movie page at x 16.
const insetRow = 'pl-38 after:left-38';
const insetHeader = 'relative border-b-0 pl-38 after:pointer-events-none after:absolute after:right-4 after:bottom-0 after:left-38 after:h-px after:bg-input';

/** Versions header. `inset` under an open episode. */
function RowSecondVersionHeader({ inset = false }: { inset?: boolean }) {
  return (
    <TableHeader className={cn(inset && insetHeader)}>
      <TableHead fill>Release</TableHead>
      <TableHead className={w.hitAndRun}>Hit and run</TableHead>
      <TableHead className={w.tracker}>Tracker</TableHead>
      <TableHead className={w.status}>Status</TableHead>
      <TableHead className={w.quality}>Quality</TableHead>
      <TableHead align="end" className={w.size}>Size</TableHead>
      <TableHead className={w.actions} />
    </TableHeader>
  );
}

type RowSecondVersionProps = Omit<TableRowProps, 'progress'> & {
  /** Under an open episode: starts at x 152. Off on the movie page, where versions are the table's top level. */
  inset?: boolean;
  /** The file Sonarr or Radarr tracks: no action. */
  tracked?: boolean;
  /** Role words after the release name; defaults to "Tracked version" or "Second version". */
  roleLabel?: ReactNode;
  /** The release name; its trailing group is drawn in 700 foreground. */
  release: string;
  group?: string | null;
  /** Second line under the release name, such as a failure reason; the row grows to fit. */
  detail?: ReactNode;
  /** Rule progress, such as "41 h of 72 h". */
  hitAndRun?: ReactNode;
  tracker: string;
  /** One Badge. */
  status?: ReactNode;
  quality: ReactNode;
  size: ReactNode;
  /** Delete (outline-destructive, row size); ignored for the tracked version. */
  actions?: ReactNode;
};

function RowSecondVersion({ inset = false, tracked = false, roleLabel, release, group, detail, hitAndRun, tracker, status, quality, size, actions, className, ...props }: RowSecondVersionProps) {
  const split = group != null && group !== '' && release.endsWith(`-${group}`) ? release.length - group.length : release.length;
  return (
    <TableRow className={cn(inset && insetRow, detail !== undefined && 'h-auto min-h-(--row) py-2', className)} {...props}>
      <TableCell fill className={cn(detail !== undefined && 'flex-col items-start justify-center gap-0.5')}>
        <span className="flex max-w-full min-w-0 items-baseline gap-3">
          {/* The group is never cut; the dotted name before it truncates. */}
          <span className="flex min-w-0 select-text" title={release}>
            <span className="truncate text-muted-foreground">{release.slice(0, split)}</span>
            <span className="shrink-0 font-bold text-foreground">{release.slice(split)}</span>
          </span>
          <span className="shrink-0 font-ui text-[13px] text-subtle-foreground">{roleLabel ?? (tracked ? 'Tracked version' : 'Second version')}</span>
        </span>
        {detail !== undefined && <span className="max-w-full truncate text-data-small text-muted-foreground select-text">{detail}</span>}
      </TableCell>
      <TableCell className={cn(w.hitAndRun, 'text-muted-foreground')}><span className="truncate">{hitAndRun}</span></TableCell>
      <TableCell className={w.tracker}>
        <TableCellTracker name={tracker} />
      </TableCell>
      <TableCell className={w.status}>{status}</TableCell>
      <TableCell className={cn(w.quality, 'text-muted-foreground')}><span className="truncate">{quality}</span></TableCell>
      <TableCell align="end" className={w.size}>{size}</TableCell>
      <TableCell align="end" className={w.actions}>{!tracked && actions}</TableCell>
    </TableRow>
  );
}

export { RowSecondVersion, RowSecondVersionHeader };
