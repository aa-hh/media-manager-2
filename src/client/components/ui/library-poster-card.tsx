// Figma: LibraryPosterCard — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-2830
import { ArrowRight, Check, Clapperboard, ImageOff, Tv } from 'lucide-react';
import { type ComponentProps, type ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';
import { inScreenChange } from '@/navigation';

type LibraryPosterCardProps = ComponentProps<'a'> & {
  /** Poster image address; a muted block stands in without one. */
  poster?: string;
  title: ReactNode;
  meta?: ReactNode;
  /** One Badge on the poster's bottom-left corner, or nothing when normal; hidden while imported. */
  status?: ReactNode;
  /** Puts `status` on the top row, level with the watch mark, as Library does for Downloading. */
  statusOnTop?: boolean;
  /** Downloading percent: the 4 px lime strip on the poster's bottom edge. */
  progress?: number;
  /** Just imported: full-width strip plus the black Imported label with a lime check. */
  imported?: boolean;
  importedLabel?: ReactNode;
  selected?: boolean;
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
  /** Watched percent of a title stopped partway: the blue watch bar, 8 in from the poster's sides and bottom. */
  watched?: number;
  /** Top-right mark: a tick when everything available is watched, or a show's number of unwatched episodes. Hidden while the watch bar shows. */
  watchMark?: 'played' | number;
  /** The Play or Resume button at the poster's left, just above the watch bar. Shows on hover or keyboard focus. */
  action?: ReactNode;
  /** Keeps `action` showing, as on Continue Watching. */
  actionAlwaysVisible?: boolean;
};

const mark = 'flex h-9 items-center justify-center rounded-full bg-poster-mark text-bar-foreground ring-1 ring-white/15 ring-inset backdrop-blur-sm';

/**
 * Poster card for Library and Discover, 210 by 315 poster in full colour with a 1 px inner edge. Hover darkens the poster to 92 %,
 * pressed 84 %; focus rings the poster; selected adds a 2 px black edge and a 700 title.
 * Its poster block keeps the skeleton shimmer until the image has loaded, then the image fades in, unless it was cached or
 * arrived during a screen change, whose crossfade already brings it in (the screen around the card decides whether the card
 * itself fades in, so a card does not fade on every screen change). An image that fails to load shows the no-poster fallback.
 */
function LibraryPosterCard({
  poster, title, meta, status, statusOnTop = false, progress, imported = false, importedLabel = 'Imported', selected = false,
  rank, kind, year, genres, badges, dateTab, overview, watched, watchMark, action, actionAlwaysVisible = false, className, ...props
}: LibraryPosterCardProps) {
  const strip = imported ? 100 : progress;
  const [image, setImage] = useState<'loading' | 'loaded' | 'shown' | 'failed'>('loading');
  const showPoster = poster !== undefined && image !== 'failed';
  const card = (
    <a className={cn('group flex w-(--poster-width) flex-col gap-2 outline-none', className)} {...props}>
      <span
        data-poster
        className={cn(
          'relative block h-78.75 w-full overflow-hidden rounded-md bg-muted',
          showPoster && image === 'loading' && 'skeleton-shimmer motion-reduce:bg-none',
          'group-focus-visible:outline-2 group-focus-visible:outline-offset-0 group-focus-visible:outline-ring',
        )}
      >
        {showPoster && (
          <img
            // A cached image can finish before React attaches onLoad, so a complete one counts as loaded at once.
            ref={(node) => { if (node?.complete === true && node.naturalWidth > 0) setImage((current) => (current === 'loading' ? 'shown' : current)); }}
            src={poster}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={() => setImage((current) => (current === 'loading' ? (inScreenChange() ? 'shown' : 'loaded') : current))}
            onError={() => setImage('failed')}
            className={cn(
              'size-full object-cover transition-[filter] duration-(--duration-fast) ease-out',
              'group-hover:brightness-92 group-hover/card:brightness-92 group-active:brightness-84 group-active:duration-0',
              image === 'loaded' && 'animate-content-in',
              image === 'loading' && 'opacity-0',
            )}
          />
        )}
        {!showPoster && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <ImageOff aria-hidden="true" className="size-6 text-subtle-foreground" />
            <span className="font-ui text-xs text-muted-foreground">No poster yet</span>
          </span>
        )}
        {status !== undefined && !imported && <span className={cn('absolute left-2 flex', statusOnTop ? 'top-4' : 'bottom-2')}>{status}</span>}
        {watchMark !== undefined && watched === undefined && (
          <span className="absolute top-2 right-2 flex">
            {watchMark === 'played' ? (
              <span className={cn(mark, 'w-9')}>
                <Check aria-hidden="true" className="size-5.25" />
                <span className="sr-only">Played</span>
              </span>
            ) : (
              <span className={cn(mark, 'min-w-9 px-3.5 font-data text-sm font-semibold')}>
                {watchMark}
                <span className="sr-only"> unwatched</span>
              </span>
            )}
          </span>
        )}
        {watched !== undefined && (
          <span aria-hidden="true" className="absolute inset-x-2 bottom-2 h-1.5 overflow-hidden rounded-full bg-bar-foreground/30">
            <span style={{ translate: `${Math.min(100, Math.max(0, watched)) - 100}% 0` }} className="block h-full w-full rounded-full bg-watch-bar" />
          </span>
        )}
        <span
          aria-hidden="true"
          className={cn('pointer-events-none absolute inset-0 rounded-md ring-inset', selected ? 'ring-2 ring-foreground' : 'ring-1 ring-foreground/10')}
        />
        {strip !== undefined && (
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-bar-foreground/30">
            <span
              style={{ translate: `${strip - 100}% 0` }}
              className="block h-full w-full bg-live transition-[translate] duration-(--duration-slow) ease-out"
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
              'pointer-events-none absolute inset-x-0 bottom-0 flex h-32.5 flex-col justify-end gap-2 p-3 opacity-0 transition-opacity duration-(--duration-base) ease-out',
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
            <span className="font-data text-sm font-semibold text-subtle-foreground">{rank}</span>
          )}
          <span
            className={cn(
              'min-w-0 flex-1 font-ui text-sm text-foreground',
              rank !== undefined && 'leading-[1.25]',
              kind === undefined ? 'truncate' : 'line-clamp-2 [overflow-wrap:anywhere]',
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
    </a>
  );
  if (action === undefined) return card;
  return (
    <div className="group/card relative w-fit">
      {card}
      {/* Beside the link, not inside it: a button inside a link is invalid, and only a click on the button plays. */}
      <span
        className={cn(
          'absolute top-63.75 left-3 flex transition-[opacity,visibility] duration-(--duration-fast) ease-out',
          '[&_:focus-visible]:outline-focus-on-dark! [&_:focus-visible]:outline-offset-3!',
          !actionAlwaysVisible && 'invisible opacity-0 group-focus-within/card:visible group-focus-within/card:opacity-100 group-hover/card:visible group-hover/card:opacity-100',
        )}
      >
        {action}
      </span>
    </div>
  );
}

export { LibraryPosterCard };
