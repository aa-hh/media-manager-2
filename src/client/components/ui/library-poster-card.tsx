// v2/Library poster card — design/design-system.lib.pen Z0OVp
import { Check } from 'lucide-react';
import type { ComponentProps, CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type LibraryPosterCardProps = ComponentProps<'a'> & {
  /** Poster image address; a muted block stands in without one. */
  poster?: string;
  title: ReactNode;
  meta?: ReactNode;
  /** One Badge, or nothing when normal. */
  status?: ReactNode;
  /** Downloading percent: the 4 px lime strip on the poster's bottom edge. */
  progress?: number;
  /** Just imported: full-width strip plus the black Imported label with a lime check. */
  imported?: boolean;
  importedLabel?: ReactNode;
  selected?: boolean;
};

/**
 * Library grid card, 152 by 228 poster in full colour with a 1 px inner edge. Hover darkens the poster to 92 %,
 * pressed 84 %; focus rings the poster; selected adds a 2 px black edge and a 700 title.
 */
function LibraryPosterCard({ poster, title, meta, status, progress, imported = false, importedLabel = 'Imported', selected = false, className, ...props }: LibraryPosterCardProps) {
  const strip = imported ? 100 : progress;
  return (
    <a className={cn('group flex w-(--poster-width) flex-col gap-2 outline-none', className)} {...props}>
      <span
        className={cn(
          'relative block h-57 w-full overflow-hidden rounded-md bg-muted',
          'group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-ring',
        )}
      >
        {poster !== undefined && (
          <img
            src={poster}
            alt=""
            className="size-full object-cover transition-[filter] duration-(--duration-fast) ease-out group-hover:brightness-92 group-active:brightness-84 group-active:duration-0"
          />
        )}
        <span
          aria-hidden="true"
          className={cn('pointer-events-none absolute inset-0 rounded-md ring-inset', selected ? 'ring-2 ring-foreground' : 'ring-1 ring-foreground/10')}
        />
        {strip !== undefined && (
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-bar-foreground/30">
            <span
              style={{ '--poster-progress': `${strip}%` } as CSSProperties}
              className="block h-full w-(--poster-progress) bg-live transition-[width] duration-(--duration-slow) ease-out"
            />
          </span>
        )}
        {imported && (
          <span className="absolute bottom-2 left-2 flex h-6 items-center gap-1 rounded-full bg-bar pr-2 pl-1.5 transition-opacity duration-(--duration-base) ease-out starting:opacity-0">
            <Check aria-hidden="true" className="size-3.5 text-live" />
            <span className="font-ui text-xs font-semibold text-bar-foreground">{importedLabel}</span>
          </span>
        )}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className={cn('truncate font-ui text-sm text-foreground', selected ? 'font-bold' : 'font-semibold')}>{title}</span>
        {meta !== undefined && <span className="truncate font-data text-[13px] text-muted-foreground">{meta}</span>}
      </span>
      {status}
    </a>
  );
}

export { LibraryPosterCard };
