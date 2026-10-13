// v2/Row/search-result — ~/Projects/media-manager-2-design/design-system.lib.pen g073R
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type RowSearchResultProps = ComponentProps<'div'> & {
  /** Poster image address; a muted block stands in without one. */
  poster?: string;
  title: ReactNode;
  year?: ReactNode;
  /** One plain line: TV or Movie, network, status, rating. */
  meta?: ReactNode;
  overview?: ReactNode;
  /** "In library" as the plain Badge with a check, when in the library. */
  status?: ReactNode;
  /** File count in its fixed 80 px column; give it with status. */
  files?: ReactNode;
  /** The row-size outline Add button, when not in the library; the same 28 px as the Badge. */
  action?: ReactNode;
  /** Highlighted by keyboard; looks like hover. */
  highlighted?: boolean;
};

/** One search result, 84 px: poster, title and year, meta line, one overview line, then In library or Add. */
function RowSearchResult({ poster, title, year, meta, overview, status, files, action, highlighted = false, className, ...props }: RowSearchResultProps) {
  return (
    <div
      data-highlighted={highlighted || undefined}
      className={cn(
        'flex h-21 w-full items-center gap-3.5 rounded-md px-4 py-2.5',
        'transition-colors duration-(--duration-fast) ease-out active:duration-0',
        'hover:bg-surface-hover data-highlighted:bg-surface-hover active:bg-surface-pressed',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
        props.onClick !== undefined && 'cursor-pointer',
        className,
      )}
      {...props}
    >
      {poster !== undefined
        ? <img src={poster} alt="" width={40} height={60} loading="lazy" decoding="async" className="h-15 w-10 shrink-0 rounded-xs object-cover" />
        : <span aria-hidden="true" className="h-15 w-10 shrink-0 rounded-xs bg-muted" />}
      <span className="flex min-w-0 flex-1 flex-col gap-0.75 overflow-hidden">
        <span className="flex min-w-0 items-center gap-1.5 text-[15px]">
          <span className="truncate font-ui font-semibold text-foreground">{title}</span>
          {year !== undefined && <span className="shrink-0 font-data text-muted-foreground">{year}</span>}
        </span>
        {meta !== undefined && <span className="truncate font-data text-sm text-muted-foreground">{meta}</span>}
        {overview !== undefined && <span className="truncate font-ui text-[13px] text-subtle-foreground">{overview}</span>}
      </span>
      {status}
      {files !== undefined && <span className="w-20 shrink-0 text-right font-data text-[13px] text-muted-foreground">{files}</span>}
      {action}
    </div>
  );
}

export { RowSearchResult };
