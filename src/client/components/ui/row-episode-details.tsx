// v2/Row/episode-details — ~/Projects/media-manager-2-design/design-system.lib.pen WwDvp
import type { ComponentProps, ReactNode } from 'react';
import { LabelGroup } from '@/components/ui/label-group';
import { cn } from '@/lib/utils';

const panel = 'overflow-hidden rounded-md border border-border bg-card';

type RowEpisodeDetailsProps = ComponentProps<'div'> & {
  /** Continues the 3 px selection bar from the open row. */
  selected?: boolean;
  /** Episode overview, shown first beside the still. */
  overview?: ReactNode;
  /** Episode still image (16:9). */
  stillUrl?: string;
  /** FactRow elements; the first half fills the left column, the rest the right. */
  details?: ReactNode[];
  /** RowSecondVersionHeader then RowSecondVersion rows, tracked version first. */
  versions?: ReactNode;
  versionCount?: ReactNode;
  /** One line shown in the versions panel in place of rows. */
  versionsEmpty?: ReactNode;
  /** RowHistoryHeader then RowHistory rows, newest first. */
  history?: ReactNode;
  historyCount?: ReactNode;
  /** One line shown in the history panel in place of rows. */
  historyEmpty?: ReactNode;
};

/**
 * The open detail band under an episode or movie row: muted, line under, content from the Title column
 * (detail-indent). Overview and still, then Details, Versions and History sections 24 px apart, each a group heading over a white panel.
 * A section shows only when its content is given.
 */
function RowEpisodeDetails({ selected = true, overview, stillUrl, details, versions, versionCount, versionsEmpty, history, historyCount, historyEmpty, className, ...props }: RowEpisodeDetailsProps) {
  const half = Math.ceil((details?.length ?? 0) / 2);
  return (
    <div role="row" className={cn('relative w-full shrink-0 border-b border-border bg-muted', className)} {...props}>
      {selected && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.75 bg-foreground" />}
      <div role="cell" className="flex flex-col gap-6 pt-4 pr-4 pb-6 pl-(--detail-indent)">
        {(overview !== undefined || stillUrl !== undefined) && (
          <section className="flex gap-4">
            {stillUrl !== undefined && <img src={stillUrl} alt="" loading="lazy" decoding="async" className="aspect-video w-60 shrink-0 rounded-md border border-border object-cover" />}
            {overview !== undefined && <p className="m-0 max-w-170 text-body leading-normal text-muted-foreground">{overview}</p>}
          </section>
        )}
        {details !== undefined && details.length > 0 && (
          <section className="flex flex-col gap-2">
            <LabelGroup className="p-0">Details</LabelGroup>
            <div className={cn(panel, 'flex gap-8 px-4')}>
              <dl className="m-0 flex min-w-0 flex-1 flex-col *:last:border-b-0">{details.slice(0, half)}</dl>
              <dl className="m-0 flex min-w-0 flex-1 flex-col *:last:border-b-0">{details.slice(half)}</dl>
            </div>
          </section>
        )}
        {(versions !== undefined || versionsEmpty !== undefined) && (
          <section className="flex flex-col gap-2">
            <LabelGroup className="p-0" count={versionCount}>Versions</LabelGroup>
            <div role="table" className={cn(panel, 'flex flex-col *:last:border-b-0')}>
              {versions}
              {versionsEmpty !== undefined && <p className="m-0 flex h-(--row) items-center px-4 font-ui text-sm text-muted-foreground">{versionsEmpty}</p>}
            </div>
          </section>
        )}
        {(history !== undefined || historyEmpty !== undefined) && (
          <section className="flex flex-col gap-2">
            <LabelGroup className="p-0" count={historyCount}>History</LabelGroup>
            <div role="table" className={cn(panel, 'flex flex-col *:last:border-b-0')}>
              {history}
              {historyEmpty !== undefined && <p className="m-0 flex h-(--row) items-center px-4 font-ui text-sm text-muted-foreground">{historyEmpty}</p>}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export { RowEpisodeDetails };
