// v2/Row/episode — design/design-system.lib.pen rjunT
import type { ReactNode } from 'react';
import { TableCell, TableHead, TableHeader, TableRow, type TableRowProps } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// Bookmark 28, Number 40, Title fill, Air date 104, File 128, State 220, Actions 112.
const w = { bookmark: 'w-7', number: 'w-10', aired: 'w-26', file: 'w-32', state: 'w-55', actions: 'w-28' };

function RowEpisodeHeader() {
  return (
    <TableHeader>
      <TableHead className={w.bookmark} />
      <TableHead className={w.number}>#</TableHead>
      <TableHead fill>Title</TableHead>
      <TableHead className={w.aired}>Aired</TableHead>
      <TableHead className={w.file}>File</TableHead>
      <TableHead className={w.state}>State</TableHead>
      <TableHead className={w.actions} />
    </TableHeader>
  );
}

type RowEpisodeProps = Omit<TableRowProps, 'progress' | 'title'> & {
  /** A ToggleBookmark. */
  bookmark: ReactNode;
  number: ReactNode;
  title: ReactNode;
  aired: ReactNode;
  /** Quality Badge of the file, or nothing. */
  file?: ReactNode;
  /** One Badge, or nothing when normal. */
  state?: ReactNode;
  /** Icon-only row buttons: search, pick a release, more. */
  actions?: ReactNode;
  /** Not monitored: the title turns muted. */
  monitored?: boolean;
  /** Not aired yet: the date reads in black. */
  upcoming?: boolean;
};

/** Episode row inside a season. Use marker "warning" for missing and "risk" for stalled. */
function RowEpisode({ bookmark, number, title, aired, file, state, actions, monitored = true, upcoming = false, ...props }: RowEpisodeProps) {
  return (
    <TableRow {...props}>
      <TableCell className={w.bookmark}>{bookmark}</TableCell>
      <TableCell className={cn(w.number, 'font-medium text-muted-foreground')}>{number}</TableCell>
      <TableCell fill className={cn('font-ui font-medium', !monitored && 'text-muted-foreground')}>
        <span className="truncate">{title}</span>
      </TableCell>
      <TableCell className={cn(w.aired, !upcoming && 'text-muted-foreground')}>{aired}</TableCell>
      <TableCell className={w.file}>{file}</TableCell>
      <TableCell className={w.state}>{state}</TableCell>
      <TableCell align="end" className={cn(w.actions, 'gap-0.5')}>{actions}</TableCell>
    </TableRow>
  );
}

export { RowEpisode, RowEpisodeHeader };
