// Figma: RowDownload — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-7054
// Figma: RowDownloadHeader — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-7374
import type { ReactNode } from 'react';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Progress, type ProgressTone } from '@/components/ui/progress';
import { type DownloadCircleState, StatusDownloadCircle } from '@/components/ui/status-download-circle';
import { TableCell, TableCellTracker, TableHead, TableHeader, TableRow, type TableRowProps } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// 40 px row. Title fill, Progress 180, Speed 104, ETA 72, Tracker 104, Status 176, Quality 104, Size 72, Actions 112.
const w = { progress: 'w-45', speed: 'w-26', eta: 'w-18', tracker: 'w-26', status: 'w-44', quality: 'w-26', size: 'w-18', actions: 'w-28' };

function RowDownloadHeader() {
  return (
    <TableHeader>
      <TableHead fill>Title</TableHead>
      <TableHead className={w.progress}>Progress</TableHead>
      <TableHead align="end" className={w.speed}>Speed</TableHead>
      <TableHead align="end" className={w.eta}>ETA</TableHead>
      <TableHead className={w.tracker}>Tracker</TableHead>
      <TableHead className={w.status}>Status</TableHead>
      <TableHead className={w.quality}>Quality</TableHead>
      <TableHead align="end" className={w.size}>Size</TableHead>
      <TableHead className={w.actions} />
    </TableHeader>
  );
}

type DownloadState = 'downloading' | 'importing' | 'stalled' | 'import-blocked' | 'waiting';

// Live chips are muted with black words and the download circle; red chips are destructive-soft.
const looks: Record<DownloadState, { badge: BadgeVariant; words?: string; circle?: DownloadCircleState; bar: ProgressTone; speed: string; marker?: 'risk' | 'warning' }> = {
  downloading: { badge: 'neutral', words: 'text-foreground', circle: 'downloading', bar: 'downloading', speed: 'text-foreground' },
  importing: { badge: 'neutral', words: 'text-foreground', circle: 'importing', bar: 'done', speed: 'text-muted-foreground' },
  stalled: { badge: 'risk', circle: 'stalled', bar: 'stalled', speed: 'text-destructive', marker: 'risk' },
  'import-blocked': { badge: 'risk', circle: 'import-blocked', bar: 'done', speed: 'text-muted-foreground', marker: 'risk' },
  waiting: { badge: 'neutral', bar: 'done', speed: 'text-muted-foreground' },
};

type RowDownloadProps = Omit<TableRowProps, 'progress' | 'marker' | 'title'> & {
  title: ReactNode;
  /** The band's line: release name and size, in the data font. */
  release?: ReactNode;
  /** A problem in Sonarr's, Radarr's or this app's words, above the release line. */
  message?: ReactNode;
  /** Row-size buttons in the band, such as Import by hand and Remove from downloads. */
  bandActions?: ReactNode;
  /** 0 to 100. Leave out while the release is not in rTorrent yet: the cell stays, empty, so the columns line up. */
  progress?: number;
  speed?: ReactNode;
  eta?: ReactNode;
  tracker?: string;
  /** Sets the chip, circle, bar and speed colours and the side bar. */
  state: DownloadState;
  /** Chip words, such as "Downloading" or "Stalled · 0 seeders". */
  stateLabel: ReactNode;
  quality?: ReactNode;
  size?: ReactNode;
  actions?: ReactNode;
};

/** Live torrent row, then a muted band with the release line; each ends with the grey line. The percent text swaps at once; the bar width moves. */
function RowDownload({ title, release, message, bandActions, progress, speed, eta, tracker, state, stateLabel, quality, size, actions, className, ...props }: RowDownloadProps) {
  const look = looks[state];
  const band = release !== undefined || message !== undefined || bandActions !== undefined;
  // A risk with nothing downloading, such as rTorrent being down, has no circle to fill.
  const circle = look.circle === 'stalled' && progress === undefined ? undefined : look.circle;
  return (
    <>
      <TableRow marker={look.marker} className={className} {...props}>
        <TableCell fill>
          <span className="truncate font-ui font-semibold" title={typeof title === 'string' ? title : undefined}>{title}</span>
        </TableCell>
        <TableCell className={cn(w.progress, 'gap-2.5')}>
          {progress !== undefined && (
            <>
              <Progress value={progress} tone={look.bar} className="w-30" />
              <span className="font-semibold">{Math.floor(progress)}%</span>
            </>
          )}
        </TableCell>
        <TableCell align="end" className={cn(w.speed, look.speed)}>{speed}</TableCell>
        <TableCell align="end" className={cn(w.eta, 'text-muted-foreground')}>{eta}</TableCell>
        <TableCell className={w.tracker}>{tracker !== undefined && <TableCellTracker name={tracker} />}</TableCell>
        <TableCell className={cn(w.status, 'min-w-0')}>
          <Badge
            key={state}
            variant={look.badge}
            icon={circle === undefined ? undefined : <StatusDownloadCircle state={circle} percent={progress ?? 0} />}
            className={cn('max-w-full transition-opacity duration-(--duration-base) ease-out starting:opacity-0 [&>span]:truncate', look.words)}
          >
            <span>{stateLabel}</span>
          </Badge>
        </TableCell>
        <TableCell className={cn(w.quality, 'text-muted-foreground')}><span className="truncate">{quality}</span></TableCell>
        <TableCell align="end" className={w.size}>{size}</TableCell>
        <TableCell align="end" className={cn(w.actions, 'gap-0.5')}>{actions}</TableCell>
      </TableRow>
      {band && (
        <div role="row" className="relative flex w-full shrink-0 items-center gap-4 bg-muted pt-2 pr-4 pb-1.75 pl-4 after:pointer-events-none after:absolute after:right-4 after:bottom-0 after:left-4 after:h-px after:bg-input">
          <div role="cell" className="flex min-w-0 flex-1 flex-col gap-0.5 text-[13px]">
            {message !== undefined && <span className="font-ui text-foreground">{message}</span>}
            {release !== undefined && <span className="truncate font-data text-muted-foreground">{release}</span>}
          </div>
          {bandActions !== undefined && <div role="cell" className="flex shrink-0 items-center gap-2">{bandActions}</div>}
        </div>
      )}
    </>
  );
}

export { RowDownload, RowDownloadHeader };
export type { DownloadState };
