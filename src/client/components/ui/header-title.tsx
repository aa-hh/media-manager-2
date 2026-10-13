// v2/Header/title — ~/Projects/media-manager-2-design/design-system.lib.pen NaDkI
import { type ReactNode, useState } from 'react';
import { ToggleBookmark, type BookmarkState } from '@/components/ui/toggle-bookmark';
import { cn } from '@/lib/utils';

type HeaderTitleProps = {
  title: string;
  /** Sonarr or Radarr backdrop image; the band fades to white under it. */
  backdropUrl?: string;
  posterUrl?: string;
  /** A Breadcrumb. */
  breadcrumb: ReactNode;
  bookmark?: { state: BookmarkState; onToggle?: () => void };
  /** A StatusInline beside the title, such as a monitor change Sonarr refused. */
  status?: ReactNode;
  /** Plain meta line in the data font, such as "TV · Apple TV+ · 2022". */
  meta?: ReactNode;
  /** Status Badges. */
  badges?: ReactNode;
  overview?: ReactNode;
  /** Large default Button. */
  primary?: ReactNode;
  /** Large outline Button. */
  secondary?: ReactNode;
  /** 48 px ghost icon Button that opens the DropdownMenu. */
  more?: ReactNode;
  /** Up to four Fact elements. */
  facts?: ReactNode;
  /** Title page overview band layout: the backdrop fills the header, poster and title block sit at the bottom, and the actions sit at the right, bottom-aligned. Overview and facts are not shown. */
  actionsRight?: boolean;
  /** The page has scrolled: one 72 px strip with a poster thumb, breadcrumb over a 20/700 title, and the same actions. */
  compact?: boolean;
  className?: string;
};

// A 1 px inner edge over a poster image (foreground at 10%).
const innerEdge = 'after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-foreground/10';

/**
 * An image that is drawn at once when the browser already has it, and otherwise fades in when it arrives.
 * settle: a large image also eases from 103 % to full size over twice duration-slow, so a late arrival reads as deliberate.
 */
function FadeImage({ src, settle = false, className }: { src: string; settle?: boolean; className?: string }) {
  const [loaded, setLoaded] = useState(() => {
    const probe = new Image();
    probe.src = src;
    return probe.complete && probe.naturalWidth > 0;
  });
  return (
    <img
      src={src}
      alt=""
      decoding="async"
      onLoad={() => setLoaded(true)}
      className={cn(
        'object-cover ease-out',
        settle ? 'transition-[opacity,scale] duration-[calc(var(--duration-slow)*2)]' : 'transition-opacity duration-(--duration-slow)',
        loaded ? 'opacity-100' : cn('opacity-0', settle && 'scale-103'),
        className,
      )}
    />
  );
}

function Poster({ url, className }: { url?: string; className: string }) {
  return (
    <div className={cn('relative shrink-0 overflow-hidden bg-muted', innerEdge, className)}>
      {url !== undefined && <FadeImage key={url} src={url} className="size-full" />}
    </div>
  );
}

/**
 * The band behind the hero. A heavily blurred copy of the poster fills it at once, from the poster the browser already
 * has, and the backdrop settles in over it, so the band never jumps from white to a photo. tall: the owned layout,
 * where the band covers the whole header; otherwise it is 220 px. The loading title page draws the same band.
 */
function HeaderBackdrop({ posterUrl, backdropUrl, tall, className }: { posterUrl?: string; backdropUrl?: string; tall: boolean; className?: string }) {
  if (posterUrl === undefined && backdropUrl === undefined) return null;
  return (
    <div aria-hidden="true" className={cn('absolute top-0 overflow-hidden', tall ? 'bottom-0' : 'h-55', className)}>
      {posterUrl !== undefined && <img src={posterUrl} alt="" decoding="async" className="absolute inset-0 size-full scale-125 object-cover opacity-70 blur-3xl saturate-150" />}
      {backdropUrl !== undefined && <FadeImage key={backdropUrl} src={backdropUrl} settle className="absolute inset-0 size-full" />}
      <div className={cn('relative size-full bg-linear-to-b', tall ? 'from-background/20 via-background/70 via-45% to-background' : 'from-transparent via-background/55 via-55% to-background')} />
    </div>
  );
}

/** Title overview hero, the same for owned and not-yet-added titles. */
function HeaderTitle({
  title,
  backdropUrl,
  posterUrl,
  breadcrumb,
  bookmark,
  status,
  meta,
  badges,
  overview,
  primary,
  secondary,
  more,
  facts,
  actionsRight = false,
  compact = false,
  className,
}: HeaderTitleProps) {
  const actions = (
    <div className={cn('flex items-center gap-2', !compact && (actionsRight ? 'shrink-0 items-end justify-end' : 'pt-2'))}>
      {primary}
      {secondary}
      {more}
    </div>
  );

  if (compact) {
    return (
      <header className={cn('flex w-full items-center gap-4 border-b border-border bg-background px-10 py-3', className)}>
        <Poster url={posterUrl} className="h-12 w-8 rounded-xs" />
        <div className="flex min-w-0 flex-col gap-0.5">
          {breadcrumb}
          <h1 className="truncate font-ui text-xl font-bold tracking-[-0.3px] text-foreground">{title}</h1>
        </div>
        <span aria-hidden="true" className="flex-1" />
        {actions}
      </header>
    );
  }

  return (
    <header className={cn('relative flex w-full flex-col overflow-hidden bg-background px-10', actionsRight ? 'pt-10 pb-8' : 'pt-25 pb-6', className)}>
      <HeaderBackdrop posterUrl={posterUrl} backdropUrl={backdropUrl} tall={actionsRight} className="inset-x-0" />
      <div className={cn('relative flex w-full gap-8', actionsRight && 'items-end')}>
        {/* title-poster: a poster card opening this page morphs into it (globals.css). */}
        <Poster url={posterUrl} className="title-poster h-66 w-44 rounded-md" />
        <div className="flex min-w-0 flex-1 flex-col gap-3 pt-15">
          {breadcrumb}
          <div className="flex min-w-0 items-center gap-2.5">
            {bookmark !== undefined && <ToggleBookmark state={bookmark.state} onToggle={bookmark.onToggle} className="size-9" />}
            <h1 className="min-w-0 font-ui text-4xl font-extrabold tracking-[-0.6px] [overflow-wrap:anywhere] text-foreground">{title}</h1>
            {status}
          </div>
          {meta !== undefined && <p className="font-data text-[15px] font-normal text-muted-foreground">{meta}</p>}
          {badges !== undefined && <div className="flex flex-wrap items-center gap-1.5">{badges}</div>}
          {!actionsRight && overview !== undefined && <p className="max-w-170 font-ui text-[15px] leading-[1.55] font-normal text-muted-foreground">{overview}</p>}
          {!actionsRight && actions}
        </div>
        {actionsRight && actions}
        {!actionsRight && facts !== undefined && <dl className="flex w-60 shrink-0 flex-col gap-4 pt-34">{facts}</dl>}
      </div>
    </header>
  );
}

export { HeaderBackdrop, HeaderTitle };
