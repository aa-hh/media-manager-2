// Torrent row in the delete movie, show and season dialogs — design/title.pen "Dialog, delete season" (DASyr), "Dialog, delete show" (g9Y8c)
import { CircleCheck, Clock, Lock, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type AdviceLook = 'safe' | 'keep' | 'unconfirmed';

const adviceIcons: Record<AdviceLook, ReactNode> = {
  safe: <CircleCheck aria-hidden="true" className="text-foreground" />,
  keep: <TriangleAlert aria-hidden="true" className="text-warning" />,
  unconfirmed: <Clock aria-hidden="true" className="text-muted-foreground" />,
};
const verdictColours: Record<AdviceLook, string> = { safe: 'text-foreground', keep: 'text-warning', unconfirmed: 'text-muted-foreground' };

type RowDeleteTorrentProps = {
  /** Tick box, tracker logo or file icon, each 16 px, before the name. */
  lead?: ReactNode;
  name: string;
  size?: string;
  /** What the torrent holds, such as "Holds E05". */
  holds: ReactNode;
  /** A Badge after the holds line, such as "imported by copy". */
  label?: ReactNode;
  advice?: { look: AdviceLook; verdict: string; reason: string };
  /** Keep seeding or Remove torrent, a Remove torrent tick box, or nothing. */
  action?: ReactNode;
  /** Shown in place of the action when the torrent can't be removed. */
  locked?: string;
  /** Lines under the name start under the name, past this many 16 px marks and their 8 px gaps. */
  marks?: 0 | 1 | 2;
};

/** One torrent, library file or second version in a delete dialog: name and size, what it holds, hit and run advice, and the torrent choice at the right. */
function RowDeleteTorrent({ lead, name, size, holds, label, advice, action, locked, marks = 1 }: RowDeleteTorrentProps) {
  const indent = marks === 0 ? undefined : marks === 1 ? 'pl-6' : 'pl-12';
  return (
    <div className="flex w-full items-center gap-4 rounded-md border border-border bg-card px-3.5 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex w-full items-center gap-2 [&>img]:size-4 [&>svg]:size-4 [&>svg]:shrink-0">
          {lead}
          <span className="min-w-0 flex-1 truncate font-data text-sm text-foreground" title={name}>{name}</span>
          {size !== undefined && <span className="shrink-0 font-data text-sm text-muted-foreground">{size}</span>}
        </div>
        <div className={cn('flex w-full items-center gap-2 font-ui text-[13px] text-muted-foreground', indent)}>
          <span className="min-w-0">{holds}</span>
          {label}
        </div>
        {advice !== undefined && (
          <p className={cn('m-0 font-ui text-[13px] text-muted-foreground [&>svg]:mr-1.5 [&>svg]:inline [&>svg]:size-3.5 [&>svg]:align-[-2px]', indent)}>
            {adviceIcons[advice.look]}
            <span className={cn('font-semibold', verdictColours[advice.look])}>{advice.verdict}</span> {advice.reason}
          </p>
        )}
      </div>
      {locked !== undefined ? (
        <span className="flex w-50 shrink-0 gap-1.5 font-ui text-[13px] text-muted-foreground">
          <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-subtle-foreground" />
          {locked}
        </span>
      ) : action}
    </div>
  );
}

export { RowDeleteTorrent };
export type { AdviceLook };
