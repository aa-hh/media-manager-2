// v2/Card/library — ~/Projects/media-manager-2-design/design-system.lib.pen yZ5NT
import { HardDrive } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { FactRow } from '@/components/ui/fact';
import { cn } from '@/lib/utils';

type CardLibraryProps = ComponentProps<'section'> & {
  title?: ReactNode;
  /** One entry per rating site, such as { source: 'IMDb', value: '8.5', votes: '1,203 votes' }; the row is left out when empty. */
  ratings?: Array<{ source: string; icon?: ReactNode; value: string; votes?: string }>;
  /** Fact/row rows: label 112 px, value right-aligned. */
  rows: Array<{ label: string; value: ReactNode }>;
  /** The owner's tags; the row is left out when empty. */
  tags?: string[];
};

/** Everything about the owner's copy of a title, beside the title page's overview. */
function CardLibrary({ title = 'In your library', ratings = [], rows, tags = [], className, ...props }: CardLibraryProps) {
  return (
    <section className={cn('flex w-90 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card', className)} {...props}>
      <h2 className="flex h-11 items-center gap-2 border-b border-border px-4 text-body font-bold text-foreground">
        <HardDrive aria-hidden="true" className="size-4" />
        {title}
      </h2>
      {ratings.length > 0 && (
        <ul aria-label="Ratings" className="m-0 flex h-12 list-none items-center justify-center gap-4 border-b border-border px-4">
          {ratings.map((rating) => (
            <li key={rating.source} className="flex items-center gap-1.25">
              {rating.icon !== undefined && <span aria-hidden="true" className="flex size-4 items-center justify-center text-subtle-foreground [&>svg]:size-4">{rating.icon}</span>}
              <span className="font-ui text-xs font-bold text-subtle-foreground">{rating.source}</span>
              <span className="font-data text-[15px] font-semibold text-foreground">{rating.value}</span>
              {rating.votes !== undefined && <span className="text-data-small font-normal text-subtle-foreground">{rating.votes}</span>}
            </li>
          ))}
        </ul>
      )}
      <dl className="m-0 flex flex-col">
        {rows.map((row) => (
          <FactRow
            key={row.label}
            label={row.label}
            className="h-auto min-h-(--row) px-4 py-2 last:border-b-0 *:first:w-28 *:last:flex-1 *:last:justify-end *:last:text-right"
          >
            {row.value}
          </FactRow>
        ))}
        {tags.length > 0 && (
          <div className="flex min-h-11 items-center gap-1.5 px-4 py-2">
            <dt className="w-28 shrink-0 text-body text-muted-foreground">Tags</dt>
            <dd className="m-0 flex min-w-0 flex-1 flex-wrap justify-end gap-1.5">
              {tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

export { CardLibrary };
