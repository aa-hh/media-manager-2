// v2/Row/release — ~/Projects/media-manager-2-design/design-system.lib.pen NXfpc
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableCellTracker, TableHead, TableHeader, TableRow, type TableRowProps } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// Fixed widths, the same on every release table: Quality 104, Release fill, Compared 72, Fit 112, Size 72,
// Age 64, Seeders 64, Tracker 112, Hit and run 128, Audio and HDR 140, Action 88.
const w = { quality: 'w-26', comparison: 'w-18', fit: 'w-28', size: 'w-18', age: 'w-16', seeders: 'w-16', tracker: 'w-28', hitAndRun: 'w-32', audio: 'w-35', action: 'w-22' };

type OptionalColumns = { comparison?: boolean; age?: boolean; hitAndRun?: boolean; audio?: boolean };

/** Header for release tables. Turn on the optional columns the rows below fill. */
function RowReleaseHeader({ comparison = false, age = false, hitAndRun = false, audio = false }: OptionalColumns) {
  return (
    <TableHeader>
      <TableHead className={w.quality}>Quality</TableHead>
      <TableHead fill>Release</TableHead>
      {comparison && <TableHead className={w.comparison}>Compared</TableHead>}
      <TableHead className={w.fit}>Fit</TableHead>
      <TableHead align="end" className={w.size}>Size</TableHead>
      {age && <TableHead align="end" className={w.age}>Age</TableHead>}
      <TableHead align="end" className={w.seeders}>Seeders</TableHead>
      <TableHead className={w.tracker}>Tracker</TableHead>
      {hitAndRun && <TableHead className={w.hitAndRun}>Hit and run</TableHead>}
      {audio && <TableHead className={w.audio}>Audio · HDR</TableHead>}
      <TableHead className={w.action} />
    </TableHeader>
  );
}

type RowReleaseProps = Omit<TableRowProps, 'progress'> & {
  quality: ReactNode;
  /** Dotted release name up to the group, in muted text. */
  name: ReactNode;
  /** Release group, black 700. */
  group?: ReactNode;
  /** A MarkComparison; the column shows only when given. */
  comparison?: ReactNode;
  /** A CellProfileFit. */
  fit: ReactNode;
  size: ReactNode;
  /** Age such as "3 d"; the column shows only when given. */
  age?: ReactNode;
  seeders: ReactNode;
  tracker: string;
  hitAndRun?: ReactNode;
  audio?: ReactNode;
  /** The Grab button (row size). */
  actions?: ReactNode;
  /** Grabbed percent: swaps the actions for a lime badge and draws the progress line. */
  grabbed?: number;
  /** Fails the profile: every value dims. */
  rejected?: boolean;
  /** The owned file pinned under the header: muted fill, white quality badge. */
  yours?: boolean;
};

function RowRelease({ quality, name, group, comparison, fit, size, age, seeders, tracker, hitAndRun, audio, actions, grabbed, rejected = false, yours = false, className, ...props }: RowReleaseProps) {
  const dim = rejected && 'text-subtle-foreground';
  return (
    <TableRow progress={grabbed} className={cn(yours && 'bg-muted', className)} {...props}>
      <TableCell className={w.quality}>
        <Badge className={cn(yours && 'bg-card')}>{quality}</Badge>
      </TableCell>
      <TableCell fill>
        <span className="truncate">
          <span className={cn('text-muted-foreground', dim)}>{name}</span>
          {group !== undefined && <span className={cn('font-bold text-foreground', rejected && 'font-medium text-subtle-foreground')}>{group}</span>}
        </span>
      </TableCell>
      {comparison !== undefined && <TableCell className={w.comparison}>{comparison}</TableCell>}
      <TableCell className={cn(w.fit, 'min-w-0')}>{fit}</TableCell>
      <TableCell align="end" className={cn(w.size, dim)}>{size}</TableCell>
      {age !== undefined && <TableCell align="end" className={cn(w.age, dim)}>{age}</TableCell>}
      <TableCell align="end" className={cn(w.seeders, 'font-bold', rejected && 'font-medium text-subtle-foreground')}>{seeders}</TableCell>
      <TableCell className={w.tracker}>
        <TableCellTracker name={tracker} className={cn(dim)} />
      </TableCell>
      {hitAndRun !== undefined && <TableCell className={cn(w.hitAndRun, 'text-muted-foreground', dim)}><span className="truncate">{hitAndRun}</span></TableCell>}
      {audio !== undefined && <TableCell className={cn(w.audio, 'text-muted-foreground', dim)}><span className="truncate">{audio}</span></TableCell>}
      <TableCell align="end" className={w.action}>
        {grabbed === undefined
          ? actions
          : (
            <Badge variant="live" className="bg-best transition-opacity duration-(--duration-base) ease-out starting:opacity-0">
              {grabbed}%
            </Badge>
          )}
      </TableCell>
    </TableRow>
  );
}

export { RowRelease, RowReleaseHeader };
