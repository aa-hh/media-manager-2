// v2/Row/second-version — design/design-system.lib.pen c49N0
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableCellTracker, TableHead, TableHeader, TableRow, type TableRowProps } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// Indent 40, Label 128, Quality 120, Release fill, Size 72, Tracker 112, Seeding 180, Action 88.
const w = { indent: 'w-10', label: 'w-32', quality: 'w-30', size: 'w-18', tracker: 'w-28', seeding: 'w-45', action: 'w-22' };

/** Versions header as drawn inside RowEpisodeDetails (no indent there). */
function RowSecondVersionHeader({ indent = false }: { indent?: boolean }) {
  return (
    <TableHeader>
      {indent && <TableHead className={w.indent} />}
      <TableHead className={w.label}>Version</TableHead>
      <TableHead className={w.quality}>Quality</TableHead>
      <TableHead fill>Release</TableHead>
      <TableHead align="end" className={w.size}>Size</TableHead>
      <TableHead className={w.tracker}>Tracker</TableHead>
      <TableHead className={w.seeding}>Seeding</TableHead>
      <TableHead className={w.action} />
    </TableHeader>
  );
}

type RowSecondVersionProps = Omit<TableRowProps, 'progress'> & {
  /** 40 px indent when the row sits straight under a movie row; off inside RowEpisodeDetails. */
  indent?: boolean;
  /** The file Sonarr or Radarr tracks: white outlined badge, black release name, no action. */
  tracked?: boolean;
  /** Badge words; defaults to "Tracked version" or "Second version". */
  label?: ReactNode;
  quality: ReactNode;
  release: ReactNode;
  size: ReactNode;
  tracker: string;
  /** Seeding words, or a live Badge while downloading. */
  seeding?: ReactNode;
  /** Delete (outline-destructive, row size); ignored for the tracked version. */
  actions?: ReactNode;
};

function RowSecondVersion({ indent = true, tracked = false, label, quality, release, size, tracker, seeding, actions, ...props }: RowSecondVersionProps) {
  return (
    <TableRow {...props}>
      {indent && <TableCell className={w.indent} />}
      <TableCell className={w.label}>
        <Badge variant={tracked ? 'outline' : 'neutral'} className={cn(tracked && 'bg-card text-foreground')}>
          {label ?? (tracked ? 'Tracked version' : 'Second version')}
        </Badge>
      </TableCell>
      <TableCell className={w.quality}>
        <Badge>{quality}</Badge>
      </TableCell>
      <TableCell fill className={cn(!tracked && 'text-muted-foreground')}>
        <span className="truncate">{release}</span>
      </TableCell>
      <TableCell align="end" className={w.size}>{size}</TableCell>
      <TableCell className={w.tracker}>
        <TableCellTracker name={tracker} />
      </TableCell>
      <TableCell className={cn(w.seeding, 'text-muted-foreground')}>
        <span className="truncate">{seeding}</span>
      </TableCell>
      <TableCell align="end" className={w.action}>{!tracked && actions}</TableCell>
    </TableRow>
  );
}

export { RowSecondVersion, RowSecondVersionHeader };
