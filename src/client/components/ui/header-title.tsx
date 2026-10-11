// v2/Header/title — design/design-system.lib.pen NaDkI
import type { ReactNode } from 'react';
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

function Poster({ url, className }: { url?: string; className: string }) {
  return (
    <div className={cn('relative shrink-0 overflow-hidden bg-muted', innerEdge, className)}>
      {url !== undefined && <img src={url} alt="" className="size-full object-cover" />}
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
      {backdropUrl !== undefined && (
        <div aria-hidden="true" className={cn('absolute inset-x-0 top-0 bg-cover bg-center', actionsRight ? 'bottom-0' : 'h-55')} style={{ backgroundImage: `url(${JSON.stringify(backdropUrl)})` }}>
          <div className={cn('size-full bg-linear-to-b', actionsRight ? 'from-background/20 via-background/70 via-45% to-background' : 'from-transparent via-background/55 via-55% to-background')} />
        </div>
      )}
      <div className={cn('relative flex w-full gap-8', actionsRight && 'items-end')}>
        {/* title-poster: a poster card opening this page morphs into it (globals.css). */}
        <Poster url={posterUrl} className="title-poster h-66 w-44 rounded-md" />
        <div className="flex min-w-0 flex-1 flex-col gap-3 pt-15">
          {breadcrumb}
          <div className="flex items-center gap-2.5">
            {bookmark !== undefined && <ToggleBookmark state={bookmark.state} onToggle={bookmark.onToggle} className="size-9" />}
            <h1 className="font-ui text-4xl font-extrabold tracking-[-0.6px] text-foreground">{title}</h1>
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

export { HeaderTitle };
