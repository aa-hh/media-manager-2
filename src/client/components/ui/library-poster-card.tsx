// v2/Library poster card — design/design-system.lib.pen Z0OVp
import { ArrowRight, Check, Clapperboard, ImageOff, Tv } from 'lucide-react';
import { type ComponentProps, type CSSProperties, type ReactNode, useState } from 'react';
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
  /** Large is the Discover size: 220 wide, poster 330 tall. */
  size?: 'default' | 'large';
  /** Position in a ranked list such as Trending, shown before the title. */
  rank?: number;
  /** Shows a type line (icon, word, year) in place of `meta`. */
  kind?: 'movie' | 'tv';
  year?: number | null;
  /** Third, truncated line, such as "Drama, Mystery". */
  genres?: string;
  /** A row of badges after the text, such as rating and In library. */
  badges?: ReactNode;
  /** Release date on the poster's top-left corner. */
  dateTab?: { month: string; day: string };
  /** Shown over the lower poster on hover and keyboard focus. */
  overview?: string;
};

/**
 * Library grid card, 152 by 228 poster in full colour with a 1 px inner edge. Hover darkens the poster to 92 %,
 * pressed 84 %; focus rings the poster; selected adds a 2 px black edge and a 700 title.
 * The card crossfades in when it takes a skeleton's place; its poster block keeps the skeleton shimmer until
 * the image has loaded, then the image fades in. An image that fails to load shows the no-poster fallback.
 */
function LibraryPosterCard({
  poster, title, meta, status, progress, imported = false, importedLabel = 'Imported', selected = false,
  size = 'default', rank, kind, year, genres, badges, dateTab, overview, className, ...props
}: LibraryPosterCardProps) {
  const large = size === 'large';
  const strip = imported ? 100 : progress;
  const [image, setImage] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const showPoster = poster !== undefined && image !== 'failed';
  return (
    <a className={cn('group flex flex-col gap-2 outline-none animate-content-in', large ? 'w-55' : 'w-(--poster-width)', className)} {...props}>
      <span
        data-poster
        className={cn(
          'relative block w-full overflow-hidden rounded-md bg-muted',
          showPoster && image === 'loading' && 'skeleton-shimmer motion-reduce:bg-none',
          large ? 'h-82.5' : 'h-57',
          'group-focus-visible:outline-2 group-focus-visible:outline-offset-0 group-focus-visible:outline-ring',
        )}
      >
        {showPoster && (
          <img
            // A cached image can finish before React attaches onLoad, so a complete one counts as loaded at once.
            ref={(node) => { if (node?.complete === true && node.naturalWidth > 0) setImage('loaded'); }}
            src={poster}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={() => setImage('loaded')}
            onError={() => setImage('failed')}
            className={cn(
              'size-full object-cover transition-[filter] duration-(--duration-fast) ease-out',
              'group-hover:brightness-92 group-active:brightness-84 group-active:duration-0',
              image === 'loaded' ? 'animate-content-in' : 'opacity-0',
            )}
          />
        )}
        {!showPoster && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <ImageOff aria-hidden="true" className="size-6 text-subtle-foreground" />
            <span className="font-ui text-xs text-muted-foreground">No poster yet</span>
          </span>
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
        {dateTab !== undefined && (
          <span className="absolute top-2 left-2 flex flex-col items-center rounded-md bg-card px-2.25 pt-1.25 pb-1.5 shadow-[0_1px_4px_var(--shadow)]">
            <span className="font-ui text-[11px] font-bold tracking-[0.6px] text-muted-foreground">{dateTab.month}</span>
            <span className="font-data text-[22px] leading-none font-semibold text-foreground">{dateTab.day}</span>
          </span>
        )}
        {overview !== undefined && (
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-x-0 bottom-0 flex h-50 flex-col justify-end gap-2 p-3 opacity-0 transition-opacity duration-(--duration-base) ease-out',
              'bg-[linear-gradient(to_bottom,#11111100_0%,#111111E6_60%)] group-hover:opacity-100 group-focus-visible:opacity-100',
            )}
          >
            <span className="line-clamp-4 font-ui text-[13px] leading-[1.4] text-white">{overview}</span>
            <span className="flex items-center gap-1 font-ui text-xs font-semibold text-white">
              Open title
              <ArrowRight aria-hidden="true" className="size-3.25" />
            </span>
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
        <span className="flex gap-2">
          {rank !== undefined && (
            <span className={cn('font-data leading-[1.25] font-semibold text-subtle-foreground', large ? 'text-base' : 'text-sm')}>{rank}</span>
          )}
          <span
            className={cn(
              'min-w-0 flex-1 font-ui text-foreground',
              large ? 'text-base' : 'text-sm',
              rank !== undefined && 'leading-[1.25]',
              kind === undefined && 'truncate',
              selected ? 'font-bold' : 'font-semibold',
            )}
          >
            {title}
          </span>
        </span>
        {kind !== undefined ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            {kind === 'tv' ? <Tv aria-hidden="true" className="size-3.5" /> : <Clapperboard aria-hidden="true" className="size-3.5" />}
            <span className="font-ui text-[13px] font-medium">{kind === 'tv' ? 'TV series' : 'Movie'}</span>
            {year != null && (
              <>
                <span aria-hidden="true" className="font-ui text-[13px] text-subtle-foreground">·</span>
                <span className="font-data text-sm">{year}</span>
              </>
            )}
          </span>
        ) : (
          meta !== undefined && <span className="truncate font-data text-[13px] text-muted-foreground">{meta}</span>
        )}
        {genres !== undefined && <span className="truncate font-ui text-xs text-subtle-foreground">{genres}</span>}
      </span>
      {badges !== undefined && <span className="flex items-center gap-1.5 pt-0.5">{badges}</span>}
      {status}
    </a>
  );
}

export { LibraryPosterCard };
