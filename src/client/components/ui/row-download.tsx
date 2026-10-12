// v2/Row/download — design/design-system.lib.pen k3Rz6
import type { ReactNode } from 'react';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Progress, type ProgressTone } from '@/components/ui/progress';
import { TableCell, TableCellTracker, TableHead, TableHeader, TableRow, type TableRowProps } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// Two lines, 56 px. Title fill, Progress 180, Speed 104, ETA 72, Tracker 112, State 220, Actions 72.
const w = { progress: 'w-45', speed: 'w-26', eta: 'w-18', tracker: 'w-28', state: 'w-55', actions: 'w-18' };

function RowDownloadHeader() {
  return (
    <TableHeader>
      <TableHead fill>Title</TableHead>
      <TableHead className={w.progress}>Progress</TableHead>
      <TableHead align="end" className={w.speed}>Speed</TableHead>
      <TableHead align="end" className={w.eta}>ETA</TableHead>
      <TableHead className={w.tracker}>Tracker</TableHead>
      <TableHead className={w.state}>State</TableHead>
      <TableHead className={w.actions} />
    </TableHeader>
  );
}

type DownloadState = 'downloading' | 'stalled' | 'import-blocked' | 'waiting';

const looks: Record<DownloadState, { badge: BadgeVariant; bar: ProgressTone; speed: string; marker?: 'risk' | 'warning' }> = {
  downloading: { badge: 'live', bar: 'downloading', speed: 'text-foreground' },
  stalled: { badge: 'risk', bar: 'stalled', speed: 'text-destructive', marker: 'risk' },
  'import-blocked': { badge: 'warning', bar: 'done', speed: 'text-muted-foreground', marker: 'warning' },
  waiting: { badge: 'neutral', bar: 'done', speed: 'text-muted-foreground' },
};

type RowDownloadProps = Omit<TableRowProps, 'progress' | 'marker'> & {
  title: ReactNode;
  /** Release name and size, in the data font. */
  detail?: ReactNode;
  /** 0 to 100. Leave out while the release is not in rTorrent yet: the cell stays, empty, so the columns line up. */
  progress?: number;
  speed?: ReactNode;
  eta?: ReactNode;
  tracker?: string;
  /** Sets the badge, bar and speed colours and the side bar. */
  state: DownloadState;
  /** Badge words, such as "Downloading" or "Stalled · 0 seeders". */
  stateLabel: ReactNode;
  actions?: ReactNode;
};

/** Live torrent row. The percent text swaps at once; the bar width moves. */
function RowDownload({ title, detail, progress, speed, eta, tracker, state, stateLabel, actions, className, ...props }: RowDownloadProps) {
  const look = looks[state];
  return (
    <TableRow marker={look.marker} className={cn('h-(--row-two-line)', className)} {...props}>
      <TableCell fill className="flex-col items-start justify-center gap-0.5">
        <span className="w-full truncate font-ui font-semibold" title={typeof title === 'string' ? title : undefined}>{title}</span>
        {detail !== undefined && <span className="w-full truncate text-[13px] text-muted-foreground">{detail}</span>}
      </TableCell>
      <TableCell className={cn(w.progress, 'gap-2.5')}>
        {progress !== undefined && (
          <>
            <Progress value={progress} tone={look.bar} className="w-30" />
            <span className="font-semibold">{Math.round(progress)}%</span>
          </>
        )}
      </TableCell>
      <TableCell align="end" className={cn(w.speed, look.speed)}>{speed}</TableCell>
      <TableCell align="end" className={cn(w.eta, 'text-muted-foreground')}>{eta}</TableCell>
      <TableCell className={w.tracker}>{tracker !== undefined && <TableCellTracker name={tracker} />}</TableCell>
      <TableCell className={w.state}>
        <Badge key={state} variant={look.badge} className="transition-opacity duration-(--duration-base) ease-out starting:opacity-0">
          {stateLabel}
        </Badge>
      </TableCell>
      <TableCell align="end" className={cn(w.actions, 'gap-0.5')}>{actions}</TableCell>
    </TableRow>
  );
}

export { RowDownload, RowDownloadHeader };
export type { DownloadState };
